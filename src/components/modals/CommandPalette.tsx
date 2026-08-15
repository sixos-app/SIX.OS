import { useEffect, useMemo, useState } from 'react'
import type { ClientIdentity } from '../../data/clientRepository'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { Icon, type IconName } from '../shared/Icon'
import { navigation } from '../shared/navigation'

export function CommandPalette({ projects = [], missions = [], team = [], clients = [], onClose, onNavigate, onOpenAssistant }: { projects?: Project[]; missions?: Mission[]; team?: TeamMember[]; clients?: ClientIdentity[]; onClose: () => void; onNavigate: (section: string, filterText?: string) => void; onOpenAssistant: () => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLocaleLowerCase('pt-BR')

  const commands = useMemo(() => {
    const items: { id: string; label: string; hint: string; icon: IconName; action: 'navigate' | 'assistant'; section?: string }[] = [
      ...navigation.map((item) => ({ id: item.id, label: item.label, hint: 'Módulo da Agência', icon: item.icon, action: 'navigate' as const, section: item.id })),
      { id: 'operational-assistant', label: 'SIXIA', hint: 'Consultar os dados atuais', icon: 'sparkle' as IconName, action: 'assistant' as const },
    ]

    if (q) {
      projects.forEach((p) => {
        if (p.name.toLocaleLowerCase('pt-BR').includes(q) || p.client.toLocaleLowerCase('pt-BR').includes(q) || p.code.toLocaleLowerCase('pt-BR').includes(q)) {
          items.push({ id: `proj-${p.id}`, label: p.name, hint: `Projeto · ${p.client}`, icon: 'folder', action: 'navigate', section: 'projects' })
        }
      })

      missions.forEach((m) => {
        if (m.title.toLocaleLowerCase('pt-BR').includes(q) || m.client.toLocaleLowerCase('pt-BR').includes(q)) {
          items.push({ id: `miss-${m.id}`, label: m.title, hint: `Demanda/Missão · ${m.client}`, icon: 'target', action: 'navigate', section: 'missions' })
        }
      })

      team.forEach((t) => {
        if (t.name.toLocaleLowerCase('pt-BR').includes(q) || t.role.toLocaleLowerCase('pt-BR').includes(q)) {
          items.push({ id: `team-${t.id}`, label: t.name, hint: `Equipe · ${t.role}`, icon: 'people', action: 'navigate', section: 'team' })
        }
      })

      clients.forEach((c) => {
        if (c.name.toLocaleLowerCase('pt-BR').includes(q) || (c.shortCode && c.shortCode.toLocaleLowerCase('pt-BR').includes(q))) {
          items.push({ id: `cli-${c.id}`, label: c.name, hint: `Cliente · ${c.shortCode || 'SIX'}`, icon: 'folder', action: 'navigate', section: 'projects' })
        }
      })
    }

    return items
  }, [q, projects, missions, team, clients])

  const matchingCommands = useMemo(() => {
    if (!q) return commands.filter((c) => c.action === 'assistant' || c.hint === 'Módulo da Agência')
    return commands.filter((command) => command.label.toLocaleLowerCase('pt-BR').includes(q) || command.hint.toLocaleLowerCase('pt-BR').includes(q))
  }, [q, commands])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Busca global">
      <div className="command-dialog">
        <div className="command-input">
          <Icon name="sparkle" size={17} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca global (Clientes, Projetos, Demandas, Tarefas, Equipe)…" aria-label="Buscar no SIX.OS" />
          <kbd>ESC</kbd>
        </div>
        <p>{q ? 'RESULTADOS DA BUSCA' : 'MÓDULOS E ATALHOS'}</p>
        <div className="command-list">
          {matchingCommands.map((command) => (
            <button key={command.id} onClick={() => { command.action === 'assistant' ? onOpenAssistant() : onNavigate(command.section || 'home'); onClose() }}>
              <span className="command-icon"><Icon name={command.icon} size={16} /></span>
              <span><b>{command.label}</b><small>{command.hint}</small></span>
              <i>↵</i>
            </button>
          ))}
          {matchingCommands.length === 0 && <span className="command-empty">Nenhum resultado encontrado para "{query}".</span>}
        </div>
        <div className="command-footer">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
