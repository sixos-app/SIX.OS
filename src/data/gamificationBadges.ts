import type { GamificationLevelId } from '../../shared/gamificationLevels'

export const GAMIFICATION_BADGES = {
  '01-criador': '/gamification/levels/01-criador.png',
  '02-visionario': '/gamification/levels/02-visionario.png',
  '03-catalisador': '/gamification/levels/03-catalisador.png',
  '04-explorador': '/gamification/levels/04-explorador.png',
  '05-impulsionador': '/gamification/levels/05-impulsionador.png',
  '06-conector': '/gamification/levels/06-conector.png',
  '07-estrategista': '/gamification/levels/07-estrategista.png',
  '08-inventor': '/gamification/levels/08-inventor.png',
  '09-articulador': '/gamification/levels/09-articulador.png',
  '10-arquiteto': '/gamification/levels/10-arquiteto.png',
  '11-alquimista': '/gamification/levels/11-alquimista.png',
  '12-orquestrador': '/gamification/levels/12-orquestrador.png',
  '13-vanguardista': '/gamification/levels/13-vanguardista.png',
  '14-pioneiro': '/gamification/levels/14-pioneiro.png',
  '15-maestro': '/gamification/levels/15-maestro.png',
  '16-transformador': '/gamification/levels/16-transformador.png',
  '17-mentor': '/gamification/levels/17-mentor.png',
  '18-referencia': '/gamification/levels/18-referencia.png',
  '19-farol': '/gamification/levels/19-farol.png',
  '20-autor': '/gamification/levels/20-autor.png',
  '21-mestre': '/gamification/levels/21-mestre.png',
  '22-icone': '/gamification/levels/22-icone.png',
  '23-singular': '/gamification/levels/23-singular.png',
  '24-legado': '/gamification/levels/24-legado.png',
  '25-originador': '/gamification/levels/25-originador.png',
} as const satisfies Record<GamificationLevelId, string>

export function getGamificationBadgeUrl(levelId: GamificationLevelId): string {
  return GAMIFICATION_BADGES[levelId]
}
