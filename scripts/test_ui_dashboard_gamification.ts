import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getLevelProgress } from '../shared/gamificationLevels.ts'
import { getGamificationBadgeUrl } from '../src/data/gamificationBadges.ts'

const dashboard = await readFile(new URL('../src/components/dashboard/DashboardPage.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

for (const [xp, id, name] of [
  [0, '01-criador', 'Criador'],
  [8700, '02-visionario', 'Visionário'],
  [20500, '05-impulsionador', 'Impulsionador'],
  [103000, '16-transformador', 'Transformador'],
  [216000, '25-originador', 'Originador'],
  [500000, '25-originador', 'Originador'],
] as const) {
  const progress = getLevelProgress(xp)
  assert.equal(progress.currentLevel.id, id)
  assert.equal(progress.currentLevel.name, name)
  assert.equal(getGamificationBadgeUrl(progress.currentLevel.id), `/gamification/levels/${id}.png`)
}

assert.equal(getLevelProgress(0).progressPercent, 0)
assert.equal(getLevelProgress(4350).progressPercent, 50)
assert.ok(getLevelProgress(8699).progressPercent < 100)
assert.equal(getLevelProgress(8700).progressPercent, 0)
assert.equal(getLevelProgress(216000).progressPercent, 100)
assert.equal(getLevelProgress(500000).progressPercent, 100)
assert.equal(getLevelProgress(216000).nextLevel, null)
assert.equal(getLevelProgress(216000).xpRemaining, 0)

assert.match(dashboard, /import \{ getLevelProgress \} from '\.\.\/\.\.\/\.\.\/shared\/gamificationLevels'/)
assert.match(dashboard, /import \{ LevelBadge \} from '\.\.\/gamification\/LevelBadge'/)
assert.match(dashboard, /const levelProgress = getLevelProgress\(totalXp\)/)
assert.match(dashboard, /<LevelBadge level=\{currentLevel\} size="xl" decorative loading="eager" \/>/)
assert.match(dashboard, /<div className="momentum-badge">/)
assert.match(dashboard, /\{nextLevel \? `\$\{xpRemaining\.toLocaleString\('pt-BR'\)\} XP para \$\{nextLevel\.name\}` : 'NÍVEL MÁXIMO ALCANÇADO'\}/)
assert.match(dashboard, /aria-valuenow=\{Math\.round\(progressPercent\)\}/)
assert.match(dashboard, /<i style=\{\{ width: `\$\{progressPercent\}%` \}\} \/>/)
assert.match(dashboard, /VER MINHA JORNADA/)

const momentumMeter = dashboard.match(/<div className="xp-meter">[\s\S]*?<\/div>\n      <\/section>/)?.[0] ?? ''
assert.ok(momentumMeter.length > 0)
assert.doesNotMatch(momentumMeter, /completionRate/)
assert.doesNotMatch(dashboard, /gamification\/levels\/\d|\.png/)

assert.match(styles, /\.momentum-art \{[^}]*overflow: hidden/s)
assert.match(styles, /\.momentum-art::before \{[^}]*width: 185px[^}]*height: 185px/s)
assert.match(styles, /\.momentum-badge \{[^}]*position: relative[^}]*z-index: 2/s)
assert.match(styles, /\.momentum-art \.level-badge \{[^}]*--level-badge-size: clamp\(104px, 10\.5vw, 150px\)/s)
assert.match(styles, /@media \(max-width: 780px\) \{[\s\S]*?\.momentum-art::before \{ width: 130px; height: 130px; \}[\s\S]*?\.momentum-art \.level-badge \{ --level-badge-size: clamp\(86px, 29vw, 110px\); \}/)
assert.doesNotMatch(styles, /\.momentum[^\n]*transform: scale/)

console.log('✅ HOME GAMIFICATION: engine oficial, selo atual, XP real, máximo e contrato estrutural responsivo verificados.')
