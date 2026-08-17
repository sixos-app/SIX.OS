import { useState, type FormEvent } from 'react'
import type { ClientIdentity } from '../../data/clientRepository'
import type { LibraryResource, Project } from '../../data/dashboard'
import { ClientLibraryManager } from './ClientLibraryManager'

export function LibraryPage({ clients, projects, onOpenProject, userId }: { resources?: LibraryResource[]; clients: ClientIdentity[]; projects: Project[]; onOpenProject: (projectId: string) => void; userId?: string }) {
  const [selectedClientId, setSelectedClientId] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; type: string; project: string; client: string; snippet: string }[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const visibleClients = selectedClientId === 'all' ? clients : clients.filter((client) => client.id === selectedClientId)
  const visibleProjects = selectedClientId === 'all' ? projects : projects.filter((project) => project.client === clients.find((client) => client.id === selectedClientId)?.name)
  const selectedClient = clients.find((client) => client.id === selectedClientId)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const response = await fetch(`/api/library/search?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error()
      const data = await response.json() as { results: typeof searchResults }
      setSearchResults(data.results)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <section className="library-page client-directory-page">
      <div className="library-intro">
        <div>
          <p className="eyebrow">DIRETÓRIO DE CLIENTES <span>✦</span></p>
          <h1>Arquivos que<br /><em>contam histórias.</em></h1>
        </div>
        <div className="library-summary">
          <span>CLIENTES ATIVOS</span>
          <b>{clients.length}</b>
          <small>Selecione um cliente para acessar seus projetos e materiais.</small>
        </div>
      </div>
      <form className="client-directory-selector" onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '20px', background: 'none', border: 'none', padding: 0 }}>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} minLength={2} maxLength={120} placeholder="Buscar arquivos por nome, tipo, cliente, projeto ou pasta..." style={{ width: '100%', padding: '12px 14px', background: '#252522', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '12px' }} />
        <button type="submit" style={{ padding: '12px 20px', background: '#8b73ff', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{isSearching ? 'BUSCANDO...' : 'PESQUISAR'}</button>
      </form>
      {searchResults !== null && (
        <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', marginBottom: '24px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '8px', color: '#8b73ff', letterSpacing: '1px', fontWeight: 'bold', textTransform: 'uppercase' }}>ARQUIVOS ENCONTRADOS</span>
            <button onClick={() => { setSearchQuery(''); setSearchResults(null) }} style={{ background: 'none', border: 'none', color: '#85857e', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}>LIMPAR BUSCA</button>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {searchResults.map((item) => (
              <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <b style={{ fontSize: '12px', color: '#fff' }}>{item.title}</b>
                  <span style={{ fontSize: '8px', background: 'rgba(139,115,255,0.15)', color: '#8b73ff', padding: '3px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>{item.type}</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#85857e' }}>Cliente: {item.client} · Origem: {item.project}</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#dfdfd5', lineHeight: 1.4 }}>{item.snippet}</p>
              </div>
            ))}
            {searchResults.length === 0 && <p style={{ fontSize: '11px', color: '#85857e', textAlign: 'center', padding: '20px' }}>Nenhum arquivo encontrado.</p>}
          </div>
        </div>
      )}
      <div className="client-directory-selector">
        <label>
          <span>CLIENTE</span>
          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
            <option value="all">Todos os clientes</option>
            {clients.map((client) => (
              <option value={client.id} key={client.id}>{client.name} · {client.shortCode ?? 'SEM SIGLA'}</option>
            ))}
          </select>
        </label>
        <p>Os arquivos permanentes do cliente ficam nesta biblioteca; campanhas ficam nos projetos.</p>
      </div>
      {selectedClient && <ClientLibraryManager client={selectedClient} userId={userId} />}
      <section className="client-library-index">
        <div className="client-library-index-head">
          <div>
            <span>{selectedClientId === 'all' ? 'TODOS OS CLIENTES' : 'PROJETOS DO CLIENTE'}</span>
            <p>Abra uma frente para acessar sua biblioteca específica de campanha.</p>
          </div>
          <b>{visibleProjects.length} projetos</b>
        </div>
        <div className="client-library-grid">
          {visibleClients.map((client) => {
            const clientProjects = projects.filter((project) => project.client === client.name)
            return (
              <article key={client.id}>
                <div className={`client-library-mark ${client.imageUrl ? 'has-image' : ''}`}>
                  {client.imageUrl ? <img src={client.imageUrl} alt="" /> : client.shortCode ?? client.name.slice(0, 3).toLocaleUpperCase('pt-BR')}
                </div>
                <div>
                  <span>CLIENTE</span>
                  <h2>{client.name}</h2>
                  <p>{clientProjects.length} projeto{clientProjects.length === 1 ? '' : 's'} vinculado{clientProjects.length === 1 ? '' : 's'}</p>
                </div>
                <div className="client-library-projects">
                  {clientProjects.length > 0 ? (
                    clientProjects.map((project) => (
                      <button onClick={() => onOpenProject(project.id)} key={project.id}>
                        <b>{project.name}</b>
                        <small>Biblioteca do projeto · {project.status}</small>
                        <i>↗</i>
                      </button>
                    ))
                  ) : (
                    <p>Este cliente ainda não possui projetos com arquivos.</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        {visibleClients.length === 0 && <p className="empty-state">Cliente não encontrado.</p>}
      </section>
    </section>
  )
}
