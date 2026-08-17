import type { Bindings } from '../_access'

export type MissionStageType = 'backlog' | 'ready' | 'doing' | 'review' | 'approval' | 'done'

export type MissionWorkflowStage = {
  id: string
  boardId: string
  name: string
  position: number
  type: MissionStageType
  color: 'lime' | 'purple' | 'orange' | 'neutral'
  isInitial: number
  isFinal: number
  requiresApproval: number
}

const defaultStages: Array<Omit<MissionWorkflowStage, 'id' | 'boardId'>> = [
  { name: 'Entrada', position: 0, type: 'backlog', color: 'neutral', isInitial: 0, isFinal: 0, requiresApproval: 0 },
  { name: 'A Fazer', position: 1, type: 'ready', color: 'purple', isInitial: 1, isFinal: 0, requiresApproval: 0 },
  { name: 'Em Produção', position: 2, type: 'doing', color: 'lime', isInitial: 0, isFinal: 0, requiresApproval: 0 },
  { name: 'Revisão', position: 3, type: 'review', color: 'orange', isInitial: 0, isFinal: 0, requiresApproval: 0 },
  { name: 'Aprovação', position: 4, type: 'approval', color: 'purple', isInitial: 0, isFinal: 0, requiresApproval: 1 },
  { name: 'Concluído', position: 5, type: 'done', color: 'lime', isInitial: 0, isFinal: 1, requiresApproval: 0 },
]

export async function ensureDefaultMissionWorkflow(env: Bindings, organizationId: string) {
  let board = await env.DB.prepare(`
    SELECT id, name
    FROM workflow_boards
    WHERE organization_id = ? AND is_default = 1
    LIMIT 1
  `).bind(organizationId).first<{ id: string; name: string }>()

  if (!board) {
    const id = `workflow-board-default-${organizationId}`
    await env.DB.prepare(`
      INSERT OR IGNORE INTO workflow_boards (id, organization_id, name, slug, is_default)
      VALUES (?, ?, 'Fluxo de Missões', 'missoes', 1)
    `).bind(id, organizationId).run()
    board = await env.DB.prepare(`
      SELECT id, name
      FROM workflow_boards
      WHERE organization_id = ? AND is_default = 1
      LIMIT 1
    `).bind(organizationId).first<{ id: string; name: string }>()
  }

  if (!board) throw new Error('Não foi possível preparar o fluxo padrão de missões')

  await env.DB.batch(defaultStages.map((stage) => env.DB.prepare(`
    INSERT OR IGNORE INTO workflow_stages
      (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `workflow-stage-${stage.type}-${organizationId}`,
    board.id,
    stage.name,
    stage.position,
    stage.type,
    stage.color,
    stage.isInitial,
    stage.isFinal,
    stage.requiresApproval,
  )))

  const { results } = await env.DB.prepare(`
    SELECT id, board_id AS boardId, name, position, type, color,
      is_initial AS isInitial, is_final AS isFinal, requires_approval AS requiresApproval
    FROM workflow_stages
    WHERE board_id = ?
    ORDER BY position
  `).bind(board.id).all<MissionWorkflowStage>()

  return { board, stages: results }
}

export async function getStageForType(env: Bindings, organizationId: string, boardId: string | null, type: MissionStageType) {
  if (boardId) {
    const stage = await env.DB.prepare(`
      SELECT stages.id, stages.board_id AS boardId, stages.name, stages.position, stages.type,
        stages.color, stages.is_initial AS isInitial, stages.is_final AS isFinal,
        stages.requires_approval AS requiresApproval
      FROM workflow_stages stages
      JOIN workflow_boards boards ON boards.id = stages.board_id
      WHERE stages.board_id = ? AND stages.type = ? AND boards.organization_id = ?
      LIMIT 1
    `).bind(boardId, type, organizationId).first<MissionWorkflowStage>()
    if (stage) return stage
  }

  const workflow = await ensureDefaultMissionWorkflow(env, organizationId)
  return workflow.stages.find((stage) => stage.type === type) ?? null
}

/**
 * Single source of truth for closing active timers on a mission.
 *
 * Finds all open time_entries (entry_type='timer', ended_at IS NULL) for the
 * given mission, calculates duration and cost using the user's hourly_rate,
 * and returns an array of D1 prepared statements to be included in a batch.
 *
 * - Idempotent: returns empty array if no timers are active.
 * - Protected against double-close: filters by ended_at IS NULL.
 * - Cost formula: (durationSeconds / 3600) * hourly_rate
 */
export async function closeActiveTimers(
  db: D1Database,
  missionId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<{ statements: D1PreparedStatement[]; totalCost: number }> {
  const { results: activeTimers } = await db.prepare(`
    SELECT entries.id, entries.user_id AS userId, entries.started_at AS startedAt
    FROM time_entries entries
    WHERE entries.mission_id = ? AND entries.organization_id = ?
      AND entries.entry_type = 'timer' AND entries.started_at IS NOT NULL AND entries.ended_at IS NULL
  `).bind(missionId, organizationId).all<{ id: string; userId: string; startedAt: string }>()

  if (!activeTimers.length) return { statements: [], totalCost: 0 }

  const nowIso = now.toISOString()
  const nowMs = now.getTime()
  const statements: D1PreparedStatement[] = []
  let totalCost = 0

  for (const timer of activeTimers) {
    const durationSeconds = Math.max(0, Math.floor((nowMs - Date.parse(timer.startedAt)) / 1000))
    const totalMinutes = Math.floor(durationSeconds / 60)

    const userRow = await db.prepare('SELECT hourly_rate FROM users WHERE id = ?').bind(timer.userId).first<{ hourly_rate: number }>()
    const hourlyRate = userRow?.hourly_rate || 0
    const cost = (durationSeconds / 3600) * hourlyRate
    totalCost += cost

    statements.push(
      db.prepare(`
        UPDATE time_entries
        SET ended_at = ?, duration_seconds = ?, hours = ?, minutes = ?, cost = ?
        WHERE id = ? AND organization_id = ? AND ended_at IS NULL
      `).bind(nowIso, durationSeconds, Math.floor(totalMinutes / 60), totalMinutes % 60, cost, timer.id, organizationId),
    )
  }

  if (totalCost > 0) {
    statements.push(
      db.prepare(`
        UPDATE missions
        SET realized_cost = realized_cost + ?
        WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE organization_id = ?)
      `).bind(totalCost, missionId, organizationId),
    )
  }

  return { statements, totalCost }
}
