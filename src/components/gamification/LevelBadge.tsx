import { useState } from 'react'
import type { GamificationLevel } from '../../../shared/gamificationLevels'
import { getGamificationBadgeUrl } from '../../data/gamificationBadges'

export type LevelBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export function LevelBadge({
  level,
  size = 'md',
  decorative = false,
  loading = 'lazy',
  className = '',
}: {
  level: GamificationLevel
  size?: LevelBadgeSize
  decorative?: boolean
  loading?: 'lazy' | 'eager'
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const label = `Selo do nível ${level.name}`
  const classes = `level-badge level-badge--${size}${className ? ` ${className}` : ''}`

  if (hasError) {
    return (
      <span className={classes} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
        <span className="level-badge__fallback" aria-hidden="true">{level.name.charAt(0)}</span>
      </span>
    )
  }

  return (
    <span className={classes} aria-hidden={decorative || undefined}>
      <img
        src={getGamificationBadgeUrl(level.id)}
        alt={decorative ? '' : label}
        loading={loading}
        onError={() => setHasError(true)}
      />
    </span>
  )
}
