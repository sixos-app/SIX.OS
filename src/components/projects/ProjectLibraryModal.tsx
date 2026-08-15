import { useEffect, useState, type FormEvent } from 'react'
import type { Project } from '../../data/dashboard'
import {
  createProjectLibraryFolder,
  getProjectLibrary,
  projectLibrarySeed,
  uploadProjectLibraryFile,
  type ProjectLibrary,
} from '../../data/projectLibraryRepository'
import { ClientMark } from '../shared/ClientMark'

export function ProjectLibraryModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [library, setLibrary] = useState<ProjectLibrary>(projectLibrarySeed)
  const [selectedFolderSlug, setSelectedFolderSlug] = useState(projectLibrarySeed.folders[0]?.slug ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [hasRemoteLibrary, setHasRemoteLibrary] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasRemoteLibrary(false)
    setSelectedFolderSlug(projectLibrarySeed.folders[0]?.slug ?? '')

    void getProjectLibrary(project.id).then((nextLibrary) => {
      if (!isCurrent) return
      setLibrary(nextLibrary)
      setSelectedFolderSlug(nextLibrary.folders[0]?.slug ?? '')
      setHasRemoteLibrary(true)
    }).catch(() => {
      if (isCurrent) setLibrary(projectLibrarySeed)
    }).finally(() => {
      if (isCurrent) setIsLoading(false)
    })

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      isCurrent = false
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, project.id])

  const selectedFolder = library.folders.find((folder) => folder.slug === selectedFolderSlug) ?? library.folders[0]
  const visibleFiles = library.files.filter((file) => file.folderId === selectedFolder?.id)

  async function handleFileSelection(file: File | undefined) {
    if (!file || !selectedFolder || isUploading) return

    setIsUploading(true)
    setUploadMessage('')
    try {
      const uploadedFile = await uploadProjectLibraryFile({ projectId: project.id, folderId: selectedFolder.id, file })
      setLibrary((current) => {
        const previousFile = current.files.find((item) => item.id === uploadedFile.id)
        return {
          files: previousFile ? current.files.map((item) => item.id === uploadedFile.id ? uploadedFile : item) : [uploadedFile, ...current.files],
          folders: previousFile ? current.folders : current.folders.map((folder) => folder.id === selectedFolder.id ? { ...folder, fileCount: folder.fileCount + 1 } : folder),
        }
      })
      setHasRemoteLibrary(true)
      setUploadMessage(uploadedFile.version === 1 ? 'Arquivo enviado para a biblioteca.' : `Nova versão ${uploadedFile.version} enviada.`)
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleFolderCreation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = folderName.trim()
    if (!name || isCreatingFolder) return

    setIsCreatingFolder(true)
    setUploadMessage('')
    try {
      const folder = await createProjectLibraryFolder(project.id, name)
      setLibrary((current) => ({ ...current, folders: [...current.folders, folder] }))
      setSelectedFolderSlug(folder.slug)
      setFolderName('')
      setIsFolderFormOpen(false)
      setUploadMessage('Pasta criada para este projeto.')
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível criar a pasta')
    } finally {
      setIsCreatingFolder(false)
    }
  }

  return (
    <div className="mission-create-overlay project-library-overlay" role="dialog" aria-modal="true" aria-label={`Biblioteca do projeto ${project.name}`}>
      <section className="project-library-dialog">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar biblioteca do projeto">×</button>
        <div className="project-library-head">
          <div>
            <span>BIBLIOTECA DO PROJETO</span>
            <h2>{project.name}</h2>
            <p>{project.client} · {project.code}</p>
          </div>
          <ClientMark project={project} className="project-library-client-mark" />
        </div>
        <div className="project-library-status">
          <span>ARMAZENAMENTO</span>
          <b>Cloudflare R2 conectado na prévia local</b>
          <small>O conteúdo, o histórico e as versões ficam separados dos metadados do D1.</small>
        </div>
        <div className="project-library-layout">
          <div className="project-library-folders">
            <div className="project-library-folders-head">
              <span>PASTAS DO CLIENTE</span>
              <button onClick={() => setIsFolderFormOpen((current) => !current)}>NOVA +</button>
            </div>
            {isFolderFormOpen && (
              <form className="project-library-folder-form" onSubmit={handleFolderCreation}>
                <input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Ex.: Aprovações" maxLength={48} required />
                <button type="submit" disabled={isCreatingFolder}>{isCreatingFolder ? '…' : 'CRIAR'}</button>
              </form>
            )}
            <div>
              {library.folders.map((folder) => (
                <button className={folder.slug === selectedFolder?.slug ? 'selected' : ''} onClick={() => setSelectedFolderSlug(folder.slug)} aria-pressed={folder.slug === selectedFolder?.slug} key={folder.id}>
                  <i>⌁</i>
                  <b>{folder.name}</b>
                  <small>{folder.fileCount} arquivo{folder.fileCount === 1 ? '' : 's'}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="project-library-files">
            <div className="project-library-files-head">
              <div>
                <span>{selectedFolder?.name ?? 'Pasta'}</span>
                <b>{visibleFiles.length} arquivo{visibleFiles.length === 1 ? '' : 's'}</b>
              </div>
              <label className={`project-library-upload ${isUploading ? 'uploading' : ''}`}>
                <input type="file" onChange={(event) => { void handleFileSelection(event.target.files?.[0]); event.currentTarget.value = '' }} disabled={isUploading} />
                {isUploading ? 'ENVIANDO…' : 'ADICIONAR ARQUIVO +'}
              </label>
            </div>
            {uploadMessage && <p className="project-library-message" role="status">{uploadMessage}</p>}
            {isLoading && <small className="project-library-loading">Sincronizando estrutura…</small>}
            {visibleFiles.length > 0 ? (
              <div className="project-library-file-list">
                {visibleFiles.map((file) => (
                  <article key={file.id}>
                    <i>{file.fileType}</i>
                    <div>
                      <b>{file.name}</b>
                      <small>Versão {file.version} · {file.historyCount} registro{file.historyCount === 1 ? '' : 's'} no histórico</small>
                    </div>
                    <a href={`/api/projects/${encodeURIComponent(project.id)}/library/files/${encodeURIComponent(file.id)}`}>BAIXAR</a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="project-library-empty">
                <b>Nenhum arquivo nesta pasta</b>
                <p>{hasRemoteLibrary ? 'Use “Adicionar arquivo” para enviar o primeiro material para esta pasta.' : 'Faça login para consultar a biblioteca persistida deste projeto.'}</p>
              </div>
            )}
          </div>
        </div>
        <div className="project-library-footer">
          <span>MEGA.nz será tratado como link compartilhado opcional, nunca como origem principal.</span>
          <b>ARQUIVOS DE ATÉ 25 MB</b>
        </div>
      </section>
    </div>
  )
}
