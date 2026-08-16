import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'

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

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'projects.create'))) return permissionRequiredResponse()

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : ''
  const clientId = typeof body?.clientId === 'string' ? body.clientId : ''
  const dueAt = typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null
  const tone = typeof body?.tone === 'string' && tones.has(body.tone) ? body.tone : 'lime'
  const fallbackTone = (tone === 'lime' || tone === 'purple' || tone === 'orange') ? tone : 'lime'
  const workTypeIds = Array.isArray(body?.workTypeIds)
    ? body.workTypeIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    : []

  if (!name || !clientId) return Response.json({ error: 'Nome e cliente são obrigatórios' }, { status: 400 })

  const client = await env.DB.prepare(`
    SELECT id, name, short_code AS code, image_url AS imageUrl
    FROM clients WHERE id = ? AND organization_id = ? LIMIT 1
  `).bind(clientId, user.organizationId).first<{ id: string; name: string; code: string | null; imageUrl: string | null }>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const nextStep = 'Definir o próximo movimento.'
  const activity = `Projeto criado por ${user.name}.`
  await env.DB.prepare(`
    INSERT INTO projects (id, organization_id, client_id, name, status, progress, due_at, visual_tone, color_key, next_step, activity, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'planning', 0, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.organizationId, client.id, name, dueAt, fallbackTone, tone, nextStep, activity, now, now).run()

  // Inserir tipos de trabalho vinculados ao projeto
  const savedWorkTypeIds: string[] = []
  if (workTypeIds.length > 0) {
    for (const wtId of workTypeIds) {
      // Verificar se tipo pertence à organização
      const wt = await env.DB.prepare(`
        SELECT id FROM work_types WHERE id = ? AND organization_id = ? LIMIT 1
      `).bind(wtId, user.organizationId).first()
      if (wt) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO project_work_types (project_id, work_type_id, created_at)
          VALUES (?, ?, ?)
        `).bind(id, wtId, now).run()
        savedWorkTypeIds.push(wtId)
      }
    }
  }

  return Response.json({
    project: {
      id,
      code: client.code ?? client.name.slice(0, 3).toLocaleUpperCase('pt-BR'),
      name,
      client: client.name,
      status: 'EM CONCEPÇÃO',
      progress: 0,
      deadline: dueAt ?? 'Próximo marco · em definição',
      dueAt,
      tone,
      members: [],
      nextStep,
      activity,
      clientImageUrl: client.imageUrl,
      workTypeIds: savedWorkTypeIds,
    },
  }, { status: 201 })
}
