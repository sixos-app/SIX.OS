import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

const statuses: Record<string, string> = {
  'EM CONCEPÇÃO': 'planning',
  'EM PRODUÇÃO': 'active',
  'EM APROVAÇÃO': 'approval',
  'PAUSADO': 'archived',
  'CONCLUÍDO': 'delivered',
}

const tones = new Set([
  'lime',
  'purple',
  'orange',
  'blue',
  'cyan',
  'turquoise',
  'yellow',
  'pink',
  'coral',
  'magenta',
])

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, request, params }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'projects.manage'))) return permissionRequiredResponse()

  const projectId = typeof params.id === 'string' ? params.id : ''
  if (!projectId) return Response.json({ error: 'ID do projeto é obrigatório' }, { status: 400 })

  const existing = await env.DB.prepare(`
    SELECT id, status, due_at AS dueAt, visual_tone AS visualTone, color_key AS colorKey, next_step AS nextStep
    FROM projects
    WHERE id = ? AND organization_id = ?
    LIMIT 1
  `).bind(projectId, user.organizationId).first<{
    id: string
    status: string
    dueAt: string | null
    visualTone: string
    colorKey: string | null
    nextStep: string
  }>()

  if (!existing) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const now = new Date().toISOString()

  let status = existing.status
  let statusLabel = ''
  if (typeof body?.status === 'string' && statuses[body.status]) {
    status = statuses[body.status]
    statusLabel = body.status
  }

  const nextStep = typeof body?.nextStep === 'string'
    ? body.nextStep.trim().slice(0, 1000)
    : existing.nextStep

  const dueAt = typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt))
    ? new Date(body.dueAt).toISOString()
    : body?.dueAt === null
      ? null
      : existing.dueAt

  const tone = typeof body?.tone === 'string' && tones.has(body.tone)
    ? body.tone
    : existing.colorKey ?? existing.visualTone ?? 'lime'
  const fallbackTone = (tone === 'lime' || tone === 'purple' || tone === 'orange') ? tone : 'lime'

  const activity = `Ciclo atualizado por ${user.name}.`

  await env.DB.prepare(`
    UPDATE projects
    SET status = ?, due_at = ?, visual_tone = ?, color_key = ?, next_step = ?, activity = ?, progress = CASE WHEN ? = 'delivered' THEN 100 ELSE progress END, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(status, dueAt, fallbackTone, tone, nextStep, activity, status, now, projectId, user.organizationId).run()

  // Sincronizar workTypeIds se fornecido
  let savedWorkTypeIds: string[] | undefined = undefined
  if (Array.isArray(body?.workTypeIds)) {
    const incomingIds = body.workTypeIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    
    // Remover vínculos anteriores
    await env.DB.prepare(`
      DELETE FROM project_work_types WHERE project_id = ?
    `).bind(projectId).run()

    savedWorkTypeIds = []
    for (const wtId of incomingIds) {
      const wt = await env.DB.prepare(`
        SELECT id FROM work_types WHERE id = ? AND organization_id = ? LIMIT 1
      `).bind(wtId, user.organizationId).first()
      if (wt) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO project_work_types (project_id, work_type_id, created_at)
          VALUES (?, ?, ?)
        `).bind(projectId, wtId, now).run()
        savedWorkTypeIds.push(wtId)
      }
    }
  }

  return Response.json({
    success: true,
    status: statusLabel || (status === 'planning' ? 'EM CONCEPÇÃO' : status === 'active' ? 'EM PRODUÇÃO' : status === 'approval' ? 'EM APROVAÇÃO' : status === 'delivered' ? 'CONCLUÍDO' : 'PAUSADO'),
    dueAt,
    tone,
    nextStep,
    activity,
    workTypeIds: savedWorkTypeIds,
  })
}
