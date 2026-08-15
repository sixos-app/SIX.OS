-- Complete the V2 permission catalog. Once a user has an access profile, the
-- application is deny-by-default and no longer inherits broad V1 grants.
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
('users.manage', 'users', 'manage', 'Gerenciar usuários.', 'critical'),
('roles.manage', 'roles', 'manage', 'Gerenciar perfis e permissões.', 'critical'),
('gamification.manage', 'gamification', 'manage', 'Gerenciar gamificação.', 'high'),
('projects.create', 'projects', 'create', 'Criar projetos.', 'medium'),
('projects.manage', 'projects', 'manage', 'Gerenciar projetos.', 'high'),
('missions.view', 'missions', 'view', 'Visualizar missões.', 'low'),
('missions.create', 'missions', 'create', 'Criar missões.', 'medium'),
('missions.edit', 'missions', 'edit', 'Editar missões.', 'medium'),
('missions.assign', 'missions', 'assign', 'Atribuir missões.', 'high'),
('missions.complete', 'missions', 'complete', 'Concluir missões.', 'medium'),
('missions.approve', 'missions', 'approve', 'Aprovar missões.', 'high'),
('missions.update_own', 'missions', 'update', 'Atualizar missões próprias.', 'low'),
('clients.view', 'clients', 'view', 'Visualizar clientes.', 'medium'),
('clients.create', 'clients', 'create', 'Criar clientes.', 'high'),
('clients.edit', 'clients', 'edit', 'Editar clientes.', 'high'),
('clients.manage', 'clients', 'manage', 'Gerenciar clientes.', 'high'),
('library.view', 'library', 'view', 'Visualizar bibliotecas.', 'medium'),
('library.manage', 'library', 'manage', 'Gerenciar bibliotecas.', 'high'),
('finance.view', 'finance', 'view', 'Visualizar dados financeiros.', 'high'),
('contracts.view', 'contracts', 'view', 'Visualizar contratos.', 'high'),
('contracts.create', 'contracts', 'create', 'Criar contratos.', 'high'),
('demands.view', 'demands', 'view', 'Visualizar demandas.', 'medium'),
('demands.create', 'demands', 'create', 'Criar demandas.', 'medium'),
('time_entries.view', 'time_entries', 'view', 'Visualizar apontamentos.', 'medium'),
('time_entries.create', 'time_entries', 'create', 'Criar apontamentos.', 'low'),
('time_entries.manage', 'time_entries', 'manage', 'Gerenciar apontamentos.', 'high'),
('ai.use', 'ai', 'use', 'Usar recursos de IA.', 'medium'),
('reports.view', 'reports', 'view', 'Visualizar relatórios.', 'high'),
('agenda.team.view', 'agenda', 'view', 'Visualizar e editar agenda da equipe.', 'medium');

-- Technical administrators receive all registered permissions.
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, permission.code, 'all'
FROM access_profiles ap
CROSS JOIN permissions permission
WHERE ap.code = 'admin_tech';

UPDATE profile_permissions
SET scope = 'all'
WHERE profile_id IN (SELECT id FROM access_profiles WHERE code = 'admin_tech');

-- Operations management retains the former V1 bundles.
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, permission.code, 'all'
FROM access_profiles ap
JOIN permissions permission ON permission.code IN (
  'projects.create', 'projects.manage', 'missions.view', 'missions.create', 'missions.edit',
  'missions.assign', 'missions.approve', 'missions.update_own', 'clients.view', 'clients.create',
  'clients.edit', 'clients.manage', 'library.view', 'library.manage', 'ai.use', 'reports.view',
  'agenda.team.view', 'contracts.view', 'contracts.create', 'demands.view', 'demands.create',
  'time_entries.view', 'time_entries.create', 'time_entries.manage'
)
WHERE ap.code = 'operations_management';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, permission.code, 'all'
FROM access_profiles ap
JOIN permissions permission ON permission.code IN (
  'projects.manage', 'missions.view', 'missions.create', 'missions.edit', 'missions.assign',
  'missions.approve', 'missions.update_own', 'library.view', 'agenda.team.view'
)
WHERE ap.code = 'coordinator';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, permission.code, 'all'
FROM access_profiles ap
JOIN permissions permission ON permission.code IN (
  'projects.create', 'missions.view', 'clients.view', 'clients.create', 'clients.edit',
  'clients.manage', 'library.view', 'agenda.team.view', 'demands.view', 'demands.create',
  'time_entries.create'
)
WHERE ap.code = 'service';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, permission.code,
  CASE
    WHEN permission.code = 'library.view' THEN 'participating_projects'
    ELSE 'own'
  END
FROM access_profiles ap
JOIN permissions permission ON permission.code IN (
  'missions.view', 'missions.complete', 'missions.update_own', 'library.view',
  'time_entries.view', 'time_entries.create'
)
WHERE ap.code = 'specialist';
