import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Mission } from '../../data/dashboard'
import {
  addMissionChecklistItem,
  addMissionComment,
  attachProjectLibraryFile,
  getMissionDetails,
  requestMissionCompletion,
  returnMissionWorkflow,
  setMissionChecklistItem,
  type MissionDetails,
} from '../../data/missionRepository'
import {
  getProjectLibrary,
  projectLibrarySeed,
  uploadProjectLibraryFile,
  type ProjectLibrary,
} from '../../data/projectLibraryRepository'
import { deadlineToMissionDate } from '../../utils/formatters'
import { MissionTimerValue } from '../shared/MissionTimerValue'

function renderDescriptionWithLinks(text?: string | null): ReactNode {
  if (!text || !text.trim()) return <span style={{ color: '#777' }}>Sem descrição adicionada.</span>
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: '#c6ff38', textDecoration: 'underline', overflowWrap: 'break-word', wordBreak: 'break-word' }}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

export function MissionDetailsModal({
  mission,
  onClose,
  onTimerToggle,
  isTimerPending,
  canDelete,
  onDelete,
}: {
  mission: Mission
  onClose: () => void
  onTimerToggle: (id: string) => Promise<void>
  isTimerPending: boolean
  canDelete?: boolean
  onDelete?: () => void
}) {
  const [details, setDetails] = useState<MissionDetails | null>(null)
  const [library, setLibrary] = useState<ProjectLibrary>(projectLibrarySeed)
  const [activeTab, setActiveTab] = useState<'mission' | 'attachments' | 'comments' | 'history'>('mission')
  const [checklistLabel, setChecklistLabel] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [selectedFileId, setSelectedFileId] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [message, setMessage] = useState('')
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [returnTargetPosition, setReturnTargetPosition] = useState(0)
  const [returnReason, setReturnReason] = useState('')

  async function reload() {
    try {
      const next = await getMissionDetails(mission.id)
      setDetails(next)
      if (next.mission.projectId) {
        try {
          const projectLibrary = await getProjectLibrary(next.mission.projectId)
          setLibrary(projectLibrary)
          setUploadFolderId((current) => current || projectLibrary.folders[0]?.id || '')
        } catch {
          // Biblioteca indisponível
        }
      }
    } catch (error) {
      setDetails({
        mission: {
          id: mission.id,
          title: mission.title,
          description: 'Conecte uma sessão SIX para carregar os dados persistidos desta missão.',
          client: mission.client,
          projectId: mission.projectId ?? '',
          project: mission.client,
          assigneeId: mission.assigneeId ?? null,
          assignee: null,
          status: mission.status ?? 'open',
          priority: mission.urgent ? 'urgent' : 'normal',
          dueAt: deadlineToMissionDate(mission.deadline),
          expectedMinutes: null,
          xpReward: mission.xp,
          ideasReward: mission.ideas,
          rewardLabel: null,
          approvalStatus: mission.approvalStatus ?? 'not_requested',
          realizedCost: 0,
          createdAt: '',
          completedAt: null,
          approvedAt: null,
          startedAt: mission.startedAt ?? null,
          boardId: mission.boardId ?? null,
          stageId: mission.stageId ?? null,
          stageName: mission.stageName ?? null,
          stageType: mission.stageType ?? null,
        },
        checklist: [],
        comments: [],
        attachments: [],
        history: [],
        activeTimer: mission.activeTimerStartedAt ? { id: '', startedAt: mission.activeTimerStartedAt } : null,
        permissions: { canInteract: false, canManage: false, canApprove: false, canTrackTime: false },
      })
      setMessage(error instanceof Error ? `${error.message} Exibindo o resumo local.` : 'Exibindo o resumo local da missão.')
    }
  }

  useEffect(() => { void reload() }, [mission.id])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isReturnModalOpen) setIsReturnModalOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, isReturnModalOpen])

  async function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!checklistLabel.trim()) return
    try {
      const { item } = await addMissionChecklistItem(mission.id, checklistLabel)
      setDetails((current) => current ? { ...current, checklist: [...current.checklist, item] } : current)
      setChecklistLabel('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o item.')
    }
  }

  async function toggleChecklist(itemId: string, isCompleted: boolean) {
    try {
      await setMissionChecklistItem(mission.id, itemId, isCompleted)
      setDetails((current) => current ? { ...current, checklist: current.checklist.map((item) => item.id === itemId ? { ...item, isCompleted: isCompleted ? 1 : 0 } : item) } : current)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o item.')
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!commentBody.trim()) return
    try {
      const { comment } = await addMissionComment(mission.id, commentBody)
      setDetails((current) => current ? { ...current, comments: [comment, ...current.comments] } : current)
      setCommentBody('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o comentário.')
    }
  }

  async function attachFile() {
    if (!selectedFileId) return
    try {
      const { attachment } = await attachProjectLibraryFile(mission.id, selectedFileId)
      setDetails((current) => current ? { ...current, attachments: [attachment, ...current.attachments] } : current)
      setSelectedFileId('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.')
    }
  }

  async function uploadAndAttachFile(file?: File) {
    const folderId = uploadFolderId || library.folders[0]?.id
    if (!file || !folderId || !details) return
    setIsUploadingFile(true)
    try {
      const uploaded = await uploadProjectLibraryFile({ projectId: details.mission.projectId, folderId, file })
      const { attachment } = await attachProjectLibraryFile(mission.id, uploaded.id)
      setLibrary((current) => ({
        folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, fileCount: folder.fileCount + 1 } : folder),
        files: [uploaded, ...current.files.filter((item) => item.id !== uploaded.id)],
      }))
      setDetails((current) => current ? { ...current, attachments: [attachment, ...current.attachments] } : current)
      setMessage(`Arquivo ${uploaded.name} enviado e anexado à missão.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o anexo.')
    } finally {
      setIsUploadingFile(false)
      setIsDraggingFile(false)
    }
  }

  async function advanceStep() {
    try {
      const result = await requestMissionCompletion(mission.id)
      if (result.status === 'workflow_advanced') {
        setMessage(`Etapa concluída! Próximo setor: ${result.nextDepartment ?? 'Aprovação'}.`)
      } else if (result.status === 'completed') {
        setMessage('Missão aprovada com sucesso e XP creditado a todos os participantes!')
      } else {
        setMessage('Entrega enviada para aprovação.')
      }
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível avançar a etapa.')
    }
  }

  async function handleReturnWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await returnMissionWorkflow(mission.id, returnTargetPosition, returnReason.trim())
      setMessage('Ajustes solicitados com sucesso. A missão retornou para a etapa selecionada.')
      setIsReturnModalOpen(false)
      setReturnReason('')
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível solicitar ajustes.')
    }
  }

  async function toggleTimer() {
    try {
      await onTimerToggle(mission.id)
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o cronômetro.')
    }
  }

  const steps = details?.workflowSteps ?? []
  const activeStep = steps.find((s) => s.status === 'active' || s.status === 'returned')
  const completedSteps = steps.filter((s) => s.status === 'completed')
  const totalTrackedSeconds = details?.timeTracking?.totalSeconds ?? 0
  const trackedHoursFormatted = `${Math.floor(totalTrackedSeconds / 3600)}h ${Math.floor((totalTrackedSeconds % 3600) / 60)}min`
  const expectedHoursFormatted = details?.mission.expectedMinutes ? `${Math.floor(details.mission.expectedMinutes / 60)}h ${details.mission.expectedMinutes % 60 ? `${details.mission.expectedMinutes % 60}min` : ''}` : null

  return (
    <div className="mission-create-overlay mission-details-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da missão">
      <section className="mission-details-dialog">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar detalhes da missão">×</button>
        {!details ? (
          <p className="mission-details-loading">Carregando missão…</p>
        ) : (
          <>
            {/* CABEÇALHO DA MISSÃO */}
            <header>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <p>MISSÃO</p>
                  <h2>{details.mission.title}</h2>
                  <span>{details.mission.client} · {details.mission.project}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {canDelete && details.mission.status !== 'completed' && onDelete && (
                    <button
                      className="mission-delete-button"
                      type="button"
                      onClick={onDelete}
                      style={{ padding: '7px 14px', minHeight: '34px', fontSize: '8px' }}
                    >
                      EXCLUIR MISSÃO
                    </button>
                  )}
                  {details.mission.status === 'completed' && (
                    <span style={{ background: '#c6ff38', color: '#111', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                      CONCLUÍDA ✓
                    </span>
                  )}
                </div>
              </div>
            </header>

            {/* BARRA DE METADADOS COM TIMER COMPACTO INTEGRADO */}
            <div className="mission-details-meta" style={{ alignItems: 'center' }}>
              {details.permissions.canTrackTime && details.mission.status !== 'completed' && (
                <button
                  className={`mission-compact-timer ${details.activeTimer ? 'active' : ''}`}
                  type="button"
                  title={details.activeTimer ? 'Pausar timer' : 'Iniciar timer da missão'}
                  disabled={isTimerPending}
                  onClick={() => { void toggleTimer() }}
                >
                  {isTimerPending ? '…' : details.activeTimer ? '⏸' : '▶'}
                </button>
              )}
              <b>{details.mission.priority.toLocaleUpperCase('pt-BR')}</b>
              <span>{details.mission.assignee ?? 'Responsável a definir'}</span>
              <span>{details.mission.dueAt ? new Date(details.mission.dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Prazo a definir'}</span>
              {expectedHoursFormatted && <span>Estimativa: {expectedHoursFormatted}</span>}
              <span>
                Tempo: {details.activeTimer ? <MissionTimerValue startedAt={details.activeTimer.startedAt} /> : trackedHoursFormatted}
              </span>
              {details.mission.realizedCost > 0 && <span>Custo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.mission.realizedCost)}</span>}
              <span>+{details.mission.xpReward} XP</span>
            </div>

            {/* NAVEGAÇÃO POR ABAS INTERNAS */}
            <nav className="mission-tabs" aria-label="Navegação do detalhe da missão">
              <button
                className={`mission-tab-button ${activeTab === 'mission' ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab('mission')}
              >
                MISSÃO
              </button>
              <button
                className={`mission-tab-button ${activeTab === 'attachments' ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab('attachments')}
              >
                ANEXOS
                {details.attachments.length > 0 && (
                  <span className="mission-tab-badge">{details.attachments.length}</span>
                )}
              </button>
              <button
                className={`mission-tab-button ${activeTab === 'comments' ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab('comments')}
              >
                COMENTÁRIOS
                {details.comments.length > 0 && (
                  <span className="mission-tab-badge">{details.comments.length}</span>
                )}
              </button>
              <button
                className={`mission-tab-button ${activeTab === 'history' ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveTab('history')}
              >
                HISTÓRICO
              </button>
            </nav>

            {/* CONTEÚDO DA ABA 1 — MISSÃO */}
            {activeTab === 'mission' && (
              <div className="mission-tab-panel">
                {/* WORKFLOW PIPELINE INTERATIVO */}
                {steps.length > 0 && (
                  <div className="mission-workflow-pipeline" style={{ background: '#171717', border: '1px solid #282828', borderRadius: '10px', padding: '14px', margin: '0 0 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <small style={{ color: '#888', fontWeight: 800, letterSpacing: '1px', fontSize: '9px' }}>
                        WORKFLOW OPERACIONAL DA MISSÃO
                      </small>
                      {activeStep && (
                        <span style={{ fontSize: '10px', color: activeStep.status === 'returned' ? '#ff6b6b' : '#c6ff38', fontWeight: 800 }}>
                          {activeStep.status === 'returned' ? 'AJUSTES SOLICITADOS' : 'ETAPA ATIVA'} · {activeStep.departmentName.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {steps.map((step, idx) => {
                        const isDone = step.status === 'completed'
                        const isActive = step.status === 'active' || step.status === 'returned'
                        const isReturned = step.status === 'returned'

                        return (
                          <div key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                background: isDone ? '#243015' : isActive ? (isReturned ? '#361c1c' : '#222') : '#1c1c1c',
                                border: isDone ? '1px solid #486620' : isActive ? (isReturned ? '1px solid #ff6b6b' : '1px solid #c6ff38') : '1px solid #333',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                display: 'grid',
                                gap: '2px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: isDone ? '#c6ff38' : isActive ? (isReturned ? '#ff6b6b' : '#c6ff38') : '#777', fontWeight: 900, fontSize: '11px' }}>
                                  {isDone ? '✓' : isActive ? (isReturned ? '↺' : '●') : '○'}
                                </span>
                                <b style={{ fontSize: '11px', color: isDone ? '#c6ff38' : '#f8f8f2' }}>
                                  {idx + 1}. {step.departmentName}
                                </b>
                              </div>
                              <small style={{ fontSize: '9px', color: '#999' }}>
                                {step.responsibleName ?? 'A definir'}
                                {step.completedAt && ` · ${new Date(step.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                              </small>
                              {step.reviewNotes && (
                                <small style={{ fontSize: '9px', color: '#ff8585', fontStyle: 'italic', marginTop: '2px' }}>
                                  Nota: {step.reviewNotes}
                                </small>
                              )}
                            </div>
                            {idx < steps.length - 1 && (
                              <span style={{ color: isDone ? '#c6ff38' : '#555', fontWeight: 900 }}>→</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* AÇÕES OPERACIONAIS DO WORKFLOW */}
                    {details.mission.status !== 'completed' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #262626' }}>
                        <button
                          type="button"
                          onClick={() => { void advanceStep() }}
                          style={{
                            background: '#c6ff38',
                            color: '#111',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '7px 14px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          CONCLUIR ETAPA E AVANÇAR →
                        </button>

                        {completedSteps.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturnTargetPosition(completedSteps[completedSteps.length - 1]?.position ?? 0)
                              setIsReturnModalOpen(true)
                            }}
                            style={{
                              background: '#242424',
                              color: '#ff8585',
                              border: '1px solid #4a2d2d',
                              borderRadius: '6px',
                              padding: '7px 14px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            SOLICITAR AJUSTES / DEVOLVER ↺
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* BOX DE DESCRIÇÃO COM SCROLL */}
                <div className="mission-description-box">
                  <h3>DESCRIÇÃO</h3>
                  <div className="mission-description-content">
                    {renderDescriptionWithLinks(details.mission.description)}
                  </div>
                </div>

                {/* CHECKLIST */}
                <section className="mission-checklist-section" style={{ padding: '14px', background: '#292926', border: '1px solid #333', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#c6ff38', fontSize: '8px', fontWeight: 900, letterSpacing: '1px' }}>CHECKLIST DA MISSÃO</h3>
                  <div className="mission-checklist">
                    {details.checklist.map((item) => (
                      <label key={item.id} className="mission-checklist-item">
                        <input
                          type="checkbox"
                          checked={Boolean(item.isCompleted)}
                          onChange={(event) => { void toggleChecklist(item.id, event.target.checked) }}
                        />
                        <span className={item.isCompleted ? 'done' : ''}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <form className="mission-checklist-form" onSubmit={addChecklist}>
                    <input
                      value={checklistLabel}
                      onChange={(event) => setChecklistLabel(event.target.value)}
                      placeholder="Adicionar item ao checklist…"
                      maxLength={240}
                    />
                    <button type="submit">ADICIONAR</button>
                  </form>
                </section>
              </div>
            )}

            {/* CONTEÚDO DA ABA 2 — ANEXOS */}
            {activeTab === 'attachments' && (
              <div className="mission-tab-panel">
                <section style={{ padding: '16px', background: '#292926', border: '1px solid #333', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 14px', color: '#c6ff38', fontSize: '8px', fontWeight: 900, letterSpacing: '1px' }}>ANEXOS DA MISSÃO</h3>
                  {details.attachments.length > 0 ? (
                    <div className="mission-attachments-list">
                      {details.attachments.map((attachment) => (
                        <a
                          className="mission-attachment"
                          key={attachment.id}
                          href={`/api/projects/${details.mission.projectId}/library/files/${attachment.libraryFileId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>📎 {attachment.fileName}</span>
                          <b>V{attachment.fileVersion} ↓</b>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '0 0 14px', color: '#888', fontSize: '11px' }}>Nenhum arquivo anexado a esta missão ainda.</p>
                  )}
                  <div
                    className={`mission-dropzone ${isDraggingFile ? 'dragging' : ''}`}
                    onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(event) => { event.preventDefault(); void uploadAndAttachFile(event.dataTransfer.files[0]) }}
                  >
                    <label className="mission-dropzone-trigger">
                      <input
                        type="file"
                        onChange={(event) => { void uploadAndAttachFile(event.target.files?.[0]); event.currentTarget.value = '' }}
                      />
                      <span className="mission-dropzone-icon">↑</span>
                      <span>{isUploadingFile ? 'ENVIANDO…' : 'CLIQUE OU ARRASTE UM ARQUIVO'}</span>
                    </label>
                    <p>Solte o arquivo aqui para anexar à biblioteca do projeto e à missão</p>
                  </div>
                </section>
              </div>
            )}

            {/* CONTEÚDO DA ABA 3 — COMENTÁRIOS */}
            {activeTab === 'comments' && (
              <div className="mission-tab-panel">
                <section className="mission-comments" style={{ padding: '16px', background: '#292926', border: '1px solid #333', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 14px', color: '#c6ff38', fontSize: '8px', fontWeight: 900, letterSpacing: '1px' }}>COMENTÁRIOS OPERACIONAIS</h3>
                  <form onSubmit={addComment}>
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Registre uma atualização para o time ou @mencione um colega"
                      maxLength={3000}
                      rows={3}
                    />
                    <button type="submit">COMENTAR</button>
                  </form>
                  {details.comments.length > 0 ? (
                    <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                      {details.comments.map((comment) => (
                        <article key={comment.id} style={{ padding: '10px 12px', background: '#1c1c1a', border: '1px solid #333', borderRadius: '6px' }}>
                          <b style={{ color: '#c6ff38', fontSize: '9px' }}>{comment.author}</b>
                          <p style={{ margin: '4px 0 0', color: '#ddd', fontSize: '11px', lineHeight: 1.45 }}>{comment.body}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '14px 0 0', color: '#888', fontSize: '11px' }}>Nenhum comentário registrado nesta missão.</p>
                  )}
                </section>
              </div>
            )}

            {/* CONTEÚDO DA ABA 4 — HISTÓRICO */}
            {activeTab === 'history' && (
              <div className="mission-tab-panel">
                <section className="mission-history" style={{ padding: '16px', background: '#292926', border: '1px solid #333', borderRadius: '8px', maxHeight: '380px' }}>
                  <h3 style={{ margin: '0 0 14px', color: '#c6ff38', fontSize: '8px', fontWeight: 900, letterSpacing: '1px' }}>TIMELINE & HISTÓRICO AUDITÁVEL</h3>
                  {details.history.length > 0 ? (
                    details.history.map((entry) => (
                      <p key={entry.id} style={{ padding: '8px 0', borderBottom: '1px solid #383834', fontSize: '11px' }}>
                        <small style={{ color: '#888', marginRight: '8px', fontFamily: 'monospace' }}>
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </small>
                        <b style={{ color: '#c6ff38', marginRight: '4px' }}>{entry.actor ?? 'Sistema'}</b> · {entry.detail ?? entry.action}
                      </p>
                    ))
                  ) : (
                    <p style={{ color: '#888', fontSize: '11px' }}>Nenhum histórico registrado.</p>
                  )}
                </section>
              </div>
            )}

            {message && <p className="mission-detail-message" style={{ margin: '14px 0 0' }}>{message}</p>}
          </>
        )}

        {/* MODAL DE SOLICITAÇÃO DE AJUSTES / DEVOLUÇÃO */}
        {isReturnModalOpen && (
          <div className="mission-create-overlay" style={{ zIndex: 100 }} role="dialog" aria-modal="true">
            <form className="mission-create-dialog" onSubmit={handleReturnWorkflow} style={{ maxWidth: '480px' }}>
              <button className="close-button" type="button" onClick={() => setIsReturnModalOpen(false)}>×</button>
              <p style={{ color: '#ff8585', fontWeight: 800, fontSize: '10px' }}>REVISÃO / RETRABALHO</p>
              <h2>Solicitar Ajustes na Missão</h2>

              <label style={{ display: 'grid', gap: '4px', margin: '12px 0' }}>
                <span>DEVOLVER PARA A ETAPA:</span>
                <select
                  value={returnTargetPosition}
                  onChange={(e) => setReturnTargetPosition(Number(e.target.value))}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '8px' }}
                >
                  {completedSteps.map((step) => (
                    <option value={step.position} key={step.id}>
                      {step.position + 1}. {step.departmentName} ({step.responsibleName ?? 'Responsável'})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: '4px', margin: '12px 0' }}>
                <span>MOTIVO DOS AJUSTES (DETALHE O QUE PRECISA SER ALTERADO):</span>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Ex.: Por favor ajustar as fontes do título e alterar a cor do botão principal..."
                  required
                  rows={4}
                  style={{ background: '#1c1c1c', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '8px' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  style={{ background: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}
                >
                  DEVOLVER ETAPA COM AJUSTES →
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}
