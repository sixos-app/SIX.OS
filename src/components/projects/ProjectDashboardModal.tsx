import { useEffect } from 'react'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { formatWorkTypeMinutes, WORK_TYPE_COLORS, type WorkType } from '../../data/workTypeRepository'
import { ClientMark } from '../shared/ClientMark'

export function ProjectDashboardModal({
  project,
  missions,
  completed,
  team,
  workTypes,
  onClose,
}: {
  project: Project
  missions: Mission[]
  completed: string[]
  team: TeamMember[]
  workTypes?: WorkType[]
  onClose: () => void
}) {
  const projectMissions = missions.filter((mission) => mission.projectId === project.id)
  const completedMissions = projectMissions.filter((mission) => completed.includes(mission.id))
  const activeMemberCount = team.filter((member) => projectMissions.some((mission) => mission.assigneeId === member.id)).length

  const colorMap = Object.fromEntries(WORK_TYPE_COLORS.map((c) => [c.key, c.hex]))

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const milestones = projectMissions.slice(0, 6).map((mission) => ({
    title: mission.title,
    desc: mission.deadline,
    reached: completed.includes(mission.id),
  }))

  return (
    <div className="mission-create-overlay project-library-overlay" role="dialog" aria-modal="true" aria-label={`Dashboard do projeto ${project.name}`}>
      <style>{`
        .dashboard-grid-layout {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          margin-top: 24px;
        }
        .metrics-grid-layout {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 24px;
        }
        @media (max-width: 780px) {
          .dashboard-grid-layout {
            grid-template-columns: 1fr;
          }
          .metrics-grid-layout {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
      <section className="project-library-dialog" style={{ width: 'min(920px, 100%)' }}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar dashboard do projeto">×</button>
        <div className="project-library-head">
          <div>
            <span>DASHBOARD DO PROJETO 📊</span>
            <h2>{project.name}</h2>
            <p>{project.client} · {project.code}</p>
          </div>
          <ClientMark project={project} className="project-library-client-mark" />
        </div>

        <div className="metrics-grid-layout">
          <article className="profile-stat-card highlight" style={{ background: '#171717', borderColor: '#171717', color: '#fff', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#c6ff38', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>PROGRESSO</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '26px', color: '#fff', letterSpacing: '-1.4px' }}>{project.progress}%</b>
            <small style={{ display: 'block', marginTop: '2px', color: '#a5a59e', fontSize: '10px' }}>Missões entregues</small>
          </article>
          <article className="profile-stat-card" style={{ background: '#fffefa', border: '1px solid #e1e1da', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#85857e', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>STATUS DO CICLO</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '16px', color: project.status === 'CONCLUÍDO' ? '#8b73ff' : '#171717', letterSpacing: '-0.5px' }}>{project.status}</b>
            <small style={{ display: 'block', marginTop: '2px', color: '#a5a59e', fontSize: '10px' }}>Saúde da frente</small>
          </article>
          <article className="profile-stat-card" style={{ background: '#fffefa', border: '1px solid #e1e1da', padding: '18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#85857e', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>MISSÕES</span>
              <b style={{ fontSize: '16px', color: '#171717', letterSpacing: '-0.5px' }}>{completedMissions.length} / {projectMissions.length}</b>
            </div>
            <div style={{ height: '6px', background: '#e2e2db', borderRadius: '3px', overflow: 'hidden', margin: '8px 0' }}>
              <div style={{ height: '100%', width: `${projectMissions.length ? Math.round((completedMissions.length / projectMissions.length) * 100) : 0}%`, background: '#8b73ff', borderRadius: 'inherit' }} />
            </div>
            <small style={{ color: '#a5a59e', fontSize: '9px' }}>Dados persistidos da execução</small>
          </article>
          <article className="profile-stat-card highlight" style={{ background: '#8b73ff', borderColor: '#8b73ff', color: '#fff', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#fff', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>EQUIPE ATIVA</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '20px', color: '#fff', letterSpacing: '-1px' }}>{activeMemberCount}</b>
            <small style={{ display: 'block', marginTop: '2px', color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>Responsáveis com missões nesta frente</small>
          </article>
        </div>

        <div className="dashboard-grid-layout">
          <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', fontWeight: 'bold' }}>MISSÕES & ENTREGÁVEIS</span>
              <span style={{ fontSize: '10px' }}>{completedMissions.length}/{projectMissions.length} concluídas</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {projectMissions.map((m) => {
                const isDone = completed.includes(m.id)
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <b style={{ fontSize: '11px', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#85857e' : '#fff' }}>{m.title}</b>
                      <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#85857e' }}>XP Recompensa: {m.xp} XP</p>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: isDone ? '#c6ff38' : m.approvalStatus === 'pending' ? '#ffd76a' : '#85857e', background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                      {isDone ? 'CONCLUÍDA' : m.approvalStatus === 'pending' ? 'EM APROVAÇÃO' : 'EM ABERTO'}
                    </span>
                  </div>
                )
              })}
              {projectMissions.length === 0 && <p style={{ fontSize: '11px', color: '#85857e', textAlign: 'center', padding: '20px' }}>Nenhuma missão criada para esta frente.</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
            {project.workTypeIds && project.workTypeIds.length > 0 && (
              <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', color: '#fff' }}>
                <span style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', fontWeight: 'bold', display: 'block', marginBottom: '12px' }}>
                  TIPOS DE TRABALHO HABILITADOS
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {project.workTypeIds.map((wtId) => {
                    const wt = workTypes?.find((t) => t.id === wtId)
                    if (!wt) return null
                    return (
                      <span key={wt.id} className="work-type-chip">
                        <span className="work-type-color-badge" style={{ backgroundColor: colorMap[wt.colorKey] ?? '#c6ff38' }} />
                        <b>{wt.name}</b>
                        <small style={{ color: '#888', marginLeft: '4px' }}>({formatWorkTypeMinutes(wt.defaultMinutes)})</small>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', color: '#fff' }}>
              <span style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', fontWeight: 'bold', display: 'block', marginBottom: '16px' }}>PRÓXIMAS ENTREGAS</span>
              <div style={{ display: 'grid', gap: '14px', position: 'relative' }}>
                {milestones.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                    <div style={{ display: 'grid', placeItems: 'center', width: '20px', height: '20px', borderRadius: '50%', background: m.reached ? '#8b73ff' : '#3c3c38', fontSize: '9px', fontWeight: 'bold', color: '#fff' }}>
                      {m.reached ? '✓' : idx + 1}
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      <b style={{ color: m.reached ? '#fff' : '#85857e' }}>{m.title}</b>
                      <p style={{ margin: '2px 0 0', color: '#85857e', fontSize: '10px' }}>{m.desc}</p>
                    </div>
                  </div>
                ))}
                {milestones.length === 0 && <p style={{ color: '#85857e', fontSize: '10px' }}>Nenhuma entrega planejada.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
