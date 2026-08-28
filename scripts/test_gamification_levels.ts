import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  GAMIFICATION_LEVELS,
  getLevelFromXp,
  getLevelProgress,
} from '../shared/gamificationLevels.ts'

const expectedLevels = [
  ['01-criador', 'Criador', 0], ['02-visionario', 'Visionário', 8700], ['03-catalisador', 'Catalisador', 12000], ['04-explorador', 'Explorador', 16000], ['05-impulsionador', 'Impulsionador', 20500],
  ['06-conector', 'Conector', 25500], ['07-estrategista', 'Estrategista', 31000], ['08-inventor', 'Inventor', 37000], ['09-articulador', 'Articulador', 43500], ['10-arquiteto', 'Arquiteto', 50500],
  ['11-alquimista', 'Alquimista', 58000], ['12-orquestrador', 'Orquestrador', 66000], ['13-vanguardista', 'Vanguardista', 74500], ['14-pioneiro', 'Pioneiro', 83500], ['15-maestro', 'Maestro', 93000],
  ['16-transformador', 'Transformador', 103000], ['17-mentor', 'Mentor', 113500], ['18-referencia', 'Referência', 124500], ['19-farol', 'Farol', 136000], ['20-autor', 'Autor', 148000],
  ['21-mestre', 'Mestre', 160500], ['22-icone', 'Ícone', 173500], ['23-singular', 'Singular', 187000], ['24-legado', 'Legado', 201000], ['25-originador', 'Originador', 216000],
] as const

const expectedDescriptions = [
  'Transforma intenção em entrega.', 'Enxerga possibilidades antes do óbvio.', 'Move pessoas e ideias para a frente.', 'Descobre caminhos onde ninguém procurou.', 'Faz boas ideias ganharem velocidade.',
  'Une talentos, ideias e oportunidades.', 'Transforma visão em direção.', 'Cria soluções que antes não existiam.', 'Conecta complexidade, pessoas e propósito.', 'Dá estrutura para grandes ideias.',
  'Combina repertório e cria o inesperado.', 'Faz talentos diferentes avançarem juntos.', 'Avança antes que o mercado peça.', 'Abre caminhos para quem vem depois.', 'Eleva ritmo, execução e excelência.',
  'Faz ideias mudarem realidades.', 'Multiplica conhecimento e talento.', 'Inspira pelo padrão que entrega.', 'Traz clareza quando o caminho é incerto.', 'Deixa uma assinatura em tudo que constrói.',
  'Domina o ofício e expande seus limites.', 'Torna excelência impossível de ignorar.', 'Cria o que não pode ser confundido.', 'Seu impacto permanece além da entrega.', 'Não segue movimentos. Dá origem a eles.',
] as const

assert.equal(GAMIFICATION_LEVELS.length, 25)
assert.ok(Object.isFrozen(GAMIFICATION_LEVELS))
assert.ok(GAMIFICATION_LEVELS.every(Object.isFrozen))
assert.deepEqual(GAMIFICATION_LEVELS.map(level => [level.id, level.name, level.minXp]), expectedLevels)
assert.deepEqual(GAMIFICATION_LEVELS.map(level => level.description), expectedDescriptions)
assert.deepEqual(GAMIFICATION_LEVELS.map(level => level.level), Array.from({ length: 25 }, (_, index) => index + 1))
assert.equal(new Set(GAMIFICATION_LEVELS.map(level => level.id)).size, 25)
assert.equal(new Set(GAMIFICATION_LEVELS.map(level => level.name)).size, 25)
assert.equal(GAMIFICATION_LEVELS[0]?.minXp, 0)
assert.equal(GAMIFICATION_LEVELS.at(-1)?.minXp, 216000)
for (let index = 1; index < GAMIFICATION_LEVELS.length; index += 1) {
  assert.ok(GAMIFICATION_LEVELS[index]!.minXp > GAMIFICATION_LEVELS[index - 1]!.minXp)
}

for (const [xp, expected] of [
  [-1, 'Criador'], [0, 'Criador'], [1, 'Criador'], [8699, 'Criador'], [8700, 'Visionário'], [8701, 'Visionário'],
  [11999, 'Visionário'], [12000, 'Catalisador'], [12001, 'Catalisador'], [15999, 'Catalisador'], [16000, 'Explorador'],
  [20499, 'Explorador'], [20500, 'Impulsionador'], [25499, 'Impulsionador'], [25500, 'Conector'], [50499, 'Articulador'],
  [50500, 'Arquiteto'], [92999, 'Pioneiro'], [93000, 'Maestro'], [147999, 'Farol'], [148000, 'Autor'], [160499, 'Autor'],
  [160500, 'Mestre'], [173499, 'Mestre'], [173500, 'Ícone'], [186999, 'Ícone'], [187000, 'Singular'], [200999, 'Singular'],
  [201000, 'Legado'], [215999, 'Legado'], [216000, 'Originador'], [216001, 'Originador'], [500000, 'Originador'],
] as const) {
  assert.equal(getLevelFromXp(xp).name, expected, `${xp} XP`)
}

assert.equal(getLevelFromXp(Number.NaN).name, 'Criador')
assert.equal(getLevelFromXp(Number.NEGATIVE_INFINITY).name, 'Criador')
assert.equal(getLevelFromXp(Number.POSITIVE_INFINITY).name, 'Originador')

for (const [index, level] of GAMIFICATION_LEVELS.entries()) {
  assert.equal(getLevelFromXp(level.minXp).id, level.id)
  assert.equal(getLevelFromXp(level.minXp + 1).id, level.id)
  if (index > 0) assert.equal(getLevelFromXp(level.minXp - 1).id, GAMIFICATION_LEVELS[index - 1]!.id)
}

for (const xp of [-1, 0, 4350, 8699, 8700, 216000, 500000, Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
  const progress = getLevelProgress(xp)
  assert.ok(Number.isFinite(progress.normalizedXp))
  assert.ok(Number.isFinite(progress.progress))
  assert.ok(Number.isFinite(progress.progressPercent))
  assert.ok(progress.progress >= 0 && progress.progress <= 1)
  assert.ok(progress.progressPercent >= 0 && progress.progressPercent <= 100)
  assert.ok(progress.xpRemaining >= 0)
}

assert.equal(getLevelProgress(0).progressPercent, 0)
assert.equal(getLevelProgress(4350).progressPercent, 50)
assert.ok(getLevelProgress(8699).progressPercent < 100)
assert.equal(getLevelProgress(8700).progressPercent, 0)
assert.deepEqual({ next: getLevelProgress(216000).nextLevel, progress: getLevelProgress(216000).progressPercent, remaining: getLevelProgress(216000).xpRemaining }, { next: null, progress: 100, remaining: 0 })
assert.deepEqual({ next: getLevelProgress(500000).nextLevel, progress: getLevelProgress(500000).progressPercent, remaining: getLevelProgress(500000).xpRemaining }, { next: null, progress: 100, remaining: 0 })

const consumerPaths = [
  '../src/components/dashboard/DashboardPage.tsx',
  '../src/components/profile/ProfilePage.tsx',
  '../src/components/profile/JourneyPanel.tsx',
  '../functions/api/dashboard.ts',
  '../functions/api/profile.ts',
  '../functions/api/admin/gamification.ts',
]
for (const path of consumerPaths) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  assert.match(source, /shared\/gamificationLevels/)
  assert.doesNotMatch(source, /\b(8700|12000|16000|20500|216000)\b/)
}

console.log('✅ GAMIFICATION LEVEL ENGINE: 25 níveis, fronteiras, progresso e consumidores verificados.')
