import { useEffect, useState } from 'react'
import type { ClientIdentity } from '../../data/clientRepository'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import type { WorkType } from '../../data/workTypeRepository'
import { usePermission } from '../../hooks/usePermission'
import { getProjectCollaborators, getProjectHealth } from '../../utils/formatters'
import { MissionCreateModal, type MissionCreationInput } from '../missions/MissionCreateModal'
import { Avatar } from '../shared/Avatar'
import { ClientMark } from '../shared/ClientMark'
import { ProjectCreateModal } from './ProjectCreateModal'
import { ProjectDashboardModal } from './ProjectDashboardModal'
import { ProjectLibraryModal } from './ProjectLibraryModal'
import { ProjectLifecycleModal } from './ProjectLifecycleModal'

export function ProjectsPage({
  projects,
  clients,
  workTypes,
  departments,
  initialSelectedProjectId,
  missions,
  completed,
  team,
  onCreateProject,
  onCreateMission,
  onUpdateProjectLifecycle,
  onDeleteProject,
}: {
  projects: Project[]
  clients: ClientIdentity[]
  workTypes?: WorkType[]
  departments: Array<{ id: string; name: string }>
  initialSelectedProjectId: string | null
  missions: Mission[]
  completed: string[]
  team: TeamMember[]
  onCreateProject: (input: { name: string; client: string; deadline: string; tone: Project['tone']; workTypeIds?: string[] }) => Promise<Project>
  onCreateMission: (input: MissionCreationInput) => Promise<void>
  onUpdateProjectLifecycle: (id: string, input: { status: string; deadline: string; nextStep: string }) => Promise<void>
  onDeleteProject: (id: string) => void
}) {
  const { can } = usePermission()
  const canManageMissions = can('missions.assign')
  const canDeleteProject = can('projects.delete')
  const [selectedProjectId, setSelectedProjectId] = useState(initialSelectedProjectId ?? projects[0]?.id ?? '')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
  const [isMissionCreateOpen, setIsMissionCreateOpen] = useState(false)
  const [missionCreateSession, setMissionCreateSession] = useState(0)
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const projectMissions = missions.filter((mission) => mission.projectId === selectedProject?.id)
  const projectCollaborators = selectedProject ? getProjectCollaborators(selectedProject, missions, team) : []
  const projectHealth = selectedProject ? getProjectHealth(selectedProject, missions, completed) : { label: 'A INICIAR', tone: 'neutral' }

  useEffect(() => {
    if (initialSelectedProjectId && projects.some((project) => project.id === initialSelectedProjectId)) setSelectedProjectId(initialSelectedProjectId)
  }, [initialSelectedProjectId, projects])

  if (!selectedProject) {
    return (
      <section className="projects-page">
        <div className="projects-intro">
          <div>
            <p className="eyebrow">CENTRAL DE PROJETOS <span>✦</span></p>
            <h1>Ideias em<br /><em>órbita.</em></h1>
          </div>
          <div className="projects-intro-actions">
            <button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA FRENTE <span>+</span></button>
            <p>Crie a primeira frente para organizar missões, responsáveis e arquivos.</p>
          </div>
        </div>
        <p className="empty-state">Ainda não há projetos para acompanhar.</p>
        {isCreateOpen && (
          <ProjectCreateModal
            clients={clients}
            workTypes={workTypes}
            onClose={() => setIsCreateOpen(false)}
            onCreate={async (input) => {
              const project = await onCreateProject(input)
              setSelectedProjectId(project.id)
              return project
            }}
          />
        )}
      </section>
    )
  }

  return (
    <section className="projects-page">
      <div className="projects-intro">
        <div>
          <p className="eyebrow">CENTRAL DE PROJETOS <span>✦</span></p>
          <h1>Ideias em<br /><em>órbita.</em></h1>
        </div>
        <div className="projects-intro-actions">
          <button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA FRENTE <span>+</span></button>
          <p>Cada frente reúne as missões atribuídas ao time, com progresso calculado pelas entregas concluídas.</p>
        </div>
      </div>

      <div className="project-overview">
        <div className="project-list-panel">
          <div className="projects-toolbar">
            <span>PROJETOS ATIVOS</span>
            <b>{projects.length}</b>
          </div>
          <div className="project-list">
            {projects.map((project) => {
              const isSelected = project.id === selectedProject.id
              return (
                <button
                  className={`project-list-card tone-${project.tone} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedProjectId(project.id)}
                  aria-pressed={isSelected}
                  key={project.id}
                >
                  <ClientMark project={project} className="project-list-code" />
                  <span className="project-list-copy">
                    <small>{project.status}</small>
                    <b>{project.name}</b>
                    <em>{project.deadline}</em>
                  </span>
                  <span className="project-list-progress">
                    <b>{project.progress}%</b>
                    <i><span style={{ width: `${project.progress}%` }} /></i>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className={`project-detail tone-${selectedProject.tone}`}>
          <div className="project-detail-header">
            <span>{selectedProject.status}</span>
            <ClientMark project={selectedProject} className="project-detail-client-mark" />
          </div>
          <h2>{selectedProject.name}</h2>
          <p className="project-client">{selectedProject.client}</p>
          <div className="project-detail-progress">
            <div>
              <span>PROGRESSO GERAL</span>
              <b>{selectedProject.progress}%</b>
            </div>
            <i><span style={{ width: `${selectedProject.progress}%` }} /></i>
          </div>
          <div className={`project-health project-health-${projectHealth.tone}`}>
            <span>SAÚDE DA FRENTE</span>
            <b>{projectHealth.label}</b>
          </div>
          <div className="project-detail-section">
            <span>PRÓXIMO MOVIMENTO</span>
            <p>{selectedProject.nextStep}</p>
          </div>
          <div className="project-detail-section">
            <span>ÚLTIMA ATUALIZAÇÃO</span>
            <p>{selectedProject.activity}</p>
          </div>
          <div className="project-detail-section">
            <div className="project-missions-heading">
              <span>MISSÕES ATRIBUÍDAS</span>
              {canManageMissions && <button onClick={() => { setMissionCreateSession((current) => current + 1); setIsMissionCreateOpen(true) }}>NOVA MISSÃO <b>+</b></button>}
            </div>
            <div className="project-mission-list">
              {projectMissions.length > 0 ? (
                projectMissions.map((mission) => {
                  const assignee = team.find((member) => member.id === mission.assigneeId)
                  const isComplete = completed.includes(mission.id)
                  return (
                    <article className={isComplete ? 'completed' : ''} key={mission.id}>
                      <div>
                        <b>{mission.title}</b>
                        <small>{assignee ? assignee.name : 'Responsável a definir'}</small>
                      </div>
                      <span>{isComplete ? 'FEITA' : 'EM ABERTO'}</span>
                    </article>
                  )
                })
              ) : (
                <p className="project-mission-empty">Esta frente ainda não tem missões.</p>
              )}
            </div>
          </div>
          <button className="project-library-button" style={{ background: '#171717', color: '#c6ff38', marginBottom: '8px' }} onClick={() => setIsDashboardOpen(true)}>
            DASHBOARD DO PROJETO 📊
          </button>
          <button className="project-library-button" onClick={() => setIsLibraryOpen(true)}>
            BIBLIOTECA DO PROJETO <span>↗</span>
          </button>
          <button className="project-lifecycle-button" onClick={() => setIsLifecycleOpen(true)}>
            GERENCIAR CICLO DA FRENTE <span>↗</span>
          </button>
          <div className="project-detail-footer">
            <div className="avatars">
              {projectCollaborators.slice(0, 3).map((member, index) => (
                <Avatar initials={member.initials} tone={index === 1 ? 'lime' : member.tone} small key={member.id} />
              ))}
              {projectCollaborators.length > 3 && <span>+{projectCollaborators.length - 3}</span>}
            </div>
            <small>{projectCollaborators.length === 1 ? '1 pessoa na frente' : `${projectCollaborators.length} pessoas na frente`}</small>
          </div>
        </aside>
      </div>
      {isCreateOpen && (
        <ProjectCreateModal
          clients={clients}
          workTypes={workTypes}
          onClose={() => setIsCreateOpen(false)}
          onCreate={onCreateProject}
        />
      )}
      {isDashboardOpen && (
        <ProjectDashboardModal
          project={selectedProject}
          missions={missions}
          completed={completed}
          team={team}
          workTypes={workTypes}
          onClose={() => setIsDashboardOpen(false)}
        />
      )}
      {isMissionCreateOpen && (
        <MissionCreateModal
          key={missionCreateSession}
          projects={projects}
          team={team}
          workTypes={workTypes}
          departments={departments}
          initialProjectId={selectedProject.id}
          onClose={() => setIsMissionCreateOpen(false)}
          onCreate={onCreateMission}
        />
      )}
      {isLifecycleOpen && (
        <ProjectLifecycleModal
          project={selectedProject}
          onClose={() => setIsLifecycleOpen(false)}
          onUpdate={(input) => onUpdateProjectLifecycle(selectedProject.id, input)}
          canDelete={canDeleteProject}
          onDelete={() => { setIsLifecycleOpen(false); onDeleteProject(selectedProject.id); }}
        />
      )}
      {isLibraryOpen && (
        <ProjectLibraryModal
          project={selectedProject}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}
    </section>
  )
}
