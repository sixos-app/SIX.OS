import { useState, useEffect } from 'react'

export function EvaluationResults({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/evolution/results/${userId}`)
      .then(async r => {
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.error || 'Erro ao carregar resultados')
        }
        return r.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [userId])

  if (loading) return <div style={{ color: '#888' }}>Carregando resultados consolidados...</div>
  if (error) return <div style={{ color: '#ff5252', padding: '24px', background: 'rgba(255, 82, 82, 0.1)', borderRadius: '8px' }}>{error}</div>
  if (!data) return null

  const renderGroupScore = (label: string, groupKey: string) => {
    const group = data.groups[groupKey]
    if (!group) return null

    return (
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#aaa' }}>{label}</h4>
        {group.obscured ? (
          <div style={{ color: '#ff5252', fontSize: '12px', fontStyle: 'italic' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔒</span>
            {group.reason}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: group.score >= 4 ? '#c6ff38' : '#fff' }}>
              {group.score ? group.score.toFixed(1) : '-'}
            </div>
            {group.comments && group.comments.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Comentários</h5>
                {group.comments.map((c: any, i: number) => (
                  <div key={i} style={{ marginBottom: '16px', fontSize: '13px', background: '#0a0a0a', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ color: '#aaa', marginBottom: '4px', fontSize: '11px' }}>{c.question}</div>
                    <div style={{ color: '#fff', fontStyle: 'italic' }}>"{c.text}"</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff' }}>Resultados do Ciclo</h2>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{data.cycle.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase' }}>Média Geral</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#c6ff38' }}>{data.overallScore ? data.overallScore.toFixed(1) : '-'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {renderGroupScore('Autoavaliação', 'self')}
        {renderGroupScore('Liderança', 'manager')}
        {renderGroupScore('Pares', 'peer')}
        {renderGroupScore('Liderados', 'direct_report')}
      </div>

      <h3 style={{ color: '#fff', marginBottom: '24px' }}>Desempenho por Competência</h3>
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#0a0a0a', borderBottom: '1px solid #2a2a2a' }}>
              <th style={{ padding: '16px', color: '#aaa', fontWeight: 'normal' }}>Competência</th>
              <th style={{ padding: '16px', color: '#aaa', fontWeight: 'normal' }}>Autoavaliação</th>
              <th style={{ padding: '16px', color: '#aaa', fontWeight: 'normal' }}>Liderança</th>
              <th style={{ padding: '16px', color: '#aaa', fontWeight: 'normal' }}>Pares</th>
              <th style={{ padding: '16px', color: '#aaa', fontWeight: 'normal' }}>Liderados</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.competencies).map(compName => {
              const scores = data.competencies[compName].scores
              return (
                <tr key={compName} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '16px', color: '#fff', fontWeight: 'bold' }}>{compName}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{scores.self ? scores.self.toFixed(1) : '-'}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{scores.manager ? scores.manager.toFixed(1) : '-'}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{scores.peer ? scores.peer.toFixed(1) : '-'}</td>
                  <td style={{ padding: '16px', color: '#fff' }}>{scores.direct_report ? scores.direct_report.toFixed(1) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
