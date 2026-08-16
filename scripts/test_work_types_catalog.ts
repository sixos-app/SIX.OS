import assert from 'node:assert/strict'

type WorkTypeRecord = {
  id: string
  organization_id: string
  name: string
  normalized_name: string
  default_minutes: number
  color_key: string
  is_active: number
  created_at: string
  updated_at: string
}

function normalizeWorkTypeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

class WorkTypesService {
  private records: WorkTypeRecord[] = []

  create(params: {
    organizationId: string
    name: string
    defaultMinutes?: number
    colorKey?: string
  }): { workType: WorkTypeRecord; reactivated?: boolean } {
    const normalized = normalizeWorkTypeName(params.name)
    if (!normalized) throw new Error('Nome inválido.')

    const existing = this.records.find(
      (r) => r.organization_id === params.organizationId && r.normalized_name === normalized
    )

    if (existing) {
      if (existing.is_active === 0) {
        existing.is_active = 1
        existing.default_minutes = params.defaultMinutes ?? existing.default_minutes
        existing.color_key = params.colorKey ?? existing.color_key
        existing.updated_at = new Date().toISOString()
        return { workType: existing, reactivated: true }
      }
      throw new Error(`O tipo de trabalho "${params.name}" já existe nesta organização.`)
    }

    const newRecord: WorkTypeRecord = {
      id: `wt-${crypto.randomUUID()}`,
      organization_id: params.organizationId,
      name: params.name.trim(),
      normalized_name: normalized,
      default_minutes: params.defaultMinutes ?? 60,
      color_key: params.colorKey ?? 'lime',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.records.push(newRecord)
    return { workType: newRecord }
  }

  list(organizationId: string, includeInactive = false): WorkTypeRecord[] {
    return this.records.filter(
      (r) => r.organization_id === organizationId && (includeInactive || r.is_active === 1)
    )
  }

  update(params: {
    id: string
    organizationId: string
    name?: string
    defaultMinutes?: number
    colorKey?: string
    isActive?: boolean
  }): WorkTypeRecord {
    const record = this.records.find(
      (r) => r.id === params.id && r.organization_id === params.organizationId
    )
    if (!record) throw new Error('Tipo de trabalho não encontrado.')

    if (params.name) {
      const normalized = normalizeWorkTypeName(params.name)
      const duplicate = this.records.find(
        (r) =>
          r.organization_id === params.organizationId &&
          r.normalized_name === normalized &&
          r.id !== params.id
      )
      if (duplicate) throw new Error('Nome já em uso por outro tipo de trabalho.')
      record.name = params.name.trim()
      record.normalized_name = normalized
    }

    if (params.defaultMinutes !== undefined) record.default_minutes = params.defaultMinutes
    if (params.colorKey) record.color_key = params.colorKey
    if (params.isActive !== undefined) record.is_active = params.isActive ? 1 : 0
    record.updated_at = new Date().toISOString()

    return record
  }

  deactivate(id: string, organizationId: string): boolean {
    const record = this.records.find((r) => r.id === id && r.organization_id === organizationId)
    if (!record) throw new Error('Tipo de trabalho não encontrado.')
    record.is_active = 0
    record.updated_at = new Date().toISOString()
    return true
  }
}

async function runWorkTypesTests() {
  console.log('🧪 Iniciando testes de Catálogo de Tipos de Trabalho & Multi-tenant...')
  const service = new WorkTypesService()

  const orgA = 'org-agencia-alpha'
  const orgB = 'org-agencia-beta'

  // 1. Criação e normalização em Org A
  const wt1 = service.create({
    organizationId: orgA,
    name: '  Design / Peça Gráfica  ',
    defaultMinutes: 120,
    colorKey: 'purple',
  })
  assert.equal(wt1.workType.name, 'Design / Peça Gráfica')
  assert.equal(wt1.workType.normalized_name, 'design / peca grafica')
  assert.equal(wt1.workType.default_minutes, 120)
  assert.equal(wt1.workType.color_key, 'purple')
  console.log('  ✅ 1. Criação com normalização de acentos e espaços aprovada')

  // 2. Prevenção de duplicidade na mesma organização
  assert.throws(
    () =>
      service.create({
        organizationId: orgA,
        name: 'design / PEÇA GRAFICA',
      }),
    /já existe nesta organização/
  )
  console.log('  ✅ 2. Prevenção de duplicidade por organização aprovada')

  // 3. Mesmo nome em organização diferente (Org B) é permitido
  const wtOrgB = service.create({
    organizationId: orgB,
    name: 'Design / Peça Gráfica',
    defaultMinutes: 180,
    colorKey: 'lime',
  })
  assert.equal(wtOrgB.workType.organization_id, orgB)
  assert.notEqual(wtOrgB.workType.id, wt1.workType.id)
  console.log('  ✅ 3. Isolamento multi-tenant de catálogo aprovado')

  // 4. Listagem isolada
  const listOrgA = service.list(orgA)
  assert.equal(listOrgA.length, 1)
  assert.equal(listOrgA[0].id, wt1.workType.id)

  const listOrgB = service.list(orgB)
  assert.equal(listOrgB.length, 1)
  assert.equal(listOrgB[0].id, wtOrgB.workType.id)
  console.log('  ✅ 4. Listagem e isolamento de tenant validados')

  // 5. Atualização
  const updated = service.update({
    id: wt1.workType.id,
    organizationId: orgA,
    defaultMinutes: 150,
    colorKey: 'blue',
  })
  assert.equal(updated.default_minutes, 150)
  assert.equal(updated.color_key, 'blue')
  console.log('  ✅ 5. Atualização de duração padrão e cor aprovada')

  // 6. Tenant B não pode atualizar registro do Tenant A
  assert.throws(
    () =>
      service.update({
        id: wt1.workType.id,
        organizationId: orgB,
        defaultMinutes: 300,
      }),
    /não encontrado/
  )
  console.log('  ✅ 6. Segurança contra alteração cross-tenant aprovada')

  // 7. Desativação lógica e reativação
  service.deactivate(wt1.workType.id, orgA)
  const activeOnly = service.list(orgA, false)
  assert.equal(activeOnly.length, 0)

  const allRecords = service.list(orgA, true)
  assert.equal(allRecords.length, 1)
  assert.equal(allRecords[0].is_active, 0)

  const reactivated = service.create({
    organizationId: orgA,
    name: 'Design / Peça Gráfica',
    defaultMinutes: 90,
  })
  assert.equal(reactivated.reactivated, true)
  assert.equal(reactivated.workType.is_active, 1)
  assert.equal(reactivated.workType.default_minutes, 90)
  console.log('  ✅ 7. Desativação lógica e reativação limpa aprovadas')

  console.log('🎉 Todos os testes de Catálogo de Tipos de Trabalho passaram com 100% de sucesso!')
}

runWorkTypesTests().catch((err) => {
  console.error('❌ Falha nos testes de tipos de trabalho:', err)
  process.exit(1)
})
