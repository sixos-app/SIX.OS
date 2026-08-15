import { useState } from 'react'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { Avatar } from '../shared/Avatar'

export function TeamPage({ members, missions, projects, completed }: { members: TeamMember[]; missions: Mission[]; projects: Project[]; completed: string[] }) {
  const [teamFilter, setTeamFilter] = useState<'all' | 'available' | 'focus'>('all')
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? '')
  const visibleMembers = members.filter((member) => {
    if (teamFilter === 'all') return true
    return teamFilter === 'available' ? member.availability === 'Disponível' : member.availability === 'Em foco'
  })
  const selectedMember = visibleMembers.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? members[0]
  const openMissionCount = missions.filter((mission) => !completed.includes(mission.id)).length
  const membersWithOpenMissions = members.filter((member) => missions.some((mission) => mission.assigneeId === member.id && !completed.includes(mission.id))).length
  const selectedMemberMissions = missions.filter((mission) => mission.assigneeId === selectedMember?.id)

  if (!selectedMember) {
    return (
      <section className="team-page">
        <p className="empty-state">Ainda não há pessoas cadastradas na equipe.</p>
      </section>
    )
  }

  return (
    <section className="team-page">
      <div className="team-intro">
        <div>
          <p className="eyebrow">PESSOAS & POTENCIAL <span>✦</span></p>
          <h1>Quem torna<br /><em>possível.</em></h1>
        </div>
        <div className="team-summary">
          <span>MISSÕES EM ABERTO</span>
          <b>{openMissionCount}</b>
          <small>{membersWithOpenMissions} pessoas com entregas em andamento</small>
        </div>
      </div>
      <div className="team-toolbar">
        <div className="segmented-control" aria-label="Filtrar equipe">
          <button className={teamFilter === 'all' ? 'selected' : ''} onClick={() => setTeamFilter('all')}>Todos</button>
          <button className={teamFilter === 'available' ? 'selected' : ''} onClick={() => setTeamFilter('available')}>Disponíveis</button>
          <button className={teamFilter === 'focus' ? 'selected' : ''} onClick={() => setTeamFilter('focus')}>Em foco</button>
        </div>
        <span>{visibleMembers.length} pessoas nesta visão</span>
      </div>

      <div className="team-workspace">
        <div className="team-member-list">
          {visibleMembers.map((member) => {
            const isSelected = member.id === selectedMember.id
            const availabilityClass = member.availability === 'Disponível' ? 'available' : member.availability === 'No limite' ? 'limit' : 'focus'
            const memberMissions = missions.filter((mission) => mission.assigneeId === member.id)
            const memberOpenMissions = memberMissions.filter((mission) => !completed.includes(mission.id)).length
            return (
              <button className={`team-member-card ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedMemberId(member.id)} aria-pressed={isSelected} key={member.id}>
                <Avatar initials={member.initials} tone={member.tone} />
                <span className="team-member-copy">
                  <b>{member.name}</b>
                  <small>{member.role}</small>
                  <em>{memberOpenMissions > 0 ? `${memberOpenMissions} missão${memberOpenMissions > 1 ? 'ões' : ''} em aberto` : memberMissions.length > 0 ? 'Entregas concluídas' : 'Sem missões atribuídas'}</em>
                </span>
                <span className={`team-member-status ${availabilityClass}`}>{member.availability}</span>
                <span className="team-member-capacity">
                  <b>{member.capacity}%</b>
                  <i><span style={{ width: `${member.capacity}%` }} /></i>
                </span>
              </button>
            )
          })}
          {visibleMembers.length === 0 && <p className="empty-state">Nenhuma pessoa nesse filtro.</p>}
        </div>
        <aside className="team-detail">
          <div className="team-detail-profile">
            <Avatar initials={selectedMember.initials} tone={selectedMember.tone} />
            <div>
              <span>{selectedMember.availability}</span>
              <h2>{selectedMember.name}</h2>
              <p>{selectedMember.role}</p>
            </div>
          </div>
          <div className="team-detail-section">
            <span>FOCO ATUAL</span>
            <p>{selectedMember.focus}</p>
          </div>
          <div className="team-detail-section">
            <span>LEITURA DO RITMO</span>
            <p>{selectedMember.note}</p>
          </div>
          <div className="team-detail-section">
            <span>MISSÕES ATRIBUÍDAS</span>
            <div className="member-mission-list">
              {selectedMemberMissions.length > 0 ? (
                selectedMemberMissions.map((mission) => {
                  const project = projects.find((item) => item.id === mission.projectId)
                  const isComplete = completed.includes(mission.id)
                  return (
                    <article className={isComplete ? 'completed' : ''} key={mission.id}>
                      <div>
                        <b>{mission.title}</b>
                        <small>{project?.name ?? mission.client} · {mission.deadline}</small>
                      </div>
                      <span>{isComplete ? 'FEITA' : 'EM ABERTO'}</span>
                    </article>
                  )
                })
              ) : (
                <p className="member-mission-empty">Ainda não há missões atribuídas a esta pessoa.</p>
              )}
            </div>
          </div>
          <div className="team-detail-section">
            <span>PROJETOS EM ÓRBITA</span>
            <div className="member-projects">
              {selectedMember.projects.map((project) => (
                <b key={project}>{project}</b>
              ))}
            </div>
          </div>
          <div className="team-detail-capacity">
            <span>CAPACIDADE COMPROMETIDA</span>
            <b>{selectedMember.capacity}%</b>
            <i><span style={{ width: `${selectedMember.capacity}%` }} /></i>
          </div>
        </aside>
      </div>
    </section>
  )
}
