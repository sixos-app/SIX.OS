import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.respond')
  if (!hasAccess) return permissionRequiredResponse()

  // Verify assignment ownership and cross-org isolation
  const assignment = await env.DB.prepare(`
    SELECT ea.id, ea.status, ea.relationship_type AS relationshipType, ea.subject_user_id AS subjectUserId,
           u.name AS subjectName, ec.name AS cycleName, ec.id AS cycleId
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    JOIN users u ON u.id = ea.subject_user_id
    WHERE ea.id = ? AND ea.reviewer_user_id = ? AND ec.organization_id = ?
  `).bind(params.id, user.id, user.organizationId).first()

  if (!assignment) return Response.json({ error: 'Avaliação não encontrada ou acesso negado' }, { status: 404 })

  const questions = await env.DB.prepare(`
    SELECT eq.id, eq.question, eq.type, eq.required,
           c.name AS competencyName
    FROM evaluation_questions eq
    JOIN evaluation_cycles ec ON ec.template_id = eq.template_id
    LEFT JOIN competencies c ON c.id = eq.competency_id
    WHERE ec.id = ?
    ORDER BY eq.sort_order ASC
  `).bind(assignment.cycleId).all()

  const scaleOptions = await env.DB.prepare(`
    SELECT eso.numeric_value AS numericValue, eso.label
    FROM evaluation_scale_options eso
    JOIN evaluation_templates et ON et.scale_id = eso.scale_id
    JOIN evaluation_cycles ec ON ec.template_id = et.id
    WHERE ec.id = ?
    ORDER BY eso.sort_order ASC
  `).bind(assignment.cycleId).all()

  // Fetch existing response if any
  const existingResponse = await env.DB.prepare(`
    SELECT id, status FROM evaluation_responses WHERE assignment_id = ?
  `).bind(params.id).first<{ id: string, status: string }>()

  let answers: any[] = []
  if (existingResponse) {
    const rawAnswers = await env.DB.prepare(`
      SELECT question_id AS questionId, rating_value AS ratingValue, text_value AS textValue
      FROM evaluation_answers
      WHERE response_id = ?
    `).bind(existingResponse.id).all()
    answers = rawAnswers.results
  }

  return Response.json({
    assignment,
    questions: questions.results,
    scaleOptions: scaleOptions.results,
    response: existingResponse ? { status: existingResponse.status, answers } : null
  })
}

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.respond')
  if (!hasAccess) return permissionRequiredResponse()

  const assignment = await env.DB.prepare(`
    SELECT ea.id, ea.status, ec.status AS cycleStatus, ec.id AS cycleId
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    WHERE ea.id = ? AND ea.reviewer_user_id = ? AND ec.organization_id = ?
  `).bind(params.id, user.id, user.organizationId).first<{ id: string, status: string, cycleStatus: string, cycleId: string }>()

  if (!assignment) return Response.json({ error: 'Avaliação não encontrada ou acesso negado' }, { status: 404 })
  if (assignment.cycleStatus !== 'active') return Response.json({ error: 'O ciclo não está ativo' }, { status: 403 })
  if (assignment.status === 'submitted') return Response.json({ error: 'Esta avaliação já foi submetida e é imutável' }, { status: 403 })

  // Fetch valid questions and scale options
  const validQuestions = await env.DB.prepare(`
    SELECT eq.id, eq.type, eq.required
    FROM evaluation_questions eq
    JOIN evaluation_cycles ec ON ec.template_id = eq.template_id
    WHERE ec.id = ?
  `).bind(assignment.cycleId).all<{ id: string, type: string, required: number }>()

  const validScaleOptions = await env.DB.prepare(`
    SELECT eso.numeric_value
    FROM evaluation_scale_options eso
    JOIN evaluation_templates et ON et.scale_id = eso.scale_id
    JOIN evaluation_cycles ec ON ec.template_id = et.id
    WHERE ec.id = ?
  `).bind(assignment.cycleId).all<{ numeric_value: number }>()

  const validQuestionMap = new Map(validQuestions.results.map(q => [q.id, q]))
  const validRatings = new Set(validScaleOptions.results.map(s => s.numeric_value))

  const payload = await request.json() as { isDraft: boolean; answers: Array<{ questionId: string, ratingValue?: number, textValue?: string }> }
  
  // Validation
  for (const answer of payload.answers) {
    const questionDef = validQuestionMap.get(answer.questionId)
    if (!questionDef) return Response.json({ error: `Pergunta inválida: ${answer.questionId}` }, { status: 400 })

    if (questionDef.type === 'rating') {
      if (answer.ratingValue !== undefined && answer.ratingValue !== null) {
        if (!validRatings.has(answer.ratingValue)) {
          return Response.json({ error: `Valor de nota inválido para a pergunta ${answer.questionId}` }, { status: 400 })
        }
      } else if (!payload.isDraft && questionDef.required) {
        return Response.json({ error: `A pergunta ${answer.questionId} é obrigatória` }, { status: 400 })
      }
    } else if (questionDef.type === 'text') {
      if (answer.ratingValue !== undefined && answer.ratingValue !== null) {
        return Response.json({ error: `Pergunta de texto não aceita nota: ${answer.questionId}` }, { status: 400 })
      }
      if (!payload.isDraft && questionDef.required && !answer.textValue) {
        return Response.json({ error: `A pergunta ${answer.questionId} é obrigatória` }, { status: 400 })
      }
    }
  }

  const newStatus = payload.isDraft ? 'in_progress' : 'submitted'
  const responseStatus = payload.isDraft ? 'draft' : 'submitted'

  // Get or create response idempotently
  let responseObj = await env.DB.prepare('SELECT id FROM evaluation_responses WHERE assignment_id = ?').bind(params.id).first<{ id: string }>()
  
  try {
    if (!responseObj) {
      const responseId = crypto.randomUUID()
      await env.DB.prepare(`
        INSERT INTO evaluation_responses (id, assignment_id, status, submitted_at)
        VALUES (?, ?, ?, ?)
      `).bind(responseId, params.id, responseStatus, payload.isDraft ? null : new Date().toISOString()).run()
      responseObj = { id: responseId }
    } else {
      await env.DB.prepare(`
        UPDATE evaluation_responses SET status = ?, submitted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(responseStatus, payload.isDraft ? null : new Date().toISOString(), responseObj.id).run()
      // Delete old answers
      await env.DB.prepare('DELETE FROM evaluation_answers WHERE response_id = ?').bind(responseObj.id).run()
    }
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return Response.json({ error: 'Uma resposta já existe para esta avaliação.' }, { status: 409 })
    }
    throw error
  }

  // Insert new answers
  for (const answer of payload.answers) {
    await env.DB.prepare(`
      INSERT INTO evaluation_answers (id, response_id, question_id, rating_value, text_value)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), responseObj.id, answer.questionId, answer.ratingValue ?? null, answer.textValue ?? null).run()
  }

  // Update assignment status
  await env.DB.prepare(`
    UPDATE evaluation_assignments SET status = ?, submitted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(newStatus, payload.isDraft ? null : new Date().toISOString(), params.id).run()

  return Response.json({ success: true, status: newStatus })
}
