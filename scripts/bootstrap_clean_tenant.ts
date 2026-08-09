import { execSync } from 'child_process';
import crypto from 'crypto';

const masterEmail = 'agsix@sixos.app';
const masterUsername = 'agsix';
const masterName = 'Admin Tech';
const password = process.env.SIXOS_MASTER_PASSWORD;

if (!password) {
  console.error('ERROR: SIXOS_MASTER_PASSWORD environment variable is required to create the master account.');
  process.exit(1);
}

const ORG_ID = 'org-six';
const TARGET_PROFILE = 'profile-admin';

console.log('--- STARTING CLEAN TENANT BOOTSTRAP ---');

function runSql(query) {
  try {
    execSync(`npx wrangler d1 execute six-os --local --command "${query}"`, { stdio: 'ignore' });
  } catch (err) {
    console.error('ERROR executing query:', query);
    throw err;
  }
}

import fs from 'fs';

function runSqlBatch(query) {
  const tmpFile = `.wrangler/tmp_bootstrap_${Date.now()}.sql`;
  fs.writeFileSync(tmpFile, query);
  try {
    execSync(`npx wrangler d1 execute six-os --local --file="${tmpFile}"`, { stdio: 'ignore' });
  } catch (err) {
    console.error('ERROR executing query:', query);
    throw err;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// Ensure the organization exists (it should be created by migrations ideally, but we ensure it here)
runSql(`INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('${ORG_ID}', 'SIX.OS Agency', 'six-os');`);

// Seed System Catalogs
runSqlBatch(`
INSERT OR IGNORE INTO competency_categories (id, organization_id, name, description) 
VALUES ('cat-sys-1', '${ORG_ID}', 'Competências Essenciais', 'Competências base do sistema');

INSERT OR IGNORE INTO competencies (id, organization_id, category_id, name, description, is_active) 
VALUES ('comp-sys-1', '${ORG_ID}', 'cat-sys-1', 'Comunicação', 'Comunicação clara e objetiva', 1);

INSERT OR IGNORE INTO evaluation_scales (id, organization_id, name) 
VALUES ('scale-sys-1', '${ORG_ID}', 'Escala Padrão SIX.OS');

INSERT OR IGNORE INTO evaluation_scale_options (id, scale_id, label, numeric_value, sort_order) VALUES
('opt-sys-1', 'scale-sys-1', 'Muito Abaixo', 1, 1),
('opt-sys-2', 'scale-sys-1', 'Abaixo', 2, 2),
('opt-sys-3', 'scale-sys-1', 'Dentro do Esperado', 3, 3),
('opt-sys-4', 'scale-sys-1', 'Acima', 4, 4),
('opt-sys-5', 'scale-sys-1', 'Excepcional', 5, 5);

INSERT OR IGNORE INTO evaluation_templates (id, organization_id, name, scale_id)
VALUES ('template-sys-1', '${ORG_ID}', 'Template Base SIX.OS', 'scale-sys-1');

INSERT OR IGNORE INTO evaluation_questions (id, template_id, competency_id, question, type, required, sort_order)
VALUES ('q-sys-1', 'template-sys-1', 'comp-sys-1', 'Avalie a comunicação do colaborador', 'scale', 1, 1);
`);

// 1. Generate PBKDF2 hash for password
const saltBytes = crypto.randomBytes(16);
const saltStr = saltBytes.toString('base64');
const hashBytes = crypto.pbkdf2Sync(password, saltBytes, 310000, 32, 'sha256');
const hashStr = hashBytes.toString('base64');

// Create Master User
console.log('Creating Master User...');
const userId = crypto.randomUUID();
runSql(`INSERT INTO users (id, organization_id, name, email, username, role, access_profile_id, status) VALUES ('${userId}', '${ORG_ID}', '${masterName}', '${masterEmail}', '${masterUsername}', 'admin', '${TARGET_PROFILE}', 'active');`);
runSql(`INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES ('${userId}', '${saltStr}', '${hashStr}', 310000);`);
// No need to insert into user_role_assignments V1 because V2 uses access_profile_id. Wait, does RBAC V2 fallback or V1 assignments exist?
// It's safer to ensure it just in case:
runSql(`INSERT INTO user_role_assignments (user_id, role_code) VALUES ('${userId}', 'admin');`);

console.log('Clean tenant bootstrap complete.');
