import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { dashboardSeed, type Mission } from './data/dashboard'
import { completeMission as persistMissionCompletion, getDashboard } from './data/dashboardRepository'

type IconName =
  | 'home'
  | 'calendar'
  | 'folder'
  | 'target'
  | 'people'
  | 'sparkle'
  | 'library'
  | 'chart'

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'projects', label: 'Projetos', icon: 'folder' },
  { id: 'missions', label: 'Missões', icon: 'target' },
  { id: 'team', label: 'Equipe', icon: 'people' },
  { id: 'library', label: 'Biblioteca', icon: 'library' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
]

const sectionLabels: Record<string, string> = {
  agenda: 'Agenda compartilhada',
  projects: 'Projetos em movimento',
  missions: 'Missões da equipe',
  team: 'Nossa equipe',
  library: 'Biblioteca SIX',
  analytics: 'Analytics',
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m19 5 2-2" /></>,
    people: <><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a4 4 0 0 0 0-8M21 20v-1a4 4 0 0 0-3-3.87" /></>,
    sparkle: <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 12 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />,
    library: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-5 3 2 5-7" /></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Avatar({ initials, tone = 'dark', small = false }: { initials: string; tone?: 'dark' | 'lime' | 'purple' | 'photo'; small?: boolean }) {
  return <span className={`avatar avatar-${tone} ${small ? 'avatar-small' : ''}`}>{initials}</span>
}

export default function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [filter, setFilter] = useState<'all' | 'today' | 'urgent'>('all')
  const [completed, setCompleted] = useState<string[]>([])
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState(dashboardSeed)

  useEffect(() => {
    void getDashboard().then(setDashboardData)
  }, [])

  const displayedMissions = useMemo(() => {
    if (filter === 'urgent') return dashboardData.missions.filter((mission) => mission.urgent)
    if (filter === 'today') return dashboardData.missions.filter((mission) => mission.deadline.startsWith('Hoje'))
    return dashboardData.missions
  }, [dashboardData.missions, filter])

  const earnedXp = completed.reduce((total, id) => total + (dashboardData.missions.find((mission) => mission.id === id)?.xp ?? 0), 0)
  const totalXp = dashboardData.profile.xp + earnedXp

  function completeMission(id: string) {
    setCompleted((current) => {
      if (current.includes(id)) return current
      void persistMissionCompletion(id)
      return [...current, id]
    })
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveSection('home')} aria-label="Voltar ao início">
          <span className="brand-mark">SIX<span>.</span></span>
          <span className="brand-os">OS</span>
        </button>

        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-caption">SEU ESPAÇO</p>
          {navigation.slice(0, 5).map((item) => (
            <button className={`nav-item ${activeSection === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveSection(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'missions' && <b>4</b>}
            </button>
          ))}
          <p className="nav-caption nav-caption-lower">ECOSSISTEMA</p>
          {navigation.slice(5).map((item) => (
            <button className={`nav-item ${activeSection === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveSection(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="ai-prompt" onClick={() => setIsAiOpen(true)}>
          <span className="ai-spark"><Icon name="sparkle" size={16} /></span>
          <span><b>SIX AI</b><small>Pergunte qualquer coisa</small></span>
          <span className="arrow">↗</span>
        </button>

        <button className="account">
          <Avatar initials="GS" tone="photo" small />
          <span><b>Guilherme</b><small>Designer</small></span>
          <span>•••</span>
        </button>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="crumb"><span>Segunda-feira</span><i /> <strong>04 de agosto</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Pesquisar">⌘ K</button>
            <button className="round-button" aria-label="Notificações">⌁<span /></button>
            <button className="date-chip">Hoje <span>⌄</span></button>
          </div>
        </header>

        {activeSection === 'home' ? (
          <Dashboard
            filter={filter}
            onFilterChange={setFilter}
            missions={displayedMissions}
            completed={completed}
            onComplete={completeMission}
            totalXp={totalXp}
          />
        ) : (
          <ComingSoon title={sectionLabels[activeSection]} onBack={() => setActiveSection('home')} />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.slice(0, 5).map((item) => (
          <button className={activeSection === item.id ? 'active' : ''} key={item.id} onClick={() => setActiveSection(item.id)}>
            <Icon name={item.icon} size={20} /><span>{item.label}</span>
          </button>
        ))}
      </nav>

      {isAiOpen && <AiPanel onClose={() => setIsAiOpen(false)} />}
    </main>
  )
}

function Dashboard({
  filter,
  onFilterChange,
  missions: visibleMissions,
  completed,
  onComplete,
  totalXp,
}: {
  filter: 'all' | 'today' | 'urgent'
  onFilterChange: (filter: 'all' | 'today' | 'urgent') => void
  missions: Mission[]
  completed: string[]
  onComplete: (id: string) => void
  totalXp: number
}) {
  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">BOM DIA, GUILHERME <span>✦</span></p>
          <h1>Hoje é um bom dia<br />para <em>tornar possível.</em></h1>
        </div>
        <div className="energy-widget">
          <span className="energy-label">SUA ENERGIA</span>
          <span className="energy-value">92<sup>%</sup></span>
          <div className="energy-track"><i /></div>
          <small>Você está em ritmo extraordinário.</small>
        </div>
      </section>

      <section className="momentum-card">
        <div className="momentum-copy">
          <p>SEU MOMENTO</p>
          <h2>Você está a <span>280 XP</span><br />de ser um <em>Visionário.</em></h2>
          <button>VER MINHA JORNADA <span>→</span></button>
        </div>
        <div className="momentum-art" aria-hidden="true">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" />
          <strong>V</strong><small>CRIADOR</small>
          <p>GO MAKE<br />IT POSSIBLE</p>
        </div>
        <div className="xp-meter"><span><b>{totalXp.toLocaleString('pt-BR')}</b> / 8.700 XP</span><div><i style={{ width: `${Math.min(100, (totalXp / 8700) * 100)}%` }} /></div></div>
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <div className="section-heading">
            <div><p className="section-index">01</p><h2>Suas missões</h2></div>
            <div className="segmented-control">
              <button className={filter === 'all' ? 'selected' : ''} onClick={() => onFilterChange('all')}>Todas</button>
              <button className={filter === 'today' ? 'selected' : ''} onClick={() => onFilterChange('today')}>Hoje</button>
              <button className={filter === 'urgent' ? 'selected' : ''} onClick={() => onFilterChange('urgent')}>Urgentes</button>
            </div>
          </div>

          <div className="mission-list">
            {visibleMissions.map((mission, index) => {
              const isComplete = completed.includes(mission.id)
              return (
                <article className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''}`} key={mission.id}>
                  <span className="mission-number">0{index + 1}</span>
                  <div className="mission-info"><p>{mission.client}</p><h3>{mission.title}</h3><span className="deadline">{mission.deadline}</span></div>
                  <div className="mission-reward"><span>RECOMPENSA</span><b>+{mission.xp} XP</b><small>+{mission.ideas} ideias</small></div>
                  <button className="complete-button" disabled={isComplete} onClick={() => onComplete(mission.id)}>{isComplete ? 'Feita!' : 'Concluir'} <span>{isComplete ? '✓' : '→'}</span></button>
                </article>
              )
            })}
            {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Seu fluxo está em dia.</p>}
          </div>
          <button className="view-all">VER TODAS AS MISSÕES <span>→</span></button>

          <div className="section-heading projects-heading"><div><p className="section-index">02</p><h2>Projetos em órbita</h2></div><button className="text-action">EXPLORAR PROJETOS <span>↗</span></button></div>
          <div className="project-grid">
            <ProjectCard label="SHO" name="Shopping Uberaba" progress={85} status="EM APROVAÇÃO" tone="project-purple" members={['LM', 'VA', 'GS']} />
            <ProjectCard label="SIC" name="Sicredi" progress={58} status="EM PRODUÇÃO" tone="project-green" members={['MP', 'GS', 'RV']} />
          </div>
        </div>

        <aside className="right-column">
          <div className="section-heading compact"><div><p className="section-index">03</p><h2>Sua agenda</h2></div><button className="text-action">VER TUDO</button></div>
          <div className="agenda-card">
            <div className="calendar-head"><button>‹</button><b>Agosto <span>2026</span></b><button>›</button></div>
            <div className="week-days"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div>
            <div className="calendar-days"><span>27</span><span>28</span><span>29</span><span>30</span><span>31</span><span>1</span><span>2</span><span>3</span><span className="today">4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></div>
            <div className="agenda-line" />
            <AgendaItem time="10:00" title="Reunião de briefing" subtitle="Shopping Uberaba" tone="purple" />
            <AgendaItem time="14:30" title="Toró de ideias" subtitle="Sala Criativa · 8 pessoas" tone="lime" />
            <AgendaItem time="17:00" title="Entrega do KV" subtitle="Shopping Uberaba" tone="orange" />
          </div>

          <div className="section-heading compact feed-heading"><div><p className="section-index">04</p><h2>Acontecendo agora</h2></div></div>
          <div className="feed-card">
            <div className="feed-item"><Avatar initials="LM" tone="purple" small /><p><b>Lorraine</b> conquistou<br /><span>+100 ideias</span> por uma grande sacada.</p><small>agora</small></div>
            <div className="feed-item"><Avatar initials="MP" tone="lime" small /><p><b>Mateus</b> concluiu<br />“Desdobramentos de campanha”.</p><small>12m</small></div>
            <button className="feed-more">VER O FEED COMPLETO <span>→</span></button>
          </div>
        </aside>
      </section>
    </div>
  )
}

function ProjectCard({ label, name, progress, status, tone, members }: { label: string; name: string; progress: number; status: string; tone: string; members: string[] }) {
  return <article className={`project-card ${tone}`}><div className="project-cover"><span>{label}</span><i /><p>TORNAR<br />POSSÍVEL</p></div><div className="project-details"><div><p>{status}</p><h3>{name}</h3></div><b>{progress}%</b></div><div className="project-progress"><i style={{ width: `${progress}%` }} /></div><div className="project-footer"><div className="avatars">{members.map((member, index) => <Avatar initials={member} tone={index === 1 ? 'lime' : 'dark'} small key={member} />)}<span>+4</span></div><button>ABRIR PROJETO <span>↗</span></button></div></article>
}

function AgendaItem({ time, title, subtitle, tone }: { time: string; title: string; subtitle: string; tone: string }) {
  return <div className="agenda-item"><span className={`agenda-dot ${tone}`} /><time>{time}</time><p><b>{title}</b><small>{subtitle}</small></p></div>
}

function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="coming-soon"><p>EM CONSTRUÇÃO</p><h1>{title}</h1><span>Este módulo já tem navegação preparada. A próxima etapa conecta sua base de dados e os fluxos reais.</span><button onClick={onBack}>VOLTAR PARA O INÍCIO <span>←</span></button></section>
}

function AiPanel({ onClose }: { onClose: () => void }) {
  return <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="SIX AI"><div className="ai-dialog"><button className="close-button" onClick={onClose} aria-label="Fechar">×</button><span className="ai-dialog-icon"><Icon name="sparkle" size={24} /></span><p>SIX AI</p><h2>O que vamos<br /><em>tornar possível?</em></h2><label><span>✦</span><input autoFocus placeholder="Pergunte sobre projetos, prazos ou ideias…" /><kbd>↵</kbd></label><div className="suggestions"><button>Quem está sobrecarregado?</button><button>Resuma minha semana</button><button>Monte um cronograma</button></div></div></div>
}
