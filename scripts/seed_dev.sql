PRAGMA foreign_keys = ON;

-- 1. Criação Básica (Garante existência da Org)
INSERT OR IGNORE INTO organizations (id, name, slug) VALUES 
('org-six', 'Agência SIX', 'agencia-six');

-- 2. Departamentos e Estrutura Profissional
INSERT OR IGNORE INTO departments (id, organization_id, code, name, description) VALUES 
('dept-tech', 'org-six', 'tech', 'Tecnologia', 'Equipe de TI e Sistemas'),
('dept-design', 'org-six', 'design', 'Design', 'Equipe Criativa'),
('dept-cs', 'org-six', 'cs', 'Atendimento', 'Customer Success');

INSERT OR IGNORE INTO professional_positions (id, organization_id, department_id, code, name) VALUES 
('pos-dev', 'org-six', 'dept-tech', 'dev', 'Desenvolvedor'),
('pos-art', 'org-six', 'dept-design', 'art_director', 'Diretor de Arte'),
('pos-acc', 'org-six', 'dept-cs', 'account_exec', 'Executivo de Contas');

INSERT OR IGNORE INTO professional_levels (id, organization_id, code, name, sort_order) VALUES 
('lvl-jr', 'org-six', 'jr', 'Júnior', 1),
('lvl-pl', 'org-six', 'pl', 'Pleno', 2),
('lvl-sr', 'org-six', 'sr', 'Sênior', 3);

-- 3. Criação de Usuários Demo

-- Administrador (Sem manager, pois é do topo)
INSERT OR IGNORE INTO users (id, organization_id, name, email, role, department_id, access_profile_id, status) VALUES 
('user-agsix-admin', 'org-six', 'Administração SIX', 'agsix@sixos.app', 'admin', 'dept-tech', 'profile-admin', 'active');

-- Coordenador (Lidera a equipe de Design)
INSERT OR IGNORE INTO users (id, organization_id, name, email, role, department_id, access_profile_id, manager_id, status) VALUES 
('user-coord-1', 'org-six', 'Coordenador Demo', 'coord@sixos.app', 'collaborator', 'dept-design', 'profile-coord', 'user-agsix-admin', 'active');

-- Especialistas (Liderados do Coordenador)
INSERT OR IGNORE INTO users (id, organization_id, name, email, role, department_id, access_profile_id, manager_id, status) VALUES 
('user-spec-1', 'org-six', 'Especialista 1', 'spec1@sixos.app', 'collaborator', 'dept-design', 'profile-specialist', 'user-coord-1', 'active'),
('user-spec-2', 'org-six', 'Especialista 2', 'spec2@sixos.app', 'collaborator', 'dept-design', 'profile-specialist', 'user-coord-1', 'active'),
('user-spec-3', 'org-six', 'Especialista 3', 'spec3@sixos.app', 'collaborator', 'dept-design', 'profile-specialist', 'user-coord-1', 'active');

-- Atendimento
INSERT OR IGNORE INTO users (id, organization_id, name, email, role, department_id, access_profile_id, manager_id, status) VALUES 
('user-cs-1', 'org-six', 'Atendimento Demo', 'cs@sixos.app', 'collaborator', 'dept-cs', 'profile-service', 'user-agsix-admin', 'active');


-- 4. Dados Básicos para os Usuários (Gamificação)
INSERT OR IGNORE INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES 
('user-agsix-admin', 500, 10, 'Visionário', 5),
('user-coord-1', 400, 8, 'Coordenador', 3),
('user-spec-1', 200, 2, 'Iniciante', 1),
('user-spec-2', 250, 3, 'Iniciante', 2),
('user-spec-3', 100, 1, 'Novato', 0),
('user-cs-1', 300, 5, 'Intermediário', 4);


-- 5. Módulo Evolução (Escalas, Categorias e Templates)
INSERT OR IGNORE INTO evaluation_scales (id, organization_id, name) VALUES ('scale-01', 'org-six', 'Escala 1 a 5 (Ruim a Excelente)');
INSERT OR IGNORE INTO evaluation_scale_options (id, scale_id, numeric_value, label, sort_order) VALUES 
('opt-1', 'scale-01', 1, 'Insatisfatório', 1),
('opt-2', 'scale-01', 2, 'Abaixo da Expectativa', 2),
('opt-3', 'scale-01', 3, 'Atende a Expectativa', 3),
('opt-4', 'scale-01', 4, 'Acima da Expectativa', 4),
('opt-5', 'scale-01', 5, 'Excepcional', 5);

INSERT OR IGNORE INTO competency_categories (id, organization_id, name, description, sort_order) VALUES 
('cat-core', 'org-six', 'Core Competencies', 'Essencial', 1);

INSERT OR IGNORE INTO competencies (id, organization_id, category_id, name, description, guidance) VALUES 
('comp-com', 'org-six', 'cat-core', 'Comunicação', 'Comunicação clara', 'Avalie a comunicação.');

INSERT OR IGNORE INTO evaluation_templates (id, organization_id, name, scale_id) VALUES ('tpl-360', 'org-six', 'Avaliação 360 Padrão', 'scale-01');

INSERT OR IGNORE INTO evaluation_questions (id, template_id, competency_id, question, type, sort_order) VALUES 
('q-1', 'tpl-360', 'comp-com', 'Avalie a comunicação desta pessoa', 'rating', 1),
('q-2', 'tpl-360', NULL, 'Comentário Geral', 'text', 2);

-- 6. Ciclos de Evolução
INSERT OR IGNORE INTO evaluation_cycles (id, organization_id, name, description, cycle_type, status, starts_at, responses_due_at, results_available_at, template_id, self_confidential, manager_confidential, peer_confidential, direct_report_confidential) 
VALUES ('cycle-dev', 'org-six', 'Ciclo Dev Local', 'Ciclo para teste de preview fullstack', '360', 'active', datetime('now', '-5 days'), datetime('now', '+10 days'), datetime('now', '+15 days'), 'tpl-360', 0, 0, 1, 1);

-- 7. Assignments (Simulando 3 avaliações confidenciais para teste de barreira de 3)
-- user-coord-1 será avaliado (subject) por seus 3 especialistas (reviewers)
INSERT OR IGNORE INTO evaluation_assignments (id, cycle_id, subject_user_id, reviewer_user_id, relationship_type, is_confidential, status) 
VALUES 
('as-1', 'cycle-dev', 'user-coord-1', 'user-spec-1', 'direct_report', 1, 'submitted'),
('as-2', 'cycle-dev', 'user-coord-1', 'user-spec-2', 'direct_report', 1, 'submitted'),
('as-3', 'cycle-dev', 'user-coord-1', 'user-spec-3', 'direct_report', 1, 'pending'), -- Se está pendente, o report tem menos de 3. Vai testar a ofuscação!
('as-4', 'cycle-dev', 'user-agsix-admin', 'user-agsix-admin', 'self', 0, 'pending');

-- 8. Responses e Answers (Preenchendo as 2 submetidas)
INSERT OR IGNORE INTO evaluation_responses (id, assignment_id, status) VALUES 
('res-1', 'as-1', 'submitted'),
('res-2', 'as-2', 'submitted');

INSERT OR IGNORE INTO evaluation_answers (id, response_id, question_id, rating_value, text_value) VALUES 
('ans-1-1', 'res-1', 'q-1', 4, NULL),
('ans-1-2', 'res-1', 'q-2', NULL, 'Bom coordenador'),
('ans-2-1', 'res-2', 'q-1', 5, NULL),
('ans-2-2', 'res-2', 'q-2', NULL, 'Excelente comunicação');
