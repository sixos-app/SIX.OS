import { useState, useEffect } from 'react'
import { EvaluationForm } from './EvaluationForm'

export function MyEvaluations() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = () => {
    setLoading(true)
    fetch('/api/evolution/assignments')
      .then(r => r.json())
      .then(d => {
        setAssignments(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  if (selectedId) {
    return <EvaluationForm assignmentId={selectedId} onBack={() => { setSelectedId(null); fetchAssignments() }} />
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando avaliações...</div>

  const relationshipLabels: Record<string, string> = {
    self: 'Autoavaliação',
    manager: 'Avaliação de Liderança',
    peer: 'Avaliação de Par',
    direct_report: 'Avaliação de Liderado'
  }

  return (
    <div>
      <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '24px' }}>Minhas Pendências de Avaliação</h2>
      
      {assignments.length === 0 ? (
        <div style={{ padding: '40px', background: '#141414', border: '1px dashed #333', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
          Você não possui nenhuma avaliação pendente no momento.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {assignments.map(a => (
            <div key={a.id} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', background: '#2a2a2a', padding: '4px 8px', borderRadius: '4px', color: '#aaa', fontWeight: 'bold' }}>
                  {relationshipLabels[a.relationshipType] || a.relationshipType}
                </span>
                {a.status === 'in_progress' && <span style={{ fontSize: '11px', color: '#ffa500', fontWeight: 'bold' }}>RASCUNHO</span>}
              </div>
              
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#fff' }}>{a.subjectName}</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#888' }}>Ciclo: {a.cycleName}</p>
              
              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={() => setSelectedId(a.id)}
                  style={{ width: '100%', padding: '10px', background: '#c6ff38', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {a.status === 'in_progress' ? 'Continuar Avaliação' : 'Iniciar Avaliação'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
