import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../../_access'

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.cycles.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare(`
    SELECT * FROM evaluation_cycles WHERE id = ? AND organization_id = ?
  `).bind(params.id, user.organizationId).first<{ 
    id: string, status: string, template_id: string, 
    auto_assign_self: number, auto_assign_manager: number, auto_assign_direct_report: number,
    self_confidential: number, manager_confidential: number, peer_confidential: number, direct_report_confidential: number
  }>()

  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })
  if (cycle.status !== 'draft' && cycle.status !== 'scheduled') return Response.json({ error: 'Ciclo já ativo ou fechado.' }, { status: 403 })
  if (!cycle.template_id) return Response.json({ error: 'Template não selecionado.' }, { status: 400 })

  // Pegar participantes ativos do ciclo
  const participants = await env.DB.prepare(`
    SELECT user_id FROM evaluation_cycle_participants WHERE cycle_id = ? AND status = 'active'
  `).bind(params.id).all<{ user_id: string }>()

  if (participants.results.length === 0) {
    return Response.json({ error: 'Nenhum participante configurado neste ciclo.' }, { status: 400 })
  }

  // Pegar os dados dos usuários participantes (para achar manager_id, etc)
  const participantIds = participants.results.map(p => p.user_id)
  const placeholdersStr = participantIds.map(() => '?').join(',')
  const usersData = await env.DB.prepare(`
    SELECT id, manager_id FROM users WHERE id IN (${placeholdersStr})
  `).bind(...participantIds).all<{ id: string, manager_id: string }>()

  const userManagerMap = new Map<string, string>()
  const managerToReportsMap = new Map<string, string[]>()

  for (const u of usersData.results) {
    if (u.manager_id) {
      userManagerMap.set(u.id, u.manager_id)
      if (!managerToReportsMap.has(u.manager_id)) managerToReportsMap.set(u.manager_id, [])
      managerToReportsMap.get(u.manager_id)!.push(u.id)
    }
  }

  const generatedAssignments: { subject: string, reviewer: string, rel: string, conf: number }[] = []

  // Geração Automática
  for (const p of participants.results) {
    const subjectId = p.user_id
    
    // Auto (self)
    if (cycle.auto_assign_self === 1) {
      generatedAssignments.push({ subject: subjectId, reviewer: subjectId, rel: 'self', conf: cycle.self_confidential })
    }

    // Liderança (manager avalia subject)
    if (cycle.auto_assign_manager === 1) {
      const managerId = userManagerMap.get(subjectId)
      // O manager tem que estar na organização. Idealmente, validar se é um active user.
      if (managerId) {
        generatedAssignments.push({ subject: subjectId, reviewer: managerId, rel: 'manager', conf: cycle.manager_confidential })
      }
    }

    // Liderados (direct_report avalia subject que é líder)
    if (cycle.auto_assign_direct_report === 1) {
      const directReports = managerToReportsMap.get(subjectId)
      if (directReports && directReports.length > 0) {
        for (const reportId of directReports) {
          generatedAssignments.push({ subject: subjectId, reviewer: reportId, rel: 'direct_report', conf: cycle.direct_report_confidential })
        }
      }
    }
  }

  // Inserir os assignments
  // Como D1 limita inserts, fazemos batches
  const BATCH_SIZE = 50
  for (let i = 0; i < generatedAssignments.length; i += BATCH_SIZE) {
    const batch = generatedAssignments.slice(i, i + BATCH_SIZE)
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',')
    const values: any[] = []
    
    for (const a of batch) {
      values.push(crypto.randomUUID(), params.id, a.subject, a.reviewer, a.rel, a.conf, 'pending')
    }
    
    await env.DB.prepare(`
      INSERT OR IGNORE INTO evaluation_assignments (id, cycle_id, subject_user_id, reviewer_user_id, relationship_type, is_confidential, status)
      VALUES ${placeholders}
    `).bind(...values).run()
  }

  // Mudar status do ciclo para active
  await env.DB.prepare(`
    UPDATE evaluation_cycles SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(params.id).run()

  return Response.json({ success: true, generatedCount: generatedAssignments.length })
}
