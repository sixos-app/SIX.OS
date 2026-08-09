import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessMission, getMissionAccess } from '../_missionAccess'

export const onRequestPost: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as { label?: unknown } | null
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 240) : ''
  if (!label) return Response.json({ error: 'Informe o item do checklist' }, { status: 400 })
  const position = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) AS value FROM mission_checklist_items WHERE mission_id = ?').bind(mission.id).first<{ value: number }>()
  const item = { id: crypto.randomUUID(), label, isCompleted: 0, position: (position?.value ?? 0) + 1 }
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO mission_checklist_items (id, mission_id, label, position, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(item.id, mission.id, item.label, item.position, user.id, now, now),
    env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), mission.id, user.id, 'checklist_added', item.label, now),
  ])
  return Response.json({ item }, { status: 201 })
}

export const onRequestPatch: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as { id?: unknown; isCompleted?: unknown } | null
  const itemId = typeof body?.id === 'string' ? body.id : ''
  if (!itemId || typeof body?.isCompleted !== 'boolean') return Response.json({ error: 'Item do checklist inválido' }, { status: 400 })
  const item = await env.DB.prepare('SELECT id, label FROM mission_checklist_items WHERE id = ? AND mission_id = ?').bind(itemId, mission.id).first<{ id: string; label: string }>()
  if (!item) return Response.json({ error: 'Item não encontrado' }, { status: 404 })
  const now = new Date().toISOString(), isCompleted = body.isCompleted ? 1 : 0
  await env.DB.batch([
    env.DB.prepare('UPDATE mission_checklist_items SET is_completed = ?, updated_at = ? WHERE id = ?').bind(isCompleted, now, item.id),
    env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), mission.id, user.id, isCompleted ? 'checklist_completed' : 'checklist_reopened', item.label, now),
  ])
  return Response.json({ id: item.id, isCompleted })
}
