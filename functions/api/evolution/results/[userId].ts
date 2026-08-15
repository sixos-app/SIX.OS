import { getAccessUser, hasPermissionV2, getPermissionScope, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

type AvailableCycle = { id: string; name: string; results_available_at: string }
type EvaluationAnswer = {
  relationshipType: string
  isConfidential: number
  reviewerId: string
  questionId: string
  ratingValue: number | null
  textValue: string | null
  questionType: string
  questionText: string
  competencyName: string | null
}

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { userId: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  let hasAccess = false
  if (params.userId === user.id) {
    hasAccess = await hasPermissionV2(env, request, user, 'evaluations.results.view_own')
  } else {
    const scope = await getPermissionScope(env, request, user, 'evaluations.results.view_team')
    if (scope) {
      // Validate scope rules
      const subject = await env.DB.prepare('SELECT department_id, manager_id, organization_id FROM users WHERE id = ?').bind(params.userId).first<{ department_id: string, manager_id: string, organization_id: string }>()
      if (subject && subject.organization_id === user.organizationId) {
        if (scope === 'all') hasAccess = true
        if (scope === 'department' && subject.department_id === user.departmentId) hasAccess = true
        if (scope === 'team' && subject.manager_id === user.id) hasAccess = true
      }
    }
  }

  if (!hasAccess) return permissionRequiredResponse()

  // Get requested cycleId from query params
  const url = new URL(request.url)
  const cycleId = url.searchParams.get('cycleId')

  let cycleCondition = ''
  const bindings: unknown[] = [params.userId, user.organizationId]
  if (cycleId) {
    cycleCondition = 'AND ec.id = ?'
    bindings.push(cycleId)
  }

  // We only show results if the cycle has passed results_available_at
  const cyclesAvailable = await env.DB.prepare(`
    SELECT DISTINCT ec.id, ec.name, ec.results_available_at
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    WHERE ea.subject_user_id = ? AND ec.organization_id = ? ${cycleCondition}
      AND ec.results_available_at IS NOT NULL 
      AND datetime(ec.results_available_at) <= datetime('now')
  `).bind(...bindings).all<AvailableCycle>()

  if (cyclesAvailable.results.length === 0) {
    return Response.json({ error: 'Nenhum resultado disponível para este usuário no momento.' }, { status: 404 })
  }

  const activeCycleId = cyclesAvailable.results[0].id

  // Determine if current requester can bypass confidentiality 
  const canBypassConfidentiality = await hasPermissionV2(env, request, user, 'evaluations.confidential.view')

  // Fetch all SUBMITTED answers for the subject in this cycle
  const answersData = await env.DB.prepare(`
    SELECT 
      ea.relationship_type AS relationshipType,
      ea.is_confidential AS isConfidential,
      ea.reviewer_user_id AS reviewerId,
      ans.question_id AS questionId,
      ans.rating_value AS ratingValue,
      ans.text_value AS textValue,
      eq.type AS questionType,
      eq.question AS questionText,
      c.name AS competencyName
    FROM evaluation_assignments ea
    JOIN evaluation_responses er ON er.assignment_id = ea.id
    JOIN evaluation_answers ans ON ans.response_id = er.id
    JOIN evaluation_questions eq ON eq.id = ans.question_id
    LEFT JOIN competencies c ON c.id = eq.competency_id
    WHERE ea.subject_user_id = ? AND ea.cycle_id = ? AND er.status = 'submitted'
  `).bind(params.userId, activeCycleId).all<EvaluationAnswer>()

  const minConfidentialResponses = 3

  // Process data
  const relationships = ['self', 'manager', 'peer', 'direct_report']
  const processedResults: any = {
    cycle: cyclesAvailable.results[0],
    overallScore: 0,
    groups: {},
    competencies: {}
  }

  // Group by relationship
  const groupedByRel: Record<string, any[]> = {}
  for (const row of answersData.results) {
    if (!groupedByRel[row.relationshipType]) groupedByRel[row.relationshipType] = []
    groupedByRel[row.relationshipType].push(row)
  }

  let totalScoreSum = 0
  let totalScoreCount = 0

  for (const rel of relationships) {
    const relAnswers = groupedByRel[rel] || []
    const uniqueReviewers = new Set(relAnswers.map(a => a.reviewerId)).size

    // Confidentiality Check
    const isRelConfidential = relAnswers.length > 0 && relAnswers[0].isConfidential === 1
    const hideDueToConfidentiality = isRelConfidential && uniqueReviewers < minConfidentialResponses && !canBypassConfidentiality

    if (hideDueToConfidentiality) {
      processedResults.groups[rel] = { obscured: true, reason: 'Dados insuficientes para preservar a confidencialidade.' }
      continue
    }

    const ratingAnswers = relAnswers.filter(a => a.questionType === 'rating' && a.ratingValue !== null)
    let groupScore = 0
    if (ratingAnswers.length > 0) {
      groupScore = ratingAnswers.reduce((sum, a) => sum + Number(a.ratingValue), 0) / ratingAnswers.length
      totalScoreSum += groupScore
      totalScoreCount++
    }

    // Prepare text comments, stripping reviewerId unless canBypassConfidentiality is true
    const textAnswers = relAnswers.filter(a => a.questionType === 'text' && a.textValue)
    const comments = textAnswers.map(a => ({
      question: a.questionText,
      text: a.textValue,
      reviewerId: canBypassConfidentiality ? a.reviewerId : undefined
    }))

    // Shuffle comments to avoid correlation by time if confidential
    if (isRelConfidential && !canBypassConfidentiality) {
      comments.sort(() => Math.random() - 0.5)
    }

    processedResults.groups[rel] = {
      score: groupScore > 0 ? groupScore : null,
      comments: comments.length > 0 ? comments : null
    }

    // Populate competencies
    for (const ans of ratingAnswers) {
      const compName = ans.competencyName || 'Geral'
      if (!processedResults.competencies[compName]) processedResults.competencies[compName] = { scores: {} }
      if (!processedResults.competencies[compName].scores[rel]) {
        processedResults.competencies[compName].scores[rel] = { sum: 0, count: 0 }
      }
      processedResults.competencies[compName].scores[rel].sum += Number(ans.ratingValue)
      processedResults.competencies[compName].scores[rel].count++
    }
  }

  if (totalScoreCount > 0) {
    processedResults.overallScore = totalScoreSum / totalScoreCount
  }

  // Finalize competencies averages
  for (const compName of Object.keys(processedResults.competencies)) {
    const comp = processedResults.competencies[compName]
    for (const rel of Object.keys(comp.scores)) {
      comp.scores[rel] = comp.scores[rel].sum / comp.scores[rel].count
    }
  }

  return Response.json(processedResults)
}
