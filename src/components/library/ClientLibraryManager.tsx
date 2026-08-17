import { useEffect, useState, type FormEvent } from 'react'
import {
  createClientLibraryFolder,
  deleteClientLibraryFile,
  getClientLibrary,
  uploadClientLibraryFile,
} from '../../data/clientLibraryRepository'
import type { ClientIdentity } from '../../data/clientRepository'
import { updateClientDescription } from '../../data/clientRepository'
import type { ProjectLibrary } from '../../data/projectLibraryRepository'
import { usePermission } from '../../hooks/usePermission'
import { Icon } from '../shared/Icon'

export function ClientLibraryManager({ client }: { client: ClientIdentity }) {
  const { can } = usePermission()
  const canManageClient = can('clients.manage')
  const canManageLibrary = can('library.manage')
  const [fileView, setFileView] = useState<'list' | 'small' | 'medium' | 'large'>(() => {
    const savedView = window.localStorage.getItem('sixos:client-library-view')
    return savedView === 'list' || savedView === 'small' || savedView === 'large' ? savedView : 'medium'
  })
  const [library, setLibrary] = useState<ProjectLibrary>({ folders: [], files: [] })
  const [folderId, setFolderId] = useState('')
  const [message, setMessage] = useState('')
  const [folderName, setFolderName] = useState('')
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false)
  const [description, setDescription] = useState(client.description ?? '')
  const [isSavingDescription, setIsSavingDescription] = useState(false)

  useEffect(() => {
    setDescription(client.description ?? '')
  }, [client.id, client.description])

  useEffect(() => {
    window.localStorage.setItem('sixos:client-library-view', fileView)
  }, [fileView])

  useEffect(() => {
    void getClientLibrary(client.id)
      .then((next) => {
        setLibrary(next)
        setFolderId(next.folders[0]?.id ?? '')
      })
      .catch(() => setMessage('Não foi possível carregar a biblioteca.'))
  }, [client.id])

  const folder = library.folders.find((item) => item.id === folderId)
  const files = library.files.filter((item) => item.folderId === folderId)

  async function saveDescription() {
    if (isSavingDescription) return
    setIsSavingDescription(true)
    setMessage('')
    try {
      const savedDescription = await updateClientDescription(client.id, description)
      setDescription(savedDescription ?? '')
      window.dispatchEvent(new CustomEvent('sixos:client-description-updated', { detail: { clientId: client.id, description: savedDescription } }))
      setMessage('Descrição do cliente atualizada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a descrição.')
    } finally {
      setIsSavingDescription(false)
    }
  }

  async function upload(file?: File) {
    if (!file || !folderId) return
    try {
      const uploaded = await uploadClientLibraryFile(client.id, folderId, file)
      setLibrary((current) => ({
        folders: current.folders.map((item) => item.id === folderId && !current.files.some((entry) => entry.id === uploaded.id) ? { ...item, fileCount: item.fileCount + 1 } : item),
        files: [uploaded, ...current.files.filter((item) => item.id !== uploaded.id)],
      }))
      setMessage(`Arquivo enviado: versão ${uploaded.version}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha no upload.')
    }
  }

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const created = await createClientLibraryFolder(client.id, folderName)
      setLibrary((current) => ({ ...current, folders: [...current.folders, created] }))
      setFolderId(created.id)
      setFolderName('')
      setIsFolderFormOpen(false)
      setMessage(`Pasta ${created.name} criada.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a pasta.')
    }
  }

  async function removeFile(file: ProjectLibrary['files'][number]) {
    if (!window.confirm(`Excluir “${file.name}”? Esta ação não pode ser desfeita.`)) return
    setMessage('')
    try {
      await deleteClientLibraryFile(client.id, file.id)
      setLibrary((current) => ({
        folders: current.folders.map((item) => item.id === file.folderId ? { ...item, fileCount: Math.max(0, item.fileCount - 1) } : item),
        files: current.files.filter((item) => item.id !== file.id),
      }))
      setMessage('Arquivo excluído.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o arquivo.')
    }
  }

  return (
    <section className="client-library-manager">
      <div className="client-library-manager-head">
        <div className="client-library-title">
          <span>BIBLIOTECA DO CLIENTE</span>
          <h2>{client.name}</h2>
        </div>
        <div className="client-library-description">
          <div>
            <span>DESCRIÇÃO DO CLIENTE</span>
            {canManageClient && <button type="button" onClick={() => void saveDescription()} disabled={isSavingDescription}>{isSavingDescription ? 'SALVANDO…' : 'SALVAR'}</button>}
          </div>
          {canManageClient ? (
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} placeholder="Adicione um resumo do cliente, posicionamento, contexto e informações importantes para a equipe." />
          ) : (
            <p>{description || 'Nenhuma descrição cadastrada para este cliente.'}</p>
          )}
        </div>
      </div>

      <div className="client-library-manager-body">
        <nav className="client-library-folders">
          <div className="client-library-folder-actions">
            <b>PASTAS</b>
            {canManageLibrary && (
              <button className="client-library-folder-add" type="button" aria-label="Nova pasta" title="Nova pasta" onClick={() => setIsFolderFormOpen((current) => !current)}>
                <img className="client-library-folder-add-default" src="/botao mas negativo.svg" alt="" aria-hidden="true" />
                <img className="client-library-folder-add-active" src="/botao mais positivo.svg" alt="" aria-hidden="true" />
              </button>
            )}
          </div>
          {isFolderFormOpen && (
            <form className="client-library-folder-form" onSubmit={createFolder}>
              <input value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={48} placeholder="Nome da pasta" required />
              <button>CRIAR</button>
            </form>
          )}
          <div className="client-library-folder-list">
            {library.folders.map((item) => (
              <button type="button" className={item.id === folderId ? 'selected' : ''} onClick={() => setFolderId(item.id)} key={item.id}>
                <strong>{item.name}</strong>
                <b>{item.fileCount}</b>
              </button>
            ))}
          </div>
        </nav>

        <div className="client-library-content">
          <header>
            <div className="client-library-content-title">
              <b>{folder?.name ?? 'Pasta'}</b>
              <small>{files.length} arquivo{files.length === 1 ? '' : 's'} nesta pasta</small>
            </div>
            <div className="client-library-content-actions">
              <div className="client-library-view-controls" role="group" aria-label="Modo de exibição dos arquivos">
                {(['list', 'small', 'medium', 'large'] as const).map((view) => (
                  <button className={fileView === view ? 'selected' : ''} type="button" aria-label={view === 'list' ? 'Exibir em lista' : `Exibir miniaturas ${view === 'small' ? 'pequenas' : view === 'medium' ? 'médias' : 'grandes'}`} title={view === 'list' ? 'Lista' : `Miniatura ${view === 'small' ? 'pequena' : view === 'medium' ? 'média' : 'grande'}`} onClick={() => setFileView(view)} key={view}>
                    {view === 'list' ? 'LISTA' : view === 'small' ? 'P' : view === 'medium' ? 'M' : 'G'}
                  </button>
                ))}
              </div>
              {canManageLibrary && (
                <label>
                  <input type="file" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
                  ADICIONAR ARQUIVO +
                </label>
              )}
            </div>
          </header>
          {message && <p className="client-library-message">{message}</p>}
          <div className="client-library-files-viewport">
            {files.length ? (
              <div className={`client-library-file-grid view-${fileView}`}>
                {files.map((file) => {
                  const fileUrl = `/api/clients/${client.id}/library/files/${file.id}`
                  const isPreviewableImage = /^image\/(png|jpeg|webp|gif|avif)$/i.test(file.fileType)
                  return (
                    <article className="client-library-file-card" key={file.id}>
                      <a className="client-library-file-preview" href={fileUrl} aria-label={`Baixar ${file.name}`}>
                        {isPreviewableImage ? (
                          <img src={`${fileUrl}?preview=1`} alt={`Miniatura de ${file.name}`} loading="lazy" />
                        ) : (
                          <span>
                            <Icon name="library" size={32} />
                            <b>{file.fileType.split('/').pop()?.toLocaleUpperCase('pt-BR') ?? 'ARQUIVO'}</b>
                          </span>
                        )}
                      </a>
                      <div className="client-library-file-meta">
                        <b title={file.name}>{file.name}</b>
                        <small>{file.fileType.replace('image/', '').toLocaleUpperCase('pt-BR')} · Versão {file.version}</small>
                      </div>
                      <div className="client-library-file-actions">
                        <a className="client-library-file-download" href={fileUrl}>BAIXAR <span>↓</span></a>
                        {canManageLibrary && (
                          <button className="client-library-file-delete" type="button" aria-label={`Excluir ${file.name}`} onClick={() => void removeFile(file)}>
                            EXCLUIR
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="client-library-empty">
                <b>Nenhum arquivo nesta pasta.</b>
                <p>Adicione imagens, documentos e referências permanentes deste cliente.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
