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
