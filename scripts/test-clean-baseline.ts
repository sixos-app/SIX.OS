import { execSync } from 'child_process';
import assert from 'assert';

function runSql(query: string) {
  const out = execSync(`npx wrangler d1 execute six-os --local --command "${query}" --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  const jsonStr = out.substring(out.indexOf('['), out.lastIndexOf(']') + 1);
  return JSON.parse(jsonStr)[0]?.results || [];
}

console.log('Running Clean Baseline Assertions...');

// 1. Assert exactly one user exists, and it is agsix@sixos.app
const users = runSql('SELECT * FROM users');
assert.strictEqual(users.length, 1, 'Deve haver exatamente 1 usuário no banco');
assert.strictEqual(users[0].email, 'agsix@sixos.app', 'O único usuário deve ser agsix@sixos.app');
assert.strictEqual(users[0].username, 'agsix', 'O username do master deve ser agsix');
assert.strictEqual(users[0].access_profile_id, 'profile-admin', 'O perfil mestre deve estar associado no users table');

// 2. Assert no business data exists
const emptyTables = [
  'projects', 'clients', 'missions', 'time_entries', 'teams', 
  'development_plans', 'evaluation_cycles', 'gamification_profiles', 'auth_sessions'
];
for (const t of emptyTables) {
  const c = runSql(`SELECT count(*) as c FROM ${t}`)[0].c;
  assert.strictEqual(c, 0, `Tabela ${t} deve estar vazia. Encontrou: ${c}`);
}

// 3. Assert system catalog basics exist
const competencies = runSql('SELECT count(*) as c FROM competencies')[0].c;
assert.ok(competencies > 0, 'Deve existir pelo menos uma competência padrão do sistema');

// 4. Assert RBAC V2 base exists
const profiles = runSql('SELECT count(*) as c FROM access_profiles')[0].c;
assert.ok(profiles > 0, 'Devem existir os perfis de acesso padrao');

const roleAssigns = runSql('SELECT count(*) as c FROM user_role_assignments');
assert.strictEqual(roleAssigns[0].c, 1, 'Deve haver exatamente 1 user_role_assignment V1 para o master para compatibilidade');

console.log('✅ PASS: Clean Baseline Certified.');
