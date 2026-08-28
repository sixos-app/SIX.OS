import { useEffect } from 'react'
import type { DashboardData } from '../../data/dashboard'
import { GAMIFICATION_LEVELS, getLevelProgress } from '../../../shared/gamificationLevels'

export function JourneyPanel({
  profile,
  completedCount,
  missionCount,
  totalXp,
  onClose,
}: {
  profile: DashboardData['profile']
  completedCount: number
  missionCount: number
  totalXp: number
  onClose: () => void
}) {
  const levelProgress = getLevelProgress(totalXp)
  const { currentLevel: currentMilestone, nextLevel: nextMilestone } = levelProgress
  const achievements = [
    { title: 'Ritmo extraordinário', detail: 'Energia sustentada acima de 90%.', unlocked: true },
    { title: 'Entrega de impacto', detail: `${completedCount} de ${missionCount} missões concluídas.`, unlocked: completedCount > 0 },
    { title: 'Visão de futuro', detail: `Alcance ${GAMIFICATION_LEVELS[2]!.minXp.toLocaleString('pt-BR')} XP para desbloquear.`, unlocked: totalXp >= GAMIFICATION_LEVELS[2]!.minXp },
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
          <h2>{currentMilestone.description}</h2>
          <small>{profile.ideas.toLocaleString('pt-BR')} ideias registradas até aqui.</small>
        </div>
        <div className="journey-progress">
          <div>
            <span>{totalXp.toLocaleString('pt-BR')} XP</span>
            <b>{nextMilestone ? `Faltam ${levelProgress.xpRemaining.toLocaleString('pt-BR')} XP para ${nextMilestone.name}` : 'Você alcançou o nível máximo atual.'}</b>
          </div>
          <i><span style={{ width: `${levelProgress.progressPercent}%` }} /></i>
          <div className="journey-milestones">
            {GAMIFICATION_LEVELS.map((milestone) => (
              <span className={totalXp >= milestone.minXp ? 'reached' : ''} key={milestone.id}>
                <b>{milestone.name}</b>
                <small>{milestone.minXp.toLocaleString('pt-BR')} XP</small>
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
