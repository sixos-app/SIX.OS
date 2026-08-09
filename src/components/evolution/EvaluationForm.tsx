import { useState, useEffect } from 'react'

export function EvaluationForm({ assignmentId, onBack }: { assignmentId: string, onBack: () => void }) {
  const [data, setData] = useState<{ assignment: any, questions: any[], scaleOptions?: any[], response: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, { ratingValue?: number, textValue?: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/evolution/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (d.response?.answers) {
          const initialAnswers: Record<string, any> = {}
          d.response.answers.forEach((a: any) => {
            initialAnswers[a.questionId] = { ratingValue: a.ratingValue, textValue: a.textValue }
          })
          setAnswers(initialAnswers)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [assignmentId])

  const handleSave = async (isDraft: boolean) => {
    if (!data) return
    setSaving(true)
    const payload = {
      isDraft,
      answers: Object.entries(answers).map(([questionId, ans]) => ({ questionId, ...ans }))
    }
    
    try {
      const res = await fetch(`/api/evolution/assignments/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        onBack()
      } else {
        alert('Erro ao salvar')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando formulário...</div>
  if (!data) return <div style={{ color: '#ff5252' }}>Erro ao carregar dados.</div>

  const isSubmitted = data.response?.status === 'submitted'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={onBack} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>← Voltar</button>
        <div>
          <h2 style={{ margin: 0, color: '#fff' }}>Avaliando: {data.assignment.subjectName}</h2>
          <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{data.assignment.cycleName}</p>
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '32px' }}>
        {data.questions.map((q, index) => (
          <div key={q.id} style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: index < data.questions.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px' }}>{q.question}</h4>
            {q.competencyName && <span style={{ display: 'inline-block', background: '#2a2a2a', color: '#aaa', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', marginBottom: '16px' }}>Competência: {q.competencyName}</span>}
            
            {q.type === 'rating' && data.scaleOptions && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {data.scaleOptions.map((opt: any) => (
                  <button
                    key={opt.numericValue}
                    disabled={isSubmitted}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], ratingValue: opt.numericValue } }))}
                    title={opt.label}
                    style={{
                      padding: '10px 16px', borderRadius: '8px',
                      background: answers[q.id]?.ratingValue === opt.numericValue ? '#c6ff38' : '#2a2a2a',
                      color: answers[q.id]?.ratingValue === opt.numericValue ? '#000' : '#fff',
                      border: 'none', cursor: isSubmitted ? 'not-allowed' : 'pointer', fontWeight: 'bold',
                      display: 'flex', flexDirection: 'column', alignItems: 'center'
                    }}
                  >
                    <span>{opt.numericValue}</span>
                    <span style={{ fontSize: '10px', marginTop: '4px', opacity: 0.8 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                disabled={isSubmitted}
                value={answers[q.id]?.textValue || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], textValue: e.target.value } }))}
                placeholder="Escreva seus comentários construtivos..."
                style={{ width: '100%', height: '100px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', padding: '12px', color: '#fff', marginTop: '12px', resize: 'vertical' }}
              />
            )}
          </div>
        ))}

        {!isSubmitted && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button 
              disabled={saving} 
              onClick={() => handleSave(true)} 
              style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Salvar Rascunho
            </button>
            <button 
              disabled={saving} 
              onClick={() => {
                if (confirm('Atenção: Após enviar, a avaliação não poderá ser alterada. Deseja continuar?')) {
                  handleSave(false)
                }
              }} 
              style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Finalizar e Enviar
            </button>
          </div>
        )}
        {isSubmitted && (
          <div style={{ padding: '16px', background: 'rgba(198, 255, 56, 0.1)', color: '#c6ff38', borderRadius: '8px', textAlign: 'center', marginTop: '24px' }}>
            Esta avaliação já foi submetida e não pode ser alterada.
          </div>
        )}
      </div>
    </div>
  )
}
