import { useState, useEffect } from 'react'

export function CycleWizard({ onCancel, onCreated }: { onCancel: () => void, onCreated: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cycleType: '360',
    templateId: '',
    startsAt: '',
    responsesDueAt: '',
    resultsAvailableAt: '',
    autoAssignSelf: true,
    autoAssignManager: true,
    autoAssignDirectReport: true,
    selfConfidential: false,
    managerConfidential: false,
    peerConfidential: true,
    directReportConfidential: true,
  })

  useEffect(() => {
    fetch('/api/evolution/admin/templates')
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const handleNext = () => setStep(s => s + 1)
  const handleBack = () => setStep(s => s - 1)

  const handleSaveDraft = async () => {
    setLoading(true)
    const payload = {
      ...formData,
      autoAssignSelf: formData.autoAssignSelf ? 1 : 0,
      autoAssignManager: formData.autoAssignManager ? 1 : 0,
      autoAssignDirectReport: formData.autoAssignDirectReport ? 1 : 0,
      selfConfidential: formData.selfConfidential ? 1 : 0,
      managerConfidential: formData.managerConfidential ? 1 : 0,
      peerConfidential: formData.peerConfidential ? 1 : 0,
      directReportConfidential: formData.directReportConfidential ? 1 : 0
    }
    try {
      const r = await fetch('/api/evolution/admin/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (r.ok) {
        onCreated()
      } else {
        alert('Erro ao criar ciclo')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '10px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '6px', marginBottom: '16px' }

  return (
    <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '32px' }}>
      <h3 style={{ margin: '0 0 24px 0', color: '#fff' }}>Novo Ciclo de Avaliação - Passo {step} de 4</h3>
      
      {step === 1 && (
        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Nome do Ciclo</label>
          <input style={inputStyle} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Avaliação H1 2026" />
          
          <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Descrição</label>
          <textarea style={{ ...inputStyle, minHeight: '80px' }} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Início</label>
              <input type="datetime-local" style={inputStyle} value={formData.startsAt} onChange={e => setFormData({ ...formData, startsAt: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Fim (Respostas)</label>
              <input type="datetime-local" style={inputStyle} value={formData.responsesDueAt} onChange={e => setFormData({ ...formData, responsesDueAt: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Disponibilidade Resultados</label>
              <input type="datetime-local" style={inputStyle} value={formData.resultsAvailableAt} onChange={e => setFormData({ ...formData, resultsAvailableAt: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <label style={{ display: 'block', color: '#aaa', marginBottom: '4px' }}>Template Base</label>
          <select style={inputStyle} value={formData.templateId} onChange={e => setFormData({ ...formData, templateId: e.target.value })}>
            <option value="">Selecione um template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {formData.templateId && <div style={{ color: '#c6ff38', fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>Template selecionado. As perguntas serão gravadas no momento da ativação.</div>}
        </div>
      )}

      {step === 3 && (
        <div>
          <h4 style={{ color: '#fff', marginBottom: '16px' }}>Geração Automática de Assignments</h4>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
            Ao ativar o ciclo, o sistema pode criar avaliações automaticamente se o colaborador estiver configurado com líder/equipe.
          </p>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.autoAssignSelf} onChange={e => setFormData({ ...formData, autoAssignSelf: e.target.checked })} />
            Gerar Autoavaliação para todos os participantes ativos
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.autoAssignManager} onChange={e => setFormData({ ...formData, autoAssignManager: e.target.checked })} />
            Gerar Liderança (Líder avalia Liderado) baseado no manager_id
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.autoAssignDirectReport} onChange={e => setFormData({ ...formData, autoAssignDirectReport: e.target.checked })} />
            Gerar Liderados (Liderado avalia Líder) baseado no manager_id
          </label>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '16px' }}>Nota: Pares não são gerados automaticamente. Adicione-os no detalhe do ciclo após salvar o rascunho.</div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h4 style={{ color: '#fff', marginBottom: '16px' }}>Privacidade das Respostas</h4>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
            Determine quais papéis terão suas respostas ofuscadas (confidenciais). Regra de anonimato será aplicada ({'<'} 3 respostas agrupa/oculta).
          </p>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.selfConfidential} onChange={e => setFormData({ ...formData, selfConfidential: e.target.checked })} />
            Autoavaliação Confidencial (Raro)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.managerConfidential} onChange={e => setFormData({ ...formData, managerConfidential: e.target.checked })} />
            Líder Confidencial (Padrão: Não)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.directReportConfidential} onChange={e => setFormData({ ...formData, directReportConfidential: e.target.checked })} />
            Liderados Confidenciais (Padrão: Sim)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <input type="checkbox" checked={formData.peerConfidential} onChange={e => setFormData({ ...formData, peerConfidential: e.target.checked })} />
            Pares Confidenciais (Padrão: Sim)
          </label>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
        <button onClick={onCancel} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Cancelar</button>
        <div style={{ display: 'flex', gap: '12px' }}>
          {step > 1 && <button onClick={handleBack} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Voltar</button>}
          {step < 4 ? (
            <button onClick={handleNext} disabled={step === 1 && !formData.name} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Próximo</button>
          ) : (
            <button onClick={handleSaveDraft} disabled={loading} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Salvando...' : 'Salvar Rascunho'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
