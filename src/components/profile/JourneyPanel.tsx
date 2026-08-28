import { useEffect } from 'react'
import type { DashboardData } from '../../data/dashboard'
import { GAMIFICATION_LEVELS, getLevelProgress, type GamificationLevel } from '../../../shared/gamificationLevels'
import { LevelBadge } from '../gamification/LevelBadge'

export type JourneyLevelState = 'conquered' | 'current' | 'locked'

export function getJourneyLevelState(level: GamificationLevel, currentLevel: GamificationLevel): JourneyLevelState {
  if (level.id === currentLevel.id) return 'current'
  return level.level < currentLevel.level ? 'conquered' : 'locked'
}

const journeyStateLabels: Record<JourneyLevelState, string> = {
  conquered: 'CONQUISTADO',
  current: 'ATUAL',
  locked: 'BLOQUEADO',
}

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
  const { currentLevel, nextLevel } = levelProgress
  const achievements = [
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
          <div className="journey-hero-badge"><LevelBadge level={currentLevel} size="lg" decorative loading="lazy" /></div>
          <p>{currentLevel.name.toUpperCase()}</p>
          <h2>{currentLevel.description}</h2>
          <small>{profile.ideas.toLocaleString('pt-BR')} ideias registradas até aqui.</small>
        </div>
        <div className="journey-progress">
          <div>
            <span>{totalXp.toLocaleString('pt-BR')} XP</span>
            <b>{nextLevel ? `Faltam ${levelProgress.xpRemaining.toLocaleString('pt-BR')} XP para ${nextLevel.name}` : 'Você alcançou o nível máximo atual.'}</b>
          </div>
          <i><span style={{ width: `${levelProgress.progressPercent}%` }} /></i>
        </div>
        <section className="journey-levels" aria-label="Níveis da jornada">
          {GAMIFICATION_LEVELS.map((level) => {
            const state = getJourneyLevelState(level, currentLevel)
            return <article className={`journey-level-card journey-level-card--${state}`} data-level-id={level.id} key={level.id}>
              <LevelBadge level={level} size="sm" decorative loading="lazy" />
              <div className="journey-level-card__content">
                <span>{journeyStateLabels[state]}</span>
                <h3>{level.level.toString().padStart(2, '0')} · {level.name}</h3>
                <p>{level.description}</p>
                <small>{level.minXp.toLocaleString('pt-BR')} XP</small>
              </div>
            </article>
          })}
        </section>
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
