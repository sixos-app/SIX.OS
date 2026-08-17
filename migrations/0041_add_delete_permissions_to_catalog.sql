-- Inserir permissoes atomicas de exclusao no catalogo geral de permissoes
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
('projects.delete', 'projects', 'delete', 'Excluir/arquivar projetos.', 'critical'),
('missions.delete', 'missions', 'delete', 'Excluir/cancelar missões.', 'critical');

-- Conceder permissoes de exclusao para administradores tecnicos
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, 'projects.delete', 'all'
FROM access_profiles ap
WHERE ap.code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, 'missions.delete', 'all'
FROM access_profiles ap
WHERE ap.code = 'admin_tech';

-- Conceder permissoes de exclusao para gestao de operacoes
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, 'projects.delete', 'all'
FROM access_profiles ap
WHERE ap.code = 'operations_management';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, 'missions.delete', 'all'
FROM access_profiles ap
WHERE ap.code = 'operations_management';
