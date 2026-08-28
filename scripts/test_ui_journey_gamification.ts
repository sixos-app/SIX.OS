import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { GAMIFICATION_LEVELS, getLevelProgress } from '../shared/gamificationLevels.ts'
import { getGamificationBadgeUrl } from '../src/data/gamificationBadges.ts'

const journey = await readFile(new URL('../src/components/profile/JourneyPanel.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/components/dashboard/DashboardPage.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

assert.equal(GAMIFICATION_LEVELS.length, 25)
assert.deepEqual(GAMIFICATION_LEVELS.map(level => level.level), Array.from({ length: 25 }, (_, index) => index + 1))
assert.equal(new Set(GAMIFICATION_LEVELS.map(level => level.id)).size, 25)
assert.equal(new Set(GAMIFICATION_LEVELS.map(level => level.name)).size, 25)
assert.equal(new Set(GAMIFICATION_LEVELS.map(level => level.minXp)).size, 25)
assert.ok(GAMIFICATION_LEVELS.every(level => level.description.length > 0))

for (const [xp, expectedCurrentLevel, expectedConquered, expectedLocked] of [
  [0, 1, 0, 24],
  [8700, 2, 1, 23],
  [103000, 16, 15, 9],
  [216000, 25, 24, 0],
  [500000, 25, 24, 0],
] as const) {
  const progress = getLevelProgress(xp)
  const states = GAMIFICATION_LEVELS.map(level => level.id === progress.currentLevel.id ? 'current' : level.level < progress.currentLevel.level ? 'conquered' : 'locked')
  assert.equal(progress.currentLevel.level, expectedCurrentLevel)
  assert.equal(states.filter(state => state === 'current').length, 1)
  assert.equal(states.filter(state => state === 'conquered').length, expectedConquered)
  assert.equal(states.filter(state => state === 'locked').length, expectedLocked)
}

for (const level of GAMIFICATION_LEVELS) assert.equal(getGamificationBadgeUrl(level.id), `/gamification/levels/${level.id}.png`)
assert.equal(getGamificationBadgeUrl('05-impulsionador'), '/gamification/levels/05-impulsionador.png')
assert.equal(getGamificationBadgeUrl('16-transformador'), '/gamification/levels/16-transformador.png')
assert.equal(getGamificationBadgeUrl('25-originador'), '/gamification/levels/25-originador.png')

assert.match(journey, /GAMIFICATION_LEVELS\.map/)
assert.match(journey, /<LevelBadge level=\{level\} size="sm" decorative loading="lazy" \/>/)
assert.match(journey, /<LevelBadge level=\{currentLevel\} size="lg" decorative loading="lazy" \/>/)
assert.match(journey, /<div className="journey-hero-copy">[\s\S]*?<\/div>\n          <div className="journey-hero-badge">/)
assert.ok(journey.indexOf('className="journey-hero-copy"') < journey.indexOf('className="journey-hero-badge"'))
assert.ok(journey.indexOf('className="journey-hero-badge"') < journey.indexOf('className="journey-progress"'))
assert.match(journey, /journey-level-card--\$\{state\}/)
assert.match(journey, /journeyStateLabels\[state\]/)
assert.match(journey, /level\.description/)
assert.match(journey, /level\.minXp\.toLocaleString\('pt-BR'\)/)
assert.match(journey, /role="dialog" aria-modal="true" aria-label="Minha jornada"/)
assert.match(journey, /aria-label="Fechar jornada"/)
assert.match(journey, /if \(event\.key === 'Escape'\) onClose\(\)/)
assert.doesNotMatch(journey, /\?\?\?/) 
assert.doesNotMatch(journey, /Ritmo extraordinário|Energia sustentada acima de 90%|unlocked: true/)
assert.match(dashboard, /VER MINHA JORNADA/)

assert.match(styles, /\.journey-levels \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s)
assert.match(styles, /\.journey-level-card \{[^}]*min-width: 0/s)
assert.match(styles, /\.journey-level-card--locked \{ opacity: \.67; \}/)
assert.match(styles, /@media \(max-width: 780px\) \{ \.journey-levels \{ grid-template-columns: 1fr;/)
assert.doesNotMatch(styles, /\.journey-levels[^\n]*overflow-y|\.journey-level-card[^\n]*overflow-y/)

const journeyHeroStart = styles.indexOf('/* GAM-4.3: stable Home and Journey hero compositions. */')
const journeyHeroContract = journeyHeroStart >= 0 ? styles.slice(journeyHeroStart, journeyHeroStart + 5000) : ''
assert.ok(journeyHeroContract.length > 0)
assert.match(journeyHeroContract, /\.journey-hero \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?grid-template-areas: "copy badge";/)
assert.match(journeyHeroContract, /\.journey-hero-copy \{[^}]*grid-area: copy;/)
assert.match(journeyHeroContract, /\.journey-hero-badge \{[\s\S]*?grid-area: badge;[\s\S]*?background: transparent;[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/)
assert.match(journeyHeroContract, /@media \(max-width: 780px\) \{[\s\S]*?\.journey-hero \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?grid-template-areas: "copy badge";/)
assert.doesNotMatch(journeyHeroContract, /\.journey-(?:hero-copy|hero-badge)[\s\S]{0,180}position:\s*absolute/)

console.log('✅ JOURNEY GAMIFICATION: 25 níveis, estados, badges lazy, conteúdo oficial e contrato responsivo verificados.')
