import { useEffect, useState } from 'react'
import type { AccessSession } from '../../data/accessRepository'
import { getProfileData, type ProfileData } from '../../data/profileRepository'
import { usePermission } from '../../hooks/usePermission'
import { ProfileEditModal } from './ProfileEditModal'

export function ProfilePage({ accessSession, onLogoutSuccess }: { accessSession: AccessSession | null; onLogoutSuccess?: () => void }) {
  const { can } = usePermission()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    void getProfileData().then(setProfileData).catch((reason: Error) => setError(reason.message))
  }, [])

  if (error) {
    return (
      <section className="profile-page">
        <div className="profile-banner">
          <div className="profile-banner-content">
            <div className="profile-identity">
              <h1>Perfil indisponível</h1>
              <p className="profile-bio">{error}. Atualize a página ou entre novamente.</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const profile = profileData?.profile
  const ranking = profileData?.ranking ?? []
  const stickers = profileData?.stickers ?? []
  const stats = profileData?.stats ?? { projectsDelivered: 0, averageApproval: 100 }
  const levelConfig = profileData?.levelConfig ?? [
    { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
    { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
    { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' },
  ]
  const currentLevel = profile ? ([...levelConfig].reverse().find((level) => (profile.xp ?? 0) >= level.target) ?? levelConfig[0]) : levelConfig[0]
  const nextLevel = profile ? levelConfig.find((level) => level.target > (profile.xp ?? 0)) : levelConfig[1]
  const displayName = profile?.socialName || profile?.name || accessSession?.name || 'Colaborador'
  const displayRole = profile?.customRole || (can('users.manage') ? 'Administrador' : 'Especialista')
  const highlightColor = profile?.highlightColor || '#c6ff38'
  const initials = displayName.split(/\s+/).map((p: string) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') || 'SX'

  function handleProfileSaved() {
    setIsEditing(false)
    void getProfileData().then(setProfileData).catch(() => undefined)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    if (onLogoutSuccess) {
      onLogoutSuccess()
    } else {
      window.location.assign('/')
    }
  }

  return (
    <section className="profile-page">
      <div className="profile-banner" style={{ borderColor: highlightColor }}>
        {profile?.bannerUrl && <img className="profile-banner-image" src={profile.bannerUrl} alt="" />}
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px', zIndex: 2 }}>
          <button className="profile-edit-trigger" style={{ position: 'static' }} onClick={() => setIsEditing(true)}>
            EDITAR PERFIL
          </button>
          <button className="profile-edit-trigger" style={{ position: 'static', background: 'rgba(214,48,49,0.2)', borderColor: 'rgba(214,48,49,0.3)' }} onClick={handleLogout}>
            SAIR
          </button>
        </div>
        <div className="profile-banner-content">
          <div className="profile-avatar-large" style={{ borderColor: highlightColor }}>
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}
          </div>
          <div className="profile-identity">
            <span className="profile-role">{displayRole.toUpperCase()}</span>
            <h1>{displayName}</h1>
            {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-card highlight" style={{ background: highlightColor, borderColor: highlightColor }}>
          <span style={{ color: '#171717' }}>XP TOTAL</span>
          <b style={{ color: '#171717' }}>{(profile?.xp ?? 0).toLocaleString('pt-BR')}</b>
          <small style={{ color: 'rgba(0,0,0,.5)' }}>pontos acumulados</small>
        </div>
        <div className="profile-stat-card">
          <span>NÍVEL</span>
          <b>{currentLevel.name}</b>
          <small>{currentLevel.detail}</small>
        </div>
        <div className="profile-stat-card">
          <span>STREAK</span>
          <b>{profile?.streakDays ?? 0}</b>
          <small>dias seguidos</small>
        </div>
        <div className="profile-stat-card">
          <span>PROJETOS</span>
          <b>{stats.projectsDelivered}</b>
          <small>entregues</small>
        </div>
        <div className="profile-stat-card">
          <span>APROVAÇÃO</span>
          <b>{stats.averageApproval}%</b>
          <small>taxa média</small>
        </div>
      </div>

      <div className="profile-content">
        <div>
          <section className="profile-section">
            <div className="profile-section-head">
              <div>
                <span>CLASSIFICAÇÃO</span>
                <h2>Ranking <em>do time</em></h2>
              </div>
              <b>{ranking.length} pessoas</b>
            </div>
            <div className="ranking-list">
              {ranking.map((member, index) => (
                <div className="ranking-item" key={member.id}>
                  <span className="ranking-position">{index + 1}º</span>
                  <span className="ranking-avatar">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      (member.socialName || member.name).split(/\s+/).map((p: string) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR')
                    )}
                  </span>
                  <div className="ranking-name">
                    <b>{member.socialName || member.name}</b>
                    <small>{member.level} · {member.xp.toLocaleString('pt-BR')} XP</small>
                  </div>
                  <span className="ranking-xp">{member.xp.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </section>

          {profile?.internalNetworks && Object.keys(profile.internalNetworks).length > 0 && (
            <section className="profile-section" style={{ marginTop: 20 }}>
              <div className="profile-section-head">
                <span>REDES INTERNAS</span>
              </div>
              {Object.entries(profile.internalNetworks).map(([key, value]) => (
                <div key={key} style={{ padding: '6px 0', fontSize: '11px' }}>
                  <b style={{ textTransform: 'uppercase', fontSize: '8px', letterSpacing: '1px', color: '#85857e' }}>{key}</b>
                  <br />
                  <span style={{ color: '#171717' }}>{value as string}</span>
                </div>
              ))}
            </section>
          )}

          {profile?.signature && (
            <section className="profile-section" style={{ marginTop: 20 }}>
              <div className="profile-section-head">
                <span>ASSINATURA</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#4e4e48', lineHeight: 1.5, fontStyle: 'italic' }}>{profile.signature}</p>
            </section>
          )}
        </div>

        <div>
          <section className="profile-section">
            <div className="profile-section-head">
              <div>
                <span>CONQUISTAS</span>
                <h2>Stickers <em>coletados</em></h2>
              </div>
              <b>{stickers.filter((s) => s.unlocked).length}/{stickers.length}</b>
            </div>
            <div className="sticker-grid">
              {stickers.map((sticker) => (
                <div className={`sticker-card ${sticker.unlocked ? 'unlocked' : ''}`} key={sticker.code}>
                  <span className="sticker-emoji">{sticker.imageUrl}</span>
                  <b>{sticker.name}</b>
                  <small>{sticker.description}</small>
                </div>
              ))}
            </div>
          </section>

          {nextLevel && (
            <section className="profile-section" style={{ marginTop: 20 }}>
              <div className="profile-section-head">
                <span>PRÓXIMO NÍVEL</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <b style={{ fontSize: '18px', letterSpacing: '-1px' }}>{nextLevel.name}</b>
                <p style={{ margin: '4px 0 10px', fontSize: '10px', color: '#85857e' }}>{nextLevel.detail}</p>
                <div style={{ height: 6, background: '#e2e2db', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (((profile?.xp ?? 0) - currentLevel.target) / (nextLevel.target - currentLevel.target)) * 100)}%`, background: highlightColor, borderRadius: 'inherit', transition: 'width .35s ease' }} />
                </div>
                <small style={{ display: 'block', marginTop: 6, fontSize: '9px', color: '#85857e' }}>
                  Faltam {(nextLevel.target - (profile?.xp ?? 0)).toLocaleString('pt-BR')} XP
                </small>
              </div>
            </section>
          )}
        </div>
      </div>

      {isEditing && <ProfileEditModal profile={profile} onClose={() => setIsEditing(false)} onSaved={handleProfileSaved} />}
    </section>
  )
}
