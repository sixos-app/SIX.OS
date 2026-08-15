import { accessRequiredResponse, getAccessUser, getPermissionScope, permissionRequiredResponse, type Bindings } from './_access'
import { ensureDefaultMissionWorkflow, type MissionStageType } from './missions/_missionWorkflow'

type BoardRow = {
  id: string
  name: string
  slug: string
  isDefault: number
}

type StageRow = {
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

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await getPermissionScope(env, request, user, 'missions.view'))) return permissionRequiredResponse()
  await ensureDefaultMissionWorkflow(env, user.organizationId)

  const [boards, stages] = await Promise.all([
    env.DB.prepare(`
      SELECT id, name, slug, is_default AS isDefault
      FROM workflow_boards
      WHERE organization_id = ?
      ORDER BY is_default DESC, name
    `).bind(user.organizationId).all<BoardRow>(),
    env.DB.prepare(`
      SELECT stages.id, stages.board_id AS boardId, stages.name, stages.position, stages.type,
        stages.color, stages.is_initial AS isInitial, stages.is_final AS isFinal,
        stages.requires_approval AS requiresApproval
      FROM workflow_stages stages
      JOIN workflow_boards boards ON boards.id = stages.board_id
      WHERE boards.organization_id = ?
      ORDER BY boards.is_default DESC, boards.name, stages.position
    `).bind(user.organizationId).all<StageRow>(),
  ])

  return Response.json({
    boards: boards.results.map((board) => ({
      ...board,
      isDefault: Boolean(board.isDefault),
      stages: stages.results
        .filter((stage) => stage.boardId === board.id)
        .map((stage) => ({
          ...stage,
          isInitial: Boolean(stage.isInitial),
          isFinal: Boolean(stage.isFinal),
          requiresApproval: Boolean(stage.requiresApproval),
        })),
    })),
  })
}
