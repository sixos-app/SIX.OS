import type { TeamMember } from '../../data/dashboard'

export function MentionPopover({
  suggestions,
  selectedIndex,
  onSelect,
}: {
  suggestions: TeamMember[]
  selectedIndex: number
  onSelect: (member: TeamMember) => void
}) {
  if (suggestions.length === 0) {
    return (
      <div className="mention-popover-empty" style={{
        position: 'absolute',
        zIndex: 9999,
        bottom: 'calc(100% + 6px)',
        left: 0,
        width: 'min(320px, 100%)',
        padding: '10px 14px',
        background: '#191917',
        border: '1px solid #383834',
        borderRadius: '10px',
        boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
        color: '#888',
        fontSize: '11px',
      }}>
        Nenhum colaborador com @login encontrado.
      </div>
    )
  }

  return (
    <div
      className="mention-popover"
      role="listbox"
      aria-label="Sugestões de menção"
      style={{
        position: 'absolute',
        zIndex: 9999,
        bottom: 'calc(100% + 6px)',
        left: 0,
        width: 'min(340px, 100%)',
        maxHeight: '220px',
        overflowY: 'auto',
        background: '#191917',
        border: '1px solid #383834',
        borderRadius: '10px',
        boxShadow: '0 14px 40px rgba(0,0,0,0.55)',
        display: 'grid',
        gap: '2px',
        padding: '6px',
      }}
    >
      <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid #282824', fontSize: '8px', fontWeight: 900, color: '#777', letterSpacing: '0.8px' }}>
        MENÇÕES DE COLABORADORES
      </div>
      {suggestions.map((member, index) => {
        const isSelected = index === selectedIndex
        const username = member.username?.startsWith('@') ? member.username : `@${member.username}`

        return (
          <button
            key={member.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(member)}
            style={{
              display: 'grid',
              gridTemplateColumns: '26px 1fr auto',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              background: isSelected ? '#262622' : 'transparent',
              border: 0,
              borderLeft: isSelected ? '2px solid #c6ff38' : '2px solid transparent',
              borderRadius: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.1s ease',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: isSelected ? '#c6ff38' : '#2d2d2a',
                color: isSelected ? '#171717' : '#c6ff38',
                display: 'grid',
                placeItems: 'center',
                fontSize: '9px',
                fontWeight: 900,
              }}
            >
              {member.initials}
            </span>
            <div style={{ display: 'grid', gap: '1px', minWidth: 0 }}>
              <b style={{ fontSize: '11px', color: '#c6ff38', fontWeight: 800 }}>{username}</b>
              <small style={{ fontSize: '9px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.name}
              </small>
            </div>
            {member.department && (
              <span style={{ fontSize: '8px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                {member.department}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
