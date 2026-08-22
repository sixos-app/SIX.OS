import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repository = process.cwd()
const stateDirectory = mkdtempSync(join(tmpdir(), 'sixos-migration-state-'))
const seedDirectory = mkdtempSync(join(tmpdir(), 'sixos-migration-seed-'))

function d1(args: string[], json = false) {
  const wranglerBin = join(repository, 'node_modules', '.bin', 'wrangler')
  const output = execFileSync(wranglerBin, ['d1', 'execute', 'six-os', '--local', '--persist-to', stateDirectory, ...args, ...(json ? ['--json'] : [])], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (!json) return null
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  assert.ok(start >= 0 && end >= start, `Wrangler did not return JSON: ${output}`)
  return JSON.parse(output.slice(start, end + 1)) as Array<{ results?: Array<Record<string, unknown>> }>
}

function migrationNumber(name: string) {
  return Number(name.slice(0, 4))
}

function compareMigrationNames(a: string, b: string) {
  const numberDifference = migrationNumber(a) - migrationNumber(b)
  if (numberDifference !== 0) return numberDifference
  return a < b ? -1 : a > b ? 1 : 0
}

try {
  const migrationNames = readdirSync(join(repository, 'migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort(compareMigrationNames)
  assert.ok(migrationNames.length > 0, 'No numbered migrations were found')

  for (const name of migrationNames) {
    assert.match(name, /^\d{4}_[a-z0-9_]+\.sql$/, `Invalid migration filename: ${name}`)
  }

  const seedFile = join(seedDirectory, 'seed.sql')
  writeFileSync(seedFile, `
    INSERT INTO evaluation_debriefs (id, organization_id, author_user_id, subject_user_id) VALUES ('audit-debrief', 'org-six', 'user-agsix-admin', 'user-agsix-admin');
    INSERT INTO development_plans (id, organization_id, subject_user_id, created_by, source_debrief_id, title) VALUES ('audit-plan', 'org-six', 'user-agsix-admin', 'user-agsix-admin', 'audit-debrief', 'Audit plan');
    INSERT INTO development_goals (id, organization_id, plan_id, author_user_id, title) VALUES ('audit-goal', 'org-six', 'audit-plan', 'user-agsix-admin', 'Audit goal');
    INSERT INTO development_actions (id, organization_id, goal_id, author_user_id, title) VALUES ('audit-action', 'org-six', 'audit-goal', 'user-agsix-admin', 'Audit action');
    INSERT INTO development_evidence (id, organization_id, action_id, author_user_id, title) VALUES ('audit-evidence', 'org-six', 'audit-action', 'user-agsix-admin', 'Audit evidence');
    INSERT INTO development_checkins (id, organization_id, plan_id, author_user_id, meeting_date) VALUES ('audit-checkin', 'org-six', 'audit-plan', 'user-agsix-admin', '2026-08-09');
    INSERT INTO development_checkin_entries (id, organization_id, checkin_id, author_user_id, entry_text) VALUES ('audit-entry', 'org-six', 'audit-checkin', 'user-agsix-admin', 'Audit entry');
  `)

  const tables = [
    'evaluation_debriefs', 'development_plans', 'development_goals', 'development_actions',
    'development_evidence', 'development_checkins', 'development_checkin_entries',
  ]
  for (const name of migrationNames) {
    const migration = migrationNumber(name)

    if (migration === 21) d1(['--file', seedFile])
    if (migration === 35) {
      d1(['--command', `
        INSERT INTO clients (id, organization_id, name) VALUES ('workflow-upgrade-client', 'org-six', 'Workflow Upgrade Client');
        INSERT INTO projects (id, organization_id, client_id, name, status) VALUES ('workflow-upgrade-project', 'org-six', 'workflow-upgrade-client', 'Workflow Upgrade Project', 'active');
        INSERT INTO missions (id, project_id, client_id, title, status, priority, approval_status) VALUES ('workflow-upgrade-mission', 'workflow-upgrade-project', 'workflow-upgrade-client', 'Workflow Upgrade Mission', 'in_progress', 'normal', 'not_requested');
      `])
    }

    d1(['--file', join('migrations', name)])

    if (migration === 21) {
      for (const table of tables) {
        const rows = d1(['--command', `SELECT COUNT(*) AS count FROM ${table};`], true)?.[0]?.results ?? []
        assert.equal(Number(rows[0]?.count), 1, `${table} was not preserved`)
      }

      const foreignKeys = d1(['--command', 'PRAGMA foreign_key_check;'], true)?.[0]?.results ?? []
      assert.deepEqual(foreignKeys, [], 'migration must leave no foreign-key violations')
    }
  }

  const historicalCredential = d1([
    '--command',
    "SELECT COUNT(*) AS count FROM user_credentials WHERE password_hash = 'rE/3XV2yHGDxylW0NXbz5cJN5bCD+ebD2q18nj1wqY0=';",
  ], true)?.[0]?.results ?? []
  assert.equal(Number(historicalCredential[0]?.count), 0, 'historical administrator credential must be removed')

  const projectColumns = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('projects') WHERE name IN ('visual_tone', 'next_step', 'activity');"], true)?.[0]?.results ?? []
  assert.equal(Number(projectColumns[0]?.count), 3, 'project operational fields must be present')

  const clientDescriptionColumn = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('clients') WHERE name = 'description';"], true)?.[0]?.results ?? []
  assert.equal(Number(clientDescriptionColumn[0]?.count), 1, 'client description field must be present')

  const multiRolePrimaryKey = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('user_role_assignments') WHERE name IN ('user_id', 'role_code') AND pk > 0;"], true)?.[0]?.results ?? []
  assert.equal(Number(multiRolePrimaryKey[0]?.count), 2, 'multi-role assignments must use a composite primary key')

  const agencyDepartments = d1(['--command', "SELECT COUNT(*) AS count FROM departments WHERE organization_id = 'org-six' AND name IN ('Atendimento', 'Planejamento', 'Criação', 'Social Mídia', 'Audiovisual');"], true)?.[0]?.results ?? []
  assert.equal(Number(agencyDepartments[0]?.count), 5, 'the five default agency departments must be present')

  const planningRole = d1(['--command', "SELECT COUNT(*) AS count FROM role_definitions WHERE code = 'service' AND name = 'Planejamento';"], true)?.[0]?.results ?? []
  assert.equal(Number(planningRole[0]?.count), 1, 'the service permission profile must be labeled Planejamento')

  const gamificationTables = d1(['--command', "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('xp_rules', 'xp_rule_roles', 'xp_rule_departments', 'xp_awards');"], true)?.[0]?.results ?? []
  assert.equal(Number(gamificationTables[0]?.count), 4, 'auditable gamification tables must be present')

  const missionRuleColumn = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('missions') WHERE name = 'xp_rule_id';"], true)?.[0]?.results ?? []
  assert.equal(Number(missionRuleColumn[0]?.count), 1, 'missions must support an XP rule')

  const workflowTable = d1(['--command', "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'mission_workflow_steps';"], true)?.[0]?.results ?? []
  assert.equal(Number(workflowTable[0]?.count), 1, 'mission sector workflow table must be present')

  const workflowColumns = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('missions') WHERE name IN ('xp_recipient_user_id', 'current_workflow_position');"], true)?.[0]?.results ?? []
  assert.equal(Number(workflowColumns[0]?.count), 2, 'mission workflow and fixed XP recipient columns must be present')

  const missionDeleteProfiles = d1(['--command', "SELECT COUNT(*) AS count FROM profile_permissions pp JOIN access_profiles ap ON ap.id = pp.profile_id WHERE pp.permission_code = 'missions.delete' AND ap.code IN ('admin_tech', 'operations_management', 'coordinator', 'service');"], true)?.[0]?.results ?? []
  assert.equal(Number(missionDeleteProfiles[0]?.count), 4, 'authorized profiles must be able to cancel missions')

  const participantXpRules = d1(['--command', "SELECT COUNT(*) AS count FROM xp_rules WHERE recipient_mode <> 'participants_each';"], true)?.[0]?.results ?? []
  assert.equal(Number(participantXpRules[0]?.count), 0, 'all mission XP rules must reward each workflow participant')

  const workflowResponsibleColumn = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('mission_workflow_steps') WHERE name = 'responsible_user_id';"], true)?.[0]?.results ?? []
  assert.equal(Number(workflowResponsibleColumn[0]?.count), 1, 'workflow steps must identify their responsible collaborator')

  const workflowFoundation = d1(['--command', "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('workflow_boards', 'workflow_stages', 'mission_stage_history');"], true)?.[0]?.results ?? []
  assert.equal(Number(workflowFoundation[0]?.count), 3, 'mission workflow board tables must be present')

  const missionWorkflowColumns = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('missions') WHERE name IN ('board_id', 'stage_id');"], true)?.[0]?.results ?? []
  assert.equal(Number(missionWorkflowColumns[0]?.count), 2, 'missions must reference a workflow board and stage')

  const defaultWorkflowStages = d1(['--command', "SELECT COUNT(*) AS count FROM workflow_stages stages JOIN workflow_boards boards ON boards.id = stages.board_id WHERE boards.organization_id = 'org-six' AND boards.is_default = 1;"], true)?.[0]?.results ?? []
  assert.equal(Number(defaultWorkflowStages[0]?.count), 6, 'the default mission workflow must have six stages')

  const migratedMissionStage = d1(['--command', "SELECT stages.type FROM missions JOIN workflow_stages stages ON stages.id = missions.stage_id WHERE missions.id = 'workflow-upgrade-mission';"], true)?.[0]?.results ?? []
  assert.equal(migratedMissionStage[0]?.type, 'doing', 'in-progress missions must be migrated to the doing stage')

  const migratedMissionHistory = d1(['--command', "SELECT COUNT(*) AS count FROM mission_stage_history WHERE mission_id = 'workflow-upgrade-mission';"], true)?.[0]?.results ?? []
  assert.equal(Number(migratedMissionHistory[0]?.count), 1, 'existing missions must receive an auditable initial stage history')

  d1(['--command', "UPDATE missions SET approval_status = 'pending' WHERE id = 'workflow-upgrade-mission';"])
  const synchronizedLegacyStatus = d1(['--command', "SELECT stages.type FROM missions JOIN workflow_stages stages ON stages.id = missions.stage_id WHERE missions.id = 'workflow-upgrade-mission';"], true)?.[0]?.results ?? []
  assert.equal(synchronizedLegacyStatus[0]?.type, 'approval', 'legacy approval updates must synchronize the workflow stage')

  const timerColumns = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('time_entries') WHERE name IN ('mission_id', 'started_at', 'ended_at', 'duration_seconds');"], true)?.[0]?.results ?? []
  assert.equal(Number(timerColumns[0]?.count), 4, 'time entries must support mission timers')

  const missionStartedAt = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('missions') WHERE name = 'started_at';"], true)?.[0]?.results ?? []
  assert.equal(Number(missionStartedAt[0]?.count), 1, 'missions must record their first start')

  const agendaRevisionColumn = d1(['--command', "SELECT COUNT(*) AS count FROM pragma_table_info('calendar_events') WHERE name = 'revision' AND type = 'INTEGER';"], true)?.[0]?.results ?? []
  assert.equal(Number(agendaRevisionColumn[0]?.count), 1, 'calendar events must have an optimistic-lock revision')
  const invalidAgendaRevisions = d1(['--command', 'SELECT COUNT(*) AS count FROM calendar_events WHERE revision IS NULL OR revision < 0;'], true)?.[0]?.results ?? []
  assert.equal(Number(invalidAgendaRevisions[0]?.count), 0, 'existing calendar events must receive a valid revision')

  const historicalDemoRows = d1([
    '--command',
    "SELECT (SELECT COUNT(*) FROM projects WHERE id = 'project-shopping-uberaba') + (SELECT COUNT(*) FROM users WHERE id = 'team-guilherme') AS count;",
  ], true)?.[0]?.results ?? []
  assert.equal(Number(historicalDemoRows[0]?.count), 0, 'historical tenant demo rows must be removed')

  const finalForeignKeys = d1(['--command', 'PRAGMA foreign_key_check;'], true)?.[0]?.results ?? []
  assert.deepEqual(finalForeignKeys, [], 'security migrations must leave no foreign-key violations')
  console.log('Populated Evolution migration upgrade passed without data loss.')
} finally {
  rmSync(stateDirectory, { recursive: true, force: true })
  rmSync(seedDirectory, { recursive: true, force: true })
}
