import { useEffect } from 'react'
import type { DashboardData } from '../../data/dashboard'
import type { LevelConfigItem } from '../../data/profileRepository'

export function JourneyPanel({
  profile,
  completedCount,
  missionCount,
  totalXp,
  onClose,
}: {
  profile: DashboardData['profile'] & { levelConfig?: LevelConfigItem[] | null }
  completedCount: number
  missionCount: number
  totalXp: number
  onClose: () => void
}) {
  const milestones = profile.levelConfig ?? [
    { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
    { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
    { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' },
  ]
  const currentMilestone = [...milestones].reverse().find((milestone) => totalXp >= milestone.target) ?? milestones[0]
  const nextMilestone = milestones.find((milestone) => milestone.target > totalXp)
  const progressStart = currentMilestone.target
  const progressEnd = nextMilestone?.target ?? currentMilestone.target + 3000
  const progress = Math.min(100, ((totalXp - progressStart) / (progressEnd - progressStart)) * 100)
  const achievements = [
    { title: 'Ritmo extraordinário', detail: 'Energia sustentada acima de 90%.', unlocked: true },
    { title: 'Entrega de impacto', detail: `${completedCount} de ${missionCount} missões concluídas.`, unlocked: completedCount > 0 },
    { title: 'Visão de futuro', detail: 'Alcance 12.000 XP para desbloquear.', unlocked: totalXp >= 12000 },
  ]

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="journey-overlay" role="dialog" aria-modal="true" aria-label="Minha jornada">
      <div className="journey-dialog">
        <button className="close-button" onClick={onClose} aria-label="Fechar jornada">×</button>
        <div className="journey-hero">
          <span>SEU NÍVEL ATUAL</span>
          <div className="journey-level-mark">{currentMilestone.name.charAt(0)}</div>
          <p>{currentMilestone.name.toUpperCase()}</p>
          <h2>{currentMilestone.detail}</h2>
          <small>{profile.ideas.toLocaleString('pt-BR')} ideias registradas até aqui.</small>
        </div>
        <div className="journey-progress">
          <div>
            <span>{totalXp.toLocaleString('pt-BR')} XP</span>
            <b>{nextMilestone ? `Faltam ${(nextMilestone.target - totalXp).toLocaleString('pt-BR')} XP para ${nextMilestone.name}` : 'Você alcançou o nível máximo atual.'}</b>
          </div>
          <i><span style={{ width: `${progress}%` }} /></i>
          <div className="journey-milestones">
            {milestones.map((milestone) => (
              <span className={totalXp >= milestone.target ? 'reached' : ''} key={milestone.name}>
                <b>{milestone.name}</b>
                <small>{milestone.target.toLocaleString('pt-BR')} XP</small>
              </span>
            ))}
          </div>
        </div>
        <div className="journey-achievements">
          <div>
            <span>CONQUISTAS</span>
            <h3>O que você já<br /><em>tornou possível.</em></h3>
          </div>
          <div className="achievement-list">
            {achievements.map((achievement) => (
              <article className={achievement.unlocked ? 'unlocked' : ''} key={achievement.title}>
                <span>{achievement.unlocked ? '✦' : '○'}</span>
                <div>
                  <b>{achievement.title}</b>
                  <p>{achievement.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
