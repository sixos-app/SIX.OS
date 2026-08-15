import type { IconName } from './Icon'

export type NavigationItem = {
  id: string
  label: string
  icon: IconName
}

export const navigation: NavigationItem[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'feed', label: 'Feed', icon: 'activity' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'projects', label: 'Projetos', icon: 'folder' },
  { id: 'missions', label: 'Missões', icon: 'target' },
  { id: 'team', label: 'Equipe', icon: 'people' },
  { id: 'library', label: 'Biblioteca', icon: 'library' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'profile', label: 'Perfil', icon: 'profile' },
]

export const sectionLabels: Record<string, string> = {
  feed: 'Feed da Agência',
  agenda: 'Agenda compartilhada',
  projects: 'Projetos em movimento',
  missions: 'Missões da equipe',
  team: 'Nossa equipe',
  library: 'Biblioteca SIX',
  analytics: 'Analytics',
  profile: 'Meu perfil',
}
