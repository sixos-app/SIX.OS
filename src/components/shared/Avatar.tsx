export function Avatar({ initials, tone = 'dark', small = false }: { initials: string; tone?: 'dark' | 'lime' | 'purple' | 'photo'; small?: boolean }) {
  return <span className={`avatar avatar-${tone} ${small ? 'avatar-small' : ''}`}>{initials}</span>
}
