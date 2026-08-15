import { execSync } from 'child_process';
import crypto from 'crypto';

const isDryRun = process.argv.includes('--dry-run');

if (!process.env.ALLOW_DESTRUCTIVE_TENANT_RESET || process.env.ALLOW_DESTRUCTIVE_TENANT_RESET !== 'YES') {
  console.error('ABORT: Environment variable ALLOW_DESTRUCTIVE_TENANT_RESET=YES is required.');
  process.exit(1);
}

if (!process.env.TARGET_ORGANIZATION_ID) {
  console.error('ABORT: Environment variable TARGET_ORGANIZATION_ID is required.');
  process.exit(1);
}

const targetOrganizationId = process.env.TARGET_ORGANIZATION_ID;
if (!/^[a-zA-Z0-9_-]{2,80}$/.test(targetOrganizationId)) {
  console.error('ABORT: TARGET_ORGANIZATION_ID has an invalid format.');
  process.exit(1);
}

const masterEmail = 'agsix@sixos.app';
const password = process.env.SIXOS_MASTER_PASSWORD;

if (!isDryRun && !password) {
  console.error('ABORT: SIXOS_MASTER_PASSWORD is required for real execution to create master account.');
  process.exit(1);
}

console.log('--- CLEAN AGENCY BASELINE ---');
console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'REAL'}`);
console.log(`Target Organization: ${process.env.TARGET_ORGANIZATION_ID}`);

function runSql(query: string, getOutput = false) {
  if (isDryRun && !getOutput && !query.trim().toUpperCase().startsWith('SELECT') && !query.trim().toUpperCase().startsWith('PRAGMA')) {
    console.log(`[DRY-RUN SKIP] ${query}`);
    return '[]';
  }
  
  try {
    const out = execSync(`npx wrangler d1 execute six-os --local --command "${query}" ${getOutput ? '--json' : ''}`, { 
      stdio: getOutput ? ['pipe', 'pipe', 'ignore'] : 'ignore',
      encoding: 'utf8'
    });
    
    if (getOutput && typeof out === 'string') {
      const jsonStr = out.substring(out.indexOf('['), out.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr)[0]?.results || [];
    }
    return [];
  } catch (err) {
    console.error('ERROR executing query:', query);
    throw err;
  }
}

function getCount(table: string) {
  try {
    const res = runSql(`SELECT count(*) as c FROM ${table}`, true);
    return res[0]?.c || 0;
  } catch {
    return 0;
  }
}

// This legacy reset uses global deletes because several old child tables do not
// carry organization_id. It is safe only when the database contains exactly the
// requested tenant; abort instead of risking a cross-tenant wipe.
const organizations = runSql('SELECT id FROM organizations ORDER BY id', true) as Array<{ id: string }>;
if (organizations.length !== 1 || organizations[0]?.id !== targetOrganizationId) {
  console.error('ABORT: Baseline reset is restricted to a single-tenant database matching TARGET_ORGANIZATION_ID.');
  process.exit(1);
}

// 1. Data Matrix Definitions
const tablesToWipe = [
  'development_checkin_entries',
  'development_checkins',
  'development_evidence',
  'development_actions',
  'development_goals',
  'development_plans',

  'evaluation_debriefs',
  'evaluation_answers',
  'evaluation_responses',
  'evaluation_assignments',
  'evaluation_cycle_participants',
  'evaluation_cycles',

  'time_entries',
  'subtasks',
  'tasks',
  'demands',
  'contracts',

  'agency_feed',
  'external_integrations',

  'mission_history',
  'mission_attachments',
  'mission_comments',
  'mission_checklist_items',
  'mission_assignees',
  'missions',

  'project_library_file_versions',
  'project_library_files',
  'project_library_folders',
  
  'client_library_file_versions',
  'client_library_files',
  'client_library_folders',

  'projects',
  'clients',

  'auth_sessions',
  'gamification_profiles',
  'xp_events',
  'calendar_events',
  
  'user_permission_overrides',
  'user_role_assignments',
  'user_credentials',
  
  'departments',
  'professional_positions',
  'professional_levels',
  
  'teams'
];

const catalogsToWipeIfDemo = [
  'evaluation_questions',
  'evaluation_templates',
  'evaluation_scale_options',
  'evaluation_scales',
  'competencies',
  'competency_categories'
];

console.log('\n[1/3] Counting BEFORE states...');
const beforeCounts: Record<string, number> = {};
for (const t of [...tablesToWipe, ...catalogsToWipeIfDemo, 'users']) {
  beforeCounts[t] = getCount(t);
}

if (isDryRun) {
  console.log('\nDRY-RUN TABLE EXPECTATIONS:');
  console.log('| TABLE | BEFORE | EXPECTED AFTER |');
  for (const t of tablesToWipe) {
    console.log(`| ${t} | ${beforeCounts[t]} | 0 |`);
  }
  for (const t of catalogsToWipeIfDemo) {
    console.log(`| ${t} | ${beforeCounts[t]} | 0 (or strictly system default) |`);
  }
  console.log(`| users | ${beforeCounts['users']} | 1 |`);
  process.exit(0);
}

console.log('\n[2/3] Executing DESTRUCTIVE CLEANUP...');

for (const table of tablesToWipe) {
  runSql(`DELETE FROM ${table};`);
}

for (const table of catalogsToWipeIfDemo) {
  runSql(`DELETE FROM ${table};`);
}

// Wipe all users
runSql(`DELETE FROM users;`);

// Run bootstrap
console.log('\n[3/3] Bootstrapping clean tenant...');
execSync(`npx tsx scripts/bootstrap_clean_tenant.ts`, { stdio: 'inherit', env: process.env });

// Vacuum / FK check
console.log('\nVerifying Foreign Key Integrity...');
const fkCheck = runSql(`PRAGMA foreign_key_check;`, true);
if (fkCheck && fkCheck.length > 0) {
  console.error('CRITICAL: Foreign Key Violations Found!', fkCheck);
  process.exit(1);
} else {
  console.log('PASS: Zero Foreign Key Violations.');
}

console.log('CLEAN AGENCY BASELINE COMPLETED SUCCESSFULLY.');
