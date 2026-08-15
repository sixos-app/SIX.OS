import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

const statuses: Record<string, string> = {
  'EM CONCEPÇÃO': 'planning',
  'EM PRODUÇÃO': 'active',
  'EM APROVAÇÃO': 'approval',
  'PAUSADO': 'archived',
  'CONCLUÍDO': 'delivered',
}

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, request, params }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'projects.manage'))) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const statusLabel = typeof body?.status === 'string' ? body.status : ''
  const status = statuses[statusLabel]
  const nextStep = typeof body?.nextStep === 'string' ? body.nextStep.trim().slice(0, 1000) : ''
  const dueAt = typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null
  if (!status || !nextStep) return Response.json({ error: 'Status e próximo movimento são inválidos' }, { status: 400 })

  const now = new Date().toISOString()
  const result = await env.DB.prepare(`
    UPDATE projects
    SET status = ?, due_at = ?, next_step = ?, activity = ?, progress = CASE WHEN ? = 'delivered' THEN 100 ELSE progress END, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(status, dueAt, nextStep, `Ciclo atualizado por ${user.name}.`, status, now, params.id, user.organizationId).run()
  if (result.meta.changes !== 1) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })

  return Response.json({ success: true, status: statusLabel, dueAt, nextStep, activity: `Ciclo atualizado por ${user.name}.` })
}
