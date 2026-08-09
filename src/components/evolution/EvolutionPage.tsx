import { useState } from 'react'
import { usePermission } from '../../hooks/usePermission'
import { EvolutionOverview } from './EvolutionOverview'
import { MyEvaluations } from './MyEvaluations'
import { CycleManager } from './CycleManager'
import { EvaluationResults } from './EvaluationResults'
import { TemplateManager } from './TemplateManager'
import { CompetencyManager } from './CompetencyManager'
import { DevelopmentDashboard } from './DevelopmentDashboard'
import { DebriefAssist } from './DebriefAssist'

export function EvolutionPage({ user }: { user: any }) {
  const { can } = usePermission()
  const [activeTab, setActiveTab] = useState<'overview' | 'evaluations' | 'results' | 'cycles' | 'templates' | 'competencies' | 'development' | 'debriefs'>('overview')

  const tabStyle = (isActive: boolean) => ({
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: isActive ? '#c6ff38' : '#888',
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '2px solid #c6ff38' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px'
  })

  return (
    <div className="evolution-page" style={{ padding: '32px', background: '#0a0a0a', minHeight: '100%', color: '#fff' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#fff', letterSpacing: '-0.5px' }}>Evolução & Desenvolvimento</h1>
        <p style={{ color: '#888', margin: 0 }}>Ciclos de avaliação, competências, PDIs e devolutivas.</p>
      </header>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #2a2a2a', marginBottom: '32px', flexWrap: 'wrap' }}>
        <button style={tabStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>Visão Geral</button>
        {can('evaluations.respond') && <button style={tabStyle(activeTab === 'evaluations')} onClick={() => setActiveTab('evaluations')}>Minhas Avaliações</button>}
        {can('evaluations.results.view_own') && <button style={tabStyle(activeTab === 'results')} onClick={() => setActiveTab('results')}>Resultados</button>}
        
        {/* Novas abas de Desenvolvimento (Fase 7.1) */}
        {(can('development.plans.view') || can('development.monitor')) && <button style={tabStyle(activeTab === 'development')} onClick={() => setActiveTab('development')}>Planos (PDI)</button>}
        {can('development.debriefs.view') && <button style={tabStyle(activeTab === 'debriefs')} onClick={() => setActiveTab('debriefs')}>Devolutivas</button>}

        {can('evaluations.cycles.manage') && <button style={tabStyle(activeTab === 'cycles')} onClick={() => setActiveTab('cycles')}>Ciclos</button>}
        {can('evaluations.competencies.manage') && <button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>Templates</button>}
        {can('evaluations.competencies.manage') && <button style={tabStyle(activeTab === 'competencies')} onClick={() => setActiveTab('competencies')}>Competências</button>}
      </div>

      <div className="evolution-content">
        {activeTab === 'overview' && <EvolutionOverview onNavigate={setActiveTab} />}
        {activeTab === 'evaluations' && can('evaluations.respond') && <MyEvaluations />}
        {activeTab === 'results' && can('evaluations.results.view_own') && <EvaluationResults userId={user.id} />}
        {activeTab === 'development' && (can('development.plans.view') || can('development.monitor')) && <DevelopmentDashboard user={user} />}
        {activeTab === 'debriefs' && can('development.debriefs.view') && <DebriefAssist user={user} />}
        {activeTab === 'cycles' && can('evaluations.cycles.manage') && <CycleManager />}
        {activeTab === 'templates' && can('evaluations.competencies.manage') && <TemplateManager />}
        {activeTab === 'competencies' && can('evaluations.competencies.manage') && <CompetencyManager />}
      </div>
    </div>
  )
}
