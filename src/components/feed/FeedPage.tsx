import { useCallback, useEffect, useState } from 'react'
import type { TeamMember } from '../../data/dashboard'
import { KudoModal } from './KudoModal'

export function FeedPage({ team }: { team: TeamMember[] }) {
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isKudoOpen, setIsKudoOpen] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  const loadFeed = useCallback(() => {
    setIsLoading(true)
    fetch('/api/feed')
      .then((res) => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setFeedItems(data)
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <section className="profile-page">
      {showCelebration && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, display: 'grid', placeItems: 'center' }}>
          <style>{`
            @keyframes celebrate {
              0% { transform: scale(0.6) translateY(20px); opacity: 0; }
              20% { transform: scale(1.1) translateY(-10px); opacity: 1; }
              80% { transform: scale(1) translateY(0); opacity: 1; }
              100% { transform: scale(0.9) translateY(-20px); opacity: 0; }
            }
            .celebrate-card {
              background: #171717;
              color: #c6ff38;
              border: 2px solid #8b73ff;
              padding: 24px 36px;
              border-radius: 16px;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5);
              animation: celebrate 2s ease-in-out forwards;
            }
          `}</style>
          <div className="celebrate-card">
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>🎉</span>
            <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '-1px' }}>KUDOS ENVIADOS!</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a5a59e' }}>+100 XP distribuídos para o time ✦</p>
          </div>
        </div>
      )}

      <div className="profile-banner" style={{ borderColor: '#8b73ff', minHeight: '140px' }}>
        <button className="profile-edit-trigger" style={{ background: '#8b73ff', borderColor: '#8b73ff' }} onClick={() => setIsKudoOpen(true)}>
          MANDAR KUDOS ✦
        </button>
        <div className="profile-banner-content" style={{ padding: '24px' }}>
          <div className="profile-identity">
            <span className="profile-role" style={{ color: '#8b73ff' }}>ACONTECENDO AGORA</span>
            <h1 style={{ fontSize: '24px' }}>Feed da <em>Agência</em></h1>
            <p className="profile-bio">Acompanhe as conquistas, kudos e atualizações operacionais do time em tempo real.</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '24px auto', display: 'grid', gap: '14px' }}>
        {isLoading ? (
          <p style={{ color: '#85857e', fontSize: '12px', textAlign: 'center', padding: '40px' }}>Carregando atualizações da agência...</p>
        ) : feedItems.length > 0 ? (
          feedItems.map((item) => {
            const initials = item.user_name ? item.user_name.split(/\s+/).map((p: any) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') : 'SX'
            const isKudo = item.type === 'kudo_received'
            const isProject = item.type === 'project_created'

            return (
              <div key={item.id} style={{ display: 'flex', gap: '14px', background: '#fffefa', border: '1px solid #e1e1da', padding: '16px', borderRadius: '12px', alignItems: 'center' }}>
                <span className="avatar avatar-purple" style={{ background: isKudo ? '#8b73ff' : isProject ? '#c6ff38' : '#222', color: isProject ? '#171717' : '#fff' }}>{initials}</span>
                <div style={{ flex: 1, fontSize: '12px', color: '#171717' }}>
                  <b style={{ textTransform: 'capitalize' }}>{item.user_name || 'Membro do Time'}</b> {item.title} <strong style={{ color: isKudo ? '#8b73ff' : isProject ? '#8b73ff' : '#171717' }}>{item.target_name}</strong>
                  {item.xp_amount && <span style={{ marginLeft: '8px', color: '#8b73ff', fontWeight: 'bold', fontSize: '10px', background: 'rgba(139,115,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>+{item.xp_amount} XP</span>}
                  <p style={{ margin: '4px 0 0', color: '#85857e', fontSize: '10px' }}>{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                </div>
                {item.link && <a href={item.link} style={{ fontSize: '10px', color: '#8b73ff', fontWeight: 'bold', textDecoration: 'none' }}>VER ↗</a>}
              </div>
            )
          })
        ) : (
          <p style={{ color: '#85857e', fontSize: '12px', textAlign: 'center', padding: '40px' }}>Nenhum evento registrado no feed até o momento.</p>
        )}
      </div>

      {isKudoOpen && (
        <KudoModal
          team={team}
          onClose={() => setIsKudoOpen(false)}
          onSent={() => {
            setIsKudoOpen(false)
            loadFeed()
            setShowCelebration(true)
            setTimeout(() => setShowCelebration(false), 2000)
          }}
        />
      )}
    </section>
  )
}
