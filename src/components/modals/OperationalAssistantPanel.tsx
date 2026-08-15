import { useState } from 'react'
import type { DashboardData } from '../../data/dashboard'
import { Icon } from '../shared/Icon'

export type OperationalInsight = {
  answer: string
  action?: { label: string; section: 'agenda' | 'missions' | 'team' | 'projects' | 'analytics' }
}

export function getOperationalInsight(question: string, dashboardData: DashboardData, completed: string[]): OperationalInsight {
  const normalizedQuestion = question.toLocaleLowerCase('pt-BR')
  const openMissions = dashboardData.missions.filter((mission) => !completed.includes(mission.id))

  if (normalizedQuestion.includes('sobrecarregado') || normalizedQuestion.includes('capacidade') || normalizedQuestion.includes('equipe')) {
    if (dashboardData.team.length === 0) return { answer: 'Ainda não há pessoas cadastradas para analisar a capacidade.', action: { label: 'VER EQUIPE', section: 'team' } }
    const highestCapacity = dashboardData.team.reduce((current, member) => member.capacity > current.capacity ? member : current)
    return { answer: `${highestCapacity.name} está com ${highestCapacity.capacity}% de capacidade e em ${highestCapacity.availability.toLocaleLowerCase('pt-BR')}. ${highestCapacity.note}`, action: { label: 'VER EQUIPE', section: 'team' } }
  }

  if (normalizedQuestion.includes('semana') || normalizedQuestion.includes('resuma') || normalizedQuestion.includes('resumo')) {
    const weeklyXp = dashboardData.analytics.weekly.reduce((total, point) => total + point.xp, 0)
    return { answer: `A semana soma ${weeklyXp.toLocaleString('pt-BR')} XP de ritmo criativo. Há ${openMissions.length} missões em aberto e ${dashboardData.analytics.deliveryRate}% das entregas seguem no prazo.`, action: { label: 'VER ANALYTICS', section: 'analytics' } }
  }

  if (normalizedQuestion.includes('cronograma') || normalizedQuestion.includes('agenda') || normalizedQuestion.includes('hoje')) {
    const todayEvents = dashboardData.agenda.filter((event) => event.day === 'Hoje')
    const nextEvent = todayEvents[0]
    return nextEvent ? { answer: `Seu próximo compromisso é “${nextEvent.title}” às ${nextEvent.time}. Depois, você tem ${todayEvents.length - 1} eventos programados hoje.`, action: { label: 'ABRIR AGENDA', section: 'agenda' } } : { answer: 'Sua agenda está livre no momento.' }
  }

  const urgentMission = openMissions.find((mission) => mission.urgent) ?? openMissions[0]
  return urgentMission ? { answer: `A prioridade mais próxima é “${urgentMission.title}” para ${urgentMission.client}, com prazo ${urgentMission.deadline}. Concluir essa missão rende +${urgentMission.xp} XP.`, action: { label: 'VER MISSÕES', section: 'missions' } } : { answer: 'Todas as missões da semana foram concluídas. É um ótimo momento para revisar os próximos projetos.' }
}

export function OperationalAssistantPanel({ dashboardData, completed, onClose, onNavigate }: { dashboardData: DashboardData; completed: string[]; onClose: () => void; onNavigate: (section: 'agenda' | 'missions' | 'team' | 'projects' | 'analytics') => void }) {
  const [question, setQuestion] = useState('')
  const [insight, setInsight] = useState<OperationalInsight | null>(null)

  function ask(questionToAsk: string) {
    const trimmedQuestion = questionToAsk.trim()
    if (!trimmedQuestion) return
    setInsight(getOperationalInsight(trimmedQuestion, dashboardData, completed))
    setQuestion('')
  }

  return (
    <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="SIXIA">
      <div className="ai-dialog">
        <button className="close-button" onClick={onClose} aria-label="Fechar">×</button>
        <span className="ai-dialog-icon"><Icon name="sparkle" size={24} /></span>
        <p>SIXIA</p>
        <h2>Consulte o estado<br /><em>atual da operação.</em></h2>
        <form onSubmit={(event) => { event.preventDefault(); ask(question) }}>
          <label>
            <span>✦</span>
            <input autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte sobre projetos, prazos ou equipe…" />
            <button type="submit" aria-label="Enviar pergunta">↵</button>
          </label>
        </form>
        {insight && (
          <div className="ai-response">
            <span>LEITURA DOS DADOS ATUAIS</span>
            <p>{insight.answer}</p>
            {insight.action && <button onClick={() => onNavigate(insight.action!.section)}>{insight.action.label} <b>→</b></button>}
          </div>
        )}
        <div className="suggestions">
          <button onClick={() => ask('Quem está sobrecarregado?')}>Quem está sobrecarregado?</button>
          <button onClick={() => ask('Resuma minha semana')}>Resuma minha semana</button>
          <button onClick={() => ask('Monte um cronograma')}>Monte um cronograma</button>
        </div>
      </div>
    </div>
  )
}
