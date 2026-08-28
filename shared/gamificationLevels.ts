type GamificationLevelShape = Readonly<{
  level: number
  id: string
  name: string
  description: string
  minXp: number
}>

const levels = [
  { level: 1, id: '01-criador', name: 'Criador', description: 'Transforma intenção em entrega.', minXp: 0 },
  { level: 2, id: '02-visionario', name: 'Visionário', description: 'Enxerga possibilidades antes do óbvio.', minXp: 8700 },
  { level: 3, id: '03-catalisador', name: 'Catalisador', description: 'Move pessoas e ideias para a frente.', minXp: 12000 },
  { level: 4, id: '04-explorador', name: 'Explorador', description: 'Descobre caminhos onde ninguém procurou.', minXp: 16000 },
  { level: 5, id: '05-impulsionador', name: 'Impulsionador', description: 'Faz boas ideias ganharem velocidade.', minXp: 20500 },
  { level: 6, id: '06-conector', name: 'Conector', description: 'Une talentos, ideias e oportunidades.', minXp: 25500 },
  { level: 7, id: '07-estrategista', name: 'Estrategista', description: 'Transforma visão em direção.', minXp: 31000 },
  { level: 8, id: '08-inventor', name: 'Inventor', description: 'Cria soluções que antes não existiam.', minXp: 37000 },
  { level: 9, id: '09-articulador', name: 'Articulador', description: 'Conecta complexidade, pessoas e propósito.', minXp: 43500 },
  { level: 10, id: '10-arquiteto', name: 'Arquiteto', description: 'Dá estrutura para grandes ideias.', minXp: 50500 },
  { level: 11, id: '11-alquimista', name: 'Alquimista', description: 'Combina repertório e cria o inesperado.', minXp: 58000 },
  { level: 12, id: '12-orquestrador', name: 'Orquestrador', description: 'Faz talentos diferentes avançarem juntos.', minXp: 66000 },
  { level: 13, id: '13-vanguardista', name: 'Vanguardista', description: 'Avança antes que o mercado peça.', minXp: 74500 },
  { level: 14, id: '14-pioneiro', name: 'Pioneiro', description: 'Abre caminhos para quem vem depois.', minXp: 83500 },
  { level: 15, id: '15-maestro', name: 'Maestro', description: 'Eleva ritmo, execução e excelência.', minXp: 93000 },
  { level: 16, id: '16-transformador', name: 'Transformador', description: 'Faz ideias mudarem realidades.', minXp: 103000 },
  { level: 17, id: '17-mentor', name: 'Mentor', description: 'Multiplica conhecimento e talento.', minXp: 113500 },
  { level: 18, id: '18-referencia', name: 'Referência', description: 'Inspira pelo padrão que entrega.', minXp: 124500 },
  { level: 19, id: '19-farol', name: 'Farol', description: 'Traz clareza quando o caminho é incerto.', minXp: 136000 },
  { level: 20, id: '20-autor', name: 'Autor', description: 'Deixa uma assinatura em tudo que constrói.', minXp: 148000 },
  { level: 21, id: '21-mestre', name: 'Mestre', description: 'Domina o ofício e expande seus limites.', minXp: 160500 },
  { level: 22, id: '22-icone', name: 'Ícone', description: 'Torna excelência impossível de ignorar.', minXp: 173500 },
  { level: 23, id: '23-singular', name: 'Singular', description: 'Cria o que não pode ser confundido.', minXp: 187000 },
  { level: 24, id: '24-legado', name: 'Legado', description: 'Seu impacto permanece além da entrega.', minXp: 201000 },
  { level: 25, id: '25-originador', name: 'Originador', description: 'Não segue movimentos. Dá origem a eles.', minXp: 216000 },
] as const satisfies readonly GamificationLevelShape[]

export type GamificationLevel = (typeof levels)[number]
export type GamificationLevelId = GamificationLevel['id']

export const GAMIFICATION_LEVELS = Object.freeze(levels.map(level => Object.freeze(level))) as readonly GamificationLevel[]

export type LevelProgress = Readonly<{
  normalizedXp: number
  currentLevel: GamificationLevel
  nextLevel: GamificationLevel | null
  levelStartXp: number
  nextLevelXp: number | null
  xpIntoLevel: number
  xpRequiredForLevel: number
  xpRemaining: number
  progress: number
  progressPercent: number
}>

function normalizeXp(xp: number): number {
  if (Number.isNaN(xp) || xp === Number.NEGATIVE_INFINITY) return 0
  if (xp === Number.POSITIVE_INFINITY) return GAMIFICATION_LEVELS.at(-1)!.minXp
  return Math.max(0, Number.isFinite(xp) ? xp : 0)
}

export function getLevelFromXp(xp: number): GamificationLevel {
  const normalizedXp = normalizeXp(xp)
  let currentLevel: GamificationLevel = GAMIFICATION_LEVELS[0]!

  for (const level of GAMIFICATION_LEVELS) {
    if (level.minXp > normalizedXp) break
    currentLevel = level
  }

  return currentLevel
}

export function getLevelProgress(xp: number): LevelProgress {
  const normalizedXp = normalizeXp(xp)
  const currentLevel = getLevelFromXp(normalizedXp)
  const nextLevel = GAMIFICATION_LEVELS[currentLevel.level] ?? null

  if (!nextLevel) {
    return {
      normalizedXp,
      currentLevel,
      nextLevel: null,
      levelStartXp: currentLevel.minXp,
      nextLevelXp: null,
      xpIntoLevel: Math.max(0, normalizedXp - currentLevel.minXp),
      xpRequiredForLevel: 0,
      xpRemaining: 0,
      progress: 1,
      progressPercent: 100,
    }
  }

  const xpRequiredForLevel = nextLevel.minXp - currentLevel.minXp
  const xpIntoLevel = Math.min(xpRequiredForLevel, Math.max(0, normalizedXp - currentLevel.minXp))
  const progress = Math.min(1, Math.max(0, xpIntoLevel / xpRequiredForLevel))

  return {
    normalizedXp,
    currentLevel,
    nextLevel,
    levelStartXp: currentLevel.minXp,
    nextLevelXp: nextLevel.minXp,
    xpIntoLevel,
    xpRequiredForLevel,
    xpRemaining: Math.max(0, nextLevel.minXp - normalizedXp),
    progress,
    progressPercent: progress * 100,
  }
}
