import { getEffectiveCapabilities, resolvePermission, type AccessUser, type Bindings, type PermissionScope } from '../functions/api/_access.js'
import assert from 'node:assert'

// Mocking Request
const createMockRequest = () => new Request('http://localhost')

// Mocking AccessUser
const createMockUser = (overrides: Partial<AccessUser> = {}): AccessUser => ({
  id: 'usr_123',
  organizationId: 'org_1',
  teamId: null,
  departmentId: null,
  accessProfileId: 'prof_1',
  managerId: null,
  name: 'Test User',
  email: 'test@example.com',
  role: 'specialist',
  ...overrides,
})

// Mocking DB
const createMockEnv = (mockData: {
  override?: { isGranted: number; scope: PermissionScope } | null
  profile?: { scope: PermissionScope } | null
}): Bindings => {
  return {
    DB: {
      prepare: (query: string) => {
        return {
          bind: (...args: any[]) => ({
            first: async () => {
              if (query.includes('user_permission_overrides')) {
                return mockData.override
              }
              if (query.includes('profile_permissions')) {
                return mockData.profile
              }
              return null
            },
            run: async () => {},
            all: async () => ({ results: [] }),
          }),
        }
      },
    } as any,
  }
}

async function runTests() {
  console.log('--- STARTING RBAC V2 TESTS ---')

  // CASO 1: Perfil possui permissão -> ALLOW
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: { scope: 'own' } })
    const user = createMockUser()
    const res = await resolvePermission(env, req, user, 'missions.view')
    assert.strictEqual(res.granted, true)
    assert.strictEqual(res.source, 'profile')
    assert.strictEqual(res.scope, 'own')
    console.log('CASO 1: OK')
  }

  // CASO 2: Perfil não possui permissão (e V1 também não) -> DENY
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: null })
    const user = createMockUser({ role: 'specialist' }) // specialist doesn't have 'admin.all'
    const res = await resolvePermission(env, req, user, 'admin.all')
    assert.strictEqual(res.granted, false)
    assert.strictEqual(res.source, 'fallback')
    console.log('CASO 2: OK')
  }

  // CASO 3: Perfil possui permissão + override deny -> DENY
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: { isGranted: 0, scope: 'own' }, profile: { scope: 'all' } })
    const user = createMockUser()
    const res = await resolvePermission(env, req, user, 'missions.view')
    assert.strictEqual(res.granted, false)
    assert.strictEqual(res.source, 'override')
    console.log('CASO 3: OK')
  }

  // CASO 4: Perfil não possui permissão + override allow -> ALLOW
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: { isGranted: 1, scope: 'department' }, profile: null })
    const user = createMockUser()
    const res = await resolvePermission(env, req, user, 'missions.view')
    assert.strictEqual(res.granted, true)
    assert.strictEqual(res.source, 'override')
    assert.strictEqual(res.scope, 'department')
    console.log('CASO 4: OK')
  }

  // CASO 5 & 6: Override expirado ou starts_at futuro
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: { scope: 'all' } }) // DB filters it out
    const user = createMockUser()
    const res = await resolvePermission(env, req, user, 'missions.view')
    assert.strictEqual(res.granted, true)
    assert.strictEqual(res.source, 'profile') 
    console.log('CASO 5/6: OK (Simulated via SQL behavior)')
  }

  // CASO 7: Usuário sem access_profile_id -> fallback RBAC V1
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: null })
    const user = createMockUser({ accessProfileId: null, role: 'admin' }) 
    const res = await resolvePermission(env, req, user, 'users.manage')
    assert.strictEqual(res.granted, true)
    assert.strictEqual(res.source, 'fallback')
    console.log('CASO 7: OK')
  }

  // CASO 8: Usuário com RBAC V2 configurado mas sem determinada permissão -> DENY BY DEFAULT
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: null })
    const user = createMockUser({ accessProfileId: 'prof_new', role: 'invalid_role' }) 
    const res = await resolvePermission(env, req, user, 'some.action')
    assert.strictEqual(res.granted, false)
    assert.strictEqual(res.source, 'fallback')
    console.log('CASO 8: OK')
  }

  // CASO 9: Profile de outra organization -> DENY
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: null, profile: null }) 
    const user = createMockUser({ role: 'specialist' }) 
    const res = await resolvePermission(env, req, user, 'admin.all')
    assert.strictEqual(res.granted, false)
    console.log('CASO 9: OK (Simulated via SQL behavior)')
  }

  // CASO 10: Scope corretamente retornado
  {
    const req = createMockRequest()
    const env = createMockEnv({ override: { isGranted: 1, scope: 'participating_projects' }, profile: null })
    const user = createMockUser()
    const res = await resolvePermission(env, req, user, 'projects.view')
    assert.strictEqual(res.scope, 'participating_projects')
    console.log('CASO 10: OK')
  }

  // TESTE EXTRA: Cache funciona
  {
    const req = createMockRequest()
    let queryCount = 0
    const env = {
      DB: {
        prepare: (query: string) => {
          return {
            bind: (...args: any[]) => ({
              first: async () => {
                queryCount++
                return null 
              },
            }),
          }
        },
      } as any,
    }

    const user = createMockUser({ role: 'admin' })
    await resolvePermission(env, req, user, 'ai.use')
    const firstCount = queryCount
    await resolvePermission(env, req, user, 'ai.use')
    const secondCount = queryCount

    assert.strictEqual(firstCount > 0, true)
    assert.strictEqual(firstCount, secondCount) 
    console.log('TESTE CACHE: OK')
  }

  // TESTE EXTRA: Exportação de capabilities usa duas consultas agrupadas
  {
    let queryCount = 0
    const env = {
      DB: {
        prepare: (query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => {
              queryCount++
              if (query.includes('user_permission_overrides')) {
                return { results: [
                  { permissionCode: 'missions.view', isGranted: 0, scope: 'all' },
                  { permissionCode: 'ai.use', isGranted: 1, scope: 'own' },
                ] }
              }
              if (query.includes('profile_permissions')) {
                return { results: [
                  { permissionCode: 'missions.view', scope: 'team' },
                  { permissionCode: 'projects.manage', scope: 'department' },
                ] }
              }
              return { results: [] }
            },
          }),
        }),
      } as any,
    }

    const capabilities = await getEffectiveCapabilities(env, createMockRequest(), createMockUser())
    assert.strictEqual(queryCount, 2)
    assert.deepStrictEqual(capabilities['ai.use'], ['own'])
    assert.strictEqual(capabilities['missions.view'], undefined)
    assert.deepStrictEqual(capabilities['projects.manage'], ['department'])
    console.log('TESTE CAPABILITIES EM LOTE: OK')
  }

  console.log('--- ALL TESTS PASSED ---')
}

runTests().catch(err => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
