import { useState, useEffect } from 'react'

export function DebriefAssist({ user }: { user: any }) {
  const [debriefs, setDebriefs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDebriefs = () => {
    setLoading(true)
    fetch('/api/evolution/debriefs')
      .then(r => r.json())
      .then(d => {
        setDebriefs(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchDebriefs()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Devolutivas (Debriefs)</h2>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2a2a2a', padding: '24px', borderRadius: '8px' }}>
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px' }}>
          Histórico de reuniões de devolutiva e feedback estruturado com seus liderados.
        </p>

        {loading ? (
          <p style={{ color: '#888' }}>Carregando devolutivas...</p>
        ) : debriefs.length === 0 ? (
          <p style={{ color: '#888' }}>Nenhuma devolutiva registrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {debriefs.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', border: '1px solid #333', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '15px' }}>{d.subjectName}</h4>
                  <div style={{ color: '#888', fontSize: '13px' }}>
                    {d.cycleName ? `Ciclo: ${d.cycleName}` : 'Devolutiva Avulsa'} | 
                    Data: {d.meetingDate ? new Date(d.meetingDate).toLocaleDateString('pt-BR') : 'A definir'}
                  </div>
                </div>
                <div style={{ padding: '4px 8px', background: d.status === 'completed' ? '#1b331b' : '#332b1b', color: d.status === 'completed' ? '#c6ff38' : '#ffc107', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase' }}>
                  {d.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
