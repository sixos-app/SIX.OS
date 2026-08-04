export type AdminTeamMember = {
  id: string
  name: string
  email: string
  username: string | null
  role: string
}

export type AdminRole = {
  code: string
  name: string
  description: string
  permissionCount: number
}

export type AdminOverview = {
  team: AdminTeamMember[]
  roles: AdminRole[]
  clientCount: number
}

export const adminOverviewPreview: AdminOverview = {
  clientCount: 3,
  team: [
    { id: 'user-agsix-admin', name: 'Administração SIX', email: 'agsix@sixos.app', username: 'agsix', role: 'admin' },
    { id: 'team-guilherme', name: 'Guilherme', email: 'six.guimell@gmail.com', username: null, role: 'admin' },
    { id: 'team-lorraine', name: 'Lorraine', email: 'lorraine@sixos.app', username: null, role: 'specialist' },
  ],
  roles: [
    { code: 'admin', name: 'Administrador', description: 'Controle completo da organização e das configurações.', permissionCount: 14 },
    { code: 'management', name: 'Gestão', description: 'Visão geral, projetos e aprovações.', permissionCount: 8 },
    { code: 'coordinator', name: 'Coordenador', description: 'Distribuição de missões e coordenação da equipe.', permissionCount: 4 },
    { code: 'service', name: 'Atendimento', description: 'Clientes, projetos, briefings e acompanhamento.', permissionCount: 3 },
    { code: 'specialist', name: 'Especialista', description: 'Execução das próprias missões e envio de arquivos.', permissionCount: 1 },
  ],
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await fetch('/api/admin/overview', { headers: { Accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Não foi possível carregar a administração.')
  return response.json() as Promise<AdminOverview>
}
