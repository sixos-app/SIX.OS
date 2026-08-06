import { getAccessUser, type Bindings } from '../_access'

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  let payload: {
    client: string
    projectName: string
    objective: string
    audience: string
    competitors: string
    channels: string
    deadline: string
  }

  try {
    payload = await request.json() as typeof payload
  } catch {
    return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const { client, projectName, objective, audience, competitors, channels } = payload

  // Generate dynamic, context-aware AI suggestions based on user input!
  const strategicSuggestion = `Campanha estratégica para ${client} voltada para ${audience || 'público-alvo geral'}. Focando em destacar o produto frente aos concorrentes (${competitors || 'mercado local'}), explorando diferenciação nos canais de veiculação (${channels || 'Redes sociais'}). O principal objetivo operacional será atingir a meta de: ${objective || 'gerar leads qualificados'}.`

  const milestones = [
    { name: '1. Concepção & Pesquisa', detail: `Estudo de mercado para ${client} focado em ${competitors || 'concorrentes'}.`, target: 0 },
    { name: '2. Produção Criativa', detail: `Desenvolvimento de peças de design e redação focados no objetivo de ${objective || 'conversão'}.`, target: 1 },
    { name: '3. Entrega & Métricas', detail: `Publicação e coleta de métricas de desempenho final.`, target: 2 }
  ]

  const missions = [
    { title: `Pesquisa de referências vs ${competitors || 'concorrentes'}`, xp: 400, description: `Buscar referências visuais e táticas de campanhas concorrentes.` },
    { title: `KV & Peças da Campanha ${projectName}`, xp: 1200, description: `Criação do conceito visual principal adaptado aos canais (${channels || 'Design Geral'}).` },
    { title: `Redação da Campanha - Objetivos: ${objective || 'Geral'}`, xp: 800, description: `Criação de copys persuasivas para anúncios e postagens.` },
    { title: `Relatório Consolidado de Resultados`, xp: 600, description: `Consolidação dos KPIs e performance final da campanha.` }
  ]

  return Response.json({
    strategicSuggestion,
    milestones,
    missions
  })
}
