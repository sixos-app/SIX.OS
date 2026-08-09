import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const template = await env.DB.prepare(`
    SELECT id, name, scale_id AS scaleId
    FROM evaluation_templates
    WHERE id = ? AND organization_id = ?
  `).bind(params.id, user.organizationId).first()

  if (!template) return Response.json({ error: 'Template não encontrado' }, { status: 404 })

  const questions = await env.DB.prepare(`
    SELECT id, competency_id AS competencyId, question, type, required, sort_order AS sortOrder
    FROM evaluation_questions
    WHERE template_id = ?
    ORDER BY sort_order ASC
  `).bind(params.id).all()

  return Response.json({ template, questions: questions.results })
}

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  // Verificando se o template existe na org do user
  const template = await env.DB.prepare('SELECT id FROM evaluation_templates WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first()
  if (!template) return Response.json({ error: 'Template não encontrado' }, { status: 404 })

  // Verificar se já existe algum ciclo usando esse template (se sim, não deveria editar as perguntas diretamente para não quebrar ciclos ativos/passados)
  const cyclesUsing = await env.DB.prepare('SELECT id FROM evaluation_cycles WHERE template_id = ?').bind(params.id).first()
  if (cyclesUsing) {
    return Response.json({ error: 'Este template já está em uso por um ciclo. Crie uma cópia para editar.' }, { status: 403 })
  }

  const payload = await request.json() as { name?: string, scaleId?: string, questions?: any[] }

  if (payload.name) {
    await env.DB.prepare(`
      UPDATE evaluation_templates SET name = ?, scale_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(payload.name, payload.scaleId || null, params.id).run()
  }

  if (payload.questions) {
    // Para simplificar, apagamos as antigas e inserimos as novas
    await env.DB.prepare('DELETE FROM evaluation_questions WHERE template_id = ?').bind(params.id).run()

    let sortOrder = 1
    for (const q of payload.questions) {
      await env.DB.prepare(`
        INSERT INTO evaluation_questions (id, template_id, competency_id, question, type, required, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), 
        params.id, 
        q.competencyId || null, 
        q.question, 
        q.type || 'rating', 
        q.required === false ? 0 : 1, 
        sortOrder++
      ).run()
    }
  }

  return Response.json({ success: true })
}
