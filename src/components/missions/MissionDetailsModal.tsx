import { useEffect, useState, type FormEvent } from 'react'
import type { Mission } from '../../data/dashboard'
import {
  addMissionChecklistItem,
  addMissionComment,
  attachProjectLibraryFile,
  getMissionDetails,
  requestMissionCompletion,
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

export function MissionDetailsModal({ mission, onClose, onTimerToggle, isTimerPending }: { mission: Mission; onClose: () => void; onTimerToggle: (id: string) => Promise<void>; isTimerPending: boolean }) {
  const [details, setDetails] = useState<MissionDetails | null>(null)
  const [library, setLibrary] = useState<ProjectLibrary>(projectLibrarySeed)
  const [checklistLabel, setChecklistLabel] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [selectedFileId, setSelectedFileId] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [message, setMessage] = useState('')

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
          setMessage('Detalhes carregados, mas a Biblioteca do Projeto não está disponível.')
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
          xpReward: mission.xp,
          ideasReward: mission.ideas,
          rewardLabel: null,
          approvalStatus: mission.approvalStatus ?? 'not_requested',
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
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

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

  async function complete() {
    try {
      const result = await requestMissionCompletion(mission.id)
      setMessage(result.status === 'pending_approval' ? 'Entrega enviada para aprovação.' : 'Missão aprovada e XP liberado.')
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a missão.')
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

  return (
    <div className="mission-create-overlay mission-details-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da missão">
      <section className="mission-details-dialog">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar detalhes da missão">×</button>
        {!details ? (
          <p className="mission-details-loading">Carregando missão…</p>
        ) : (
          <>
            <header>
              <p>MISSÃO</p>
              <h2>{details.mission.title}</h2>
              <span>{details.mission.client} · {details.mission.project}</span>
            </header>

            <div className="mission-details-meta">
              <b>{details.mission.priority.toLocaleUpperCase('pt-BR')}</b>
              <span>{details.mission.assignee ?? 'Responsável a definir'}</span>
              <span>{details.mission.dueAt ? new Date(details.mission.dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Prazo a definir'}</span>
              {details.mission.stageName && <span>{details.mission.stageName.toLocaleUpperCase('pt-BR')}</span>}
              <span>+{details.mission.xpReward} XP</span>
            </div>

            {details.permissions.canTrackTime && (details.mission.stageType === 'backlog' || details.mission.stageType === 'ready' || details.mission.stageType === 'doing') && (
              <button className={`mission-drawer-timer ${details.activeTimer ? 'active' : ''}`} type="button" disabled={isTimerPending} onClick={() => { void toggleTimer() }}>
                {isTimerPending ? 'ATUALIZANDO…' : details.activeTimer ? <><span>Ⅱ PAUSAR</span><b><MissionTimerValue startedAt={details.activeTimer.startedAt} /></b></> : <><span>▶ {details.mission.stageType === 'doing' ? 'CONTINUAR MISSÃO' : 'INICIAR MISSÃO'}</span><b>1 CLIQUE</b></>}
              </button>
            )}

            <p className="mission-details-description">{details.mission.description || 'Sem descrição adicionada.'}</p>

            <div className="mission-details-grid">
              {/* CHECKLIST */}
              <section>
                <h3>CHECKLIST</h3>
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

              {/* ANEXOS */}
              <section>
                <h3>ANEXOS DA MISSÃO</h3>

                {details.attachments.length > 0 && (
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
                  <p>Solte o arquivo aqui para anexar à missão</p>
                </div>
              </section>
            </div>

            <section className="mission-comments">
              <h3>COMENTÁRIOS</h3>
              <form onSubmit={addComment}>
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Registre uma atualização para o time"
                  maxLength={3000}
                />
                <button>COMENTAR</button>
              </form>
              {details.comments.map((comment) => (
                <article key={comment.id}>
                  <b>{comment.author}</b>
                  <p>{comment.body}</p>
                </article>
              ))}
            </section>

            <section className="mission-history">
              <h3>HISTÓRICO</h3>
              {details.history.map((entry) => (
                <p key={entry.id}><b>{entry.actor ?? 'Sistema'}</b> · {entry.detail ?? entry.action}</p>
              ))}
            </section>

            {message && <p className="mission-detail-message">{message}</p>}

            {details.mission.status !== 'completed' && (
              <button className="mission-detail-complete" type="button" onClick={() => { void complete() }}>
                {details.permissions.canApprove ? 'APROVAR E CONCLUIR' : 'ENVIAR PARA APROVAÇÃO'} <span>→</span>
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
