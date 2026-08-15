import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { getProjectCollaborators } from '../../utils/formatters'
import { Avatar } from '../shared/Avatar'
import { ClientMark } from '../shared/ClientMark'

export function ProjectCard({ project, missions, team, onOpen }: { project: Project; missions: Mission[]; team: TeamMember[]; onOpen: () => void }) {
  const coverTone = project.tone === 'lime' ? 'project-green' : `project-${project.tone}`
  const collaborators = getProjectCollaborators(project, missions, team)

  return (
    <article className={`project-card ${coverTone}`}>
      <div className="project-cover">
        <ClientMark project={project} className="project-cover-mark" />
        <i />
        <p>TORNAR<br />POSSÍVEL</p>
      </div>
      <div className="project-details">
        <div>
          <p>{project.status}</p>
          <h3>{project.name}</h3>
        </div>
        <b>{project.progress}%</b>
      </div>
      <div className="project-progress">
        <i style={{ width: `${project.progress}%` }} />
      </div>
      <div className="project-footer">
        <div className="avatars">
          {collaborators.slice(0, 3).map((member, index) => (
            <Avatar initials={member.initials} tone={index === 1 ? 'lime' : member.tone} small key={member.id} />
          ))}
          {collaborators.length > 3 && <span>+{collaborators.length - 3}</span>}
        </div>
        <button onClick={onOpen}>ABRIR PROJETO <span>↗</span></button>
      </div>
    </article>
  )
}
