import type { Project } from '../../data/dashboard'

export function ClientMark({ project, className }: { project: Project; className: string }) {
  if (project.clientImageUrl) return <span className={`${className} client-mark has-image`}><img src={project.clientImageUrl} alt={`Perfil de ${project.client}`} /></span>
  return <span className={`${className} client-mark`}>{project.code}</span>
}
