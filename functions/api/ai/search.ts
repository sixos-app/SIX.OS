import { getAccessUser, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').trim().toLowerCase()

  // Simulated AI semantic database of files and campaigns indexed
  const corpus = [
    { id: '1', title: 'Identidade Visual & Key Visual (KV)', type: 'Design', project: 'KV Criativo', client: 'Coca-Cola', tags: ['branding', 'visual', 'coca-cola', 'logo', 'design'], snippet: 'Design do Key Visual principal da campanha de verão.' },
    { id: '2', title: 'Relatório Final de Performance Q2', type: 'Relatório', project: 'Campanha Q2', client: 'Banco Itaú', tags: ['pdf', 'analytics', 'performance', 'financeiro', 'roi'], snippet: 'KPIs, custo por lead e impressões consolidadas do trimestre.' },
    { id: '3', title: 'Redação das Copys de Lançamento', type: 'Redação', project: 'Lançamento App', client: 'Nike', tags: ['copy', 'nike', 'instagram', 'texto', 'anúncio'], snippet: 'Textos e copys finais para posts do Instagram e anúncios do Meta Ads.' },
    { id: '4', title: 'Contrato de Parceria & Termos de Uso', type: 'Contrato', project: 'Jurídico', client: 'Google', tags: ['contrato', 'jurídico', 'pdf', 'legal', 'parceria'], snippet: 'Minuta final de termos de cooperação operacional SIX-Google.' },
    { id: '5', title: 'Manual da Marca e Brandbook 2026', type: 'Design', project: 'Manual', client: 'Nike', tags: ['branding', 'manual', 'nike', 'marca', 'design'], snippet: 'Diretrizes de aplicação de logotipo e paleta de cores primárias.' }
  ]

  // Filter based on query. Semantic matching simulated by matching query words with tags, title, client, or snippet!
  const results = corpus.filter(item => {
    if (!query) return true
    return item.title.toLowerCase().includes(query) ||
           item.project.toLowerCase().includes(query) ||
           item.client.toLowerCase().includes(query) ||
           item.snippet.toLowerCase().includes(query) ||
           item.tags.some(tag => query.includes(tag) || tag.includes(query))
  })

  return Response.json({
    query,
    results
  })
}
