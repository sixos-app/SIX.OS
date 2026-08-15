import { useState } from 'react'
import type { AnalyticsData, Mission, Project, TeamMember } from '../../data/dashboard'
import { getProjectHealth } from '../../utils/formatters'
import { Avatar } from '../shared/Avatar'

export function AnalyticsPage({
  analytics,
  projects,
  missions,
  team,
  completed,
  totalXp,
  baseXp,
}: {
  analytics: AnalyticsData
  projects: Project[]
  missions: Mission[]
  team: TeamMember[]
  completed: string[]
  totalXp: number
  baseXp: number
}) {
  const [metric, setMetric] = useState<'xp' | 'focus'>('xp')
  const weeklyMaximum = Math.max(...analytics.weekly.map((point) => metric === 'xp' ? point.xp : point.focus))
  const weeklyTotal = analytics.weekly.reduce((total, point) => total + point.xp, 0)
  const earnedXp = totalXp - baseXp
  const completedMissionCount = missions.filter((mission) => completed.includes(mission.id)).length
  const deliveryRate = missions.length > 0 ? Math.round((completedMissionCount / missions.length) * 100) : 0
  const activeContributors = team.filter((member) => missions.some((mission) => mission.assigneeId === member.id && !completed.includes(mission.id))).length
  const healthyProjectCount = projects.filter((project) => getProjectHealth(project, missions, completed).tone === 'healthy').length
  const teamDelivery = team.map((member) => {
    const assignedMissions = missions.filter((mission) => mission.assigneeId === member.id)
    const completedCount = assignedMissions.filter((mission) => completed.includes(mission.id)).length
    return { member, assignedCount: assignedMissions.length, completedCount, openCount: assignedMissions.length - completedCount }
  }).filter(({ assignedCount }) => assignedCount > 0)
  const projectDelivery = projects.map((project) => {
    const assignedMissions = missions.filter((mission) => mission.projectId === project.id)
    const completedCount = assignedMissions.filter((mission) => completed.includes(mission.id)).length
    return { project, assignedCount: assignedMissions.length, completedCount, health: getProjectHealth(project, missions, completed) }
  })

  return (
    <section className="analytics-page">
      <div className="analytics-intro">
        <div>
          <p className="eyebrow">SEU IMPACTO <span>✦</span></p>
          <h1>Evolução que<br /><em>ganha forma.</em></h1>
        </div>
        <div className="analytics-streak">
          <span>SEQUÊNCIA CRIATIVA</span>
          <b>{analytics.streak} dias</b>
          <small>Você manteve o ritmo em toda a semana.</small>
        </div>
      </div>
      <div className="analytics-metrics">
        <button className={`analytics-metric ${metric === 'xp' ? 'selected' : ''}`} onClick={() => setMetric('xp')}>
          <span>XP DA SEMANA</span>
          <b>+{(weeklyTotal + earnedXp).toLocaleString('pt-BR')}</b>
          <small>ritmo consistente <i>↗</i></small>
        </button>
        <button className={`analytics-metric ${metric === 'focus' ? 'selected' : ''}`} onClick={() => setMetric('focus')}>
          <span>FOCO MÉDIO</span>
          <b>{Math.round(analytics.weekly.reduce((total, point) => total + point.focus, 0) / analytics.weekly.length)}%</b>
          <small>{activeContributors === 1 ? '1 pessoa em ação' : `${activeContributors} pessoas em ação`}</small>
        </button>
        <div className="analytics-metric static">
          <span>ENTREGAS CONCLUÍDAS</span>
          <b>{deliveryRate}%</b>
          <small>{completedMissionCount} de {missions.length} missões concluídas</small>
        </div>
        <div className="analytics-metric static">
          <span>FRENTES SAUDÁVEIS</span>
          <b>{healthyProjectCount}/{projects.length}</b>
          <small>frentes no ritmo ou concluídas</small>
        </div>
      </div>

      <div className="analytics-workspace">
        <div className="analytics-chart-card">
          <div className="analytics-chart-head">
            <div>
              <span>EVOLUÇÃO SEMANAL</span>
              <h2>{metric === 'xp' ? 'XP conquistados' : 'Ritmo de foco'}</h2>
            </div>
            <button className="chart-toggle" onClick={() => setMetric(metric === 'xp' ? 'focus' : 'xp')}>
              VER {metric === 'xp' ? 'FOCO' : 'XP'} <span>↔</span>
            </button>
          </div>
          <div className="analytics-chart" aria-label={metric === 'xp' ? 'Gráfico de XP semanal' : 'Gráfico de foco semanal'}>
            {analytics.weekly.map((point) => {
              const value = metric === 'xp' ? point.xp : point.focus
              const height = Math.max(8, (value / weeklyMaximum) * 100)
              return (
                <div className="analytics-bar" key={point.label}>
                  <span>{metric === 'xp' ? `+${value}` : `${value}%`}</span>
                  <i><b style={{ height: `${height}%` }} /></i>
                  <small>{point.label}</small>
                </div>
              )
            })}
          </div>
        </div>
        <aside className="project-health-card">
          <span>SAÚDE DOS PROJETOS</span>
          <h2>Carteira em<br /><em>movimento.</em></h2>
          <div>
            {projectDelivery.map(({ project, health }) => (
              <article key={project.id}>
                <div>
                  <b>{project.name}</b>
                  <small>{health.label} · {project.status}</small>
                </div>
                <strong>{project.progress}%</strong>
                <i><span style={{ width: `${project.progress}%` }} /></i>
              </article>
            ))}
          </div>
        </aside>
      </div>
      <div className="analytics-breakdown">
        <section className="analytics-breakdown-card">
          <span>ENTREGAS POR PESSOA</span>
          <h2>Quem está<br /><em>movendo a frente.</em></h2>
          <div>
            {teamDelivery.map(({ member, assignedCount, completedCount, openCount }) => (
              <article key={member.id}>
                <Avatar initials={member.initials} tone={member.tone} small />
                <div>
                  <b>{member.name}</b>
                  <small>{completedCount} concluída{completedCount === 1 ? '' : 's'} · {openCount} em aberto</small>
                </div>
                <strong>{completedCount}/{assignedCount}</strong>
              </article>
            ))}
            {teamDelivery.length === 0 && <p className="analytics-empty">Ainda não há missões atribuídas.</p>}
          </div>
        </section>
        <section className="analytics-breakdown-card">
          <span>ENTREGAS POR FRENTE</span>
          <h2>Onde o trabalho<br /><em>ganha forma.</em></h2>
          <div>
            {projectDelivery.map(({ project, assignedCount, completedCount, health }) => (
              <article key={project.id}>
                <span className={`analytics-health-dot ${health.tone}`} />
                <div>
                  <b>{project.name}</b>
                  <small>{health.label} · {completedCount}/{assignedCount || 0} entregas concluídas</small>
                </div>
                <strong>{project.progress}%</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
