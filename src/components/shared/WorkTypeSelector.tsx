import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  WORK_TYPE_COLORS,
  createWorkType,
  formatWorkTypeMinutes,
  type WorkType,
  type WorkTypeColorKey,
} from '../../data/workTypeRepository'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export type WorkTypeSelectorProps = {
  workTypes: WorkType[]
  mode?: 'single' | 'multiple'
  selectedId?: string | null
  selectedIds?: string[]
  onChangeSingle?: (workType: WorkType | null) => void
  onChangeMultiple?: (selectedIds: string[]) => void
  onWorkTypeCreated?: (newWorkType: WorkType) => void
  placeholder?: string
  allowCreation?: boolean
  label?: string
}

export function WorkTypeSelector({
  workTypes,
  mode = 'single',
  selectedId,
  selectedIds = [],
  onChangeSingle,
  onChangeMultiple,
  onWorkTypeCreated,
  placeholder = 'Selecione o tipo de trabalho...',
  allowCreation = true,
}: WorkTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMinutes, setNewMinutes] = useState(60)
  const [newColor, setNewColor] = useState<WorkTypeColorKey>('lime')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Map of color key to hex
  const colorMap = useMemo(() => {
    return Object.fromEntries(WORK_TYPE_COLORS.map((c) => [c.key, c.hex]))
  }, [])

  // Active filtered types
  const filteredTypes = useMemo(() => {
    const query = normalize(search)
    if (!query) return workTypes.filter((t) => t.isActive)
    return workTypes.filter((t) => t.isActive && normalize(t.name).includes(query))
  }, [workTypes, search])

  // Single mode selected type
  const selectedType = useMemo(() => {
    if (mode !== 'single' || !selectedId) return null
    return workTypes.find((t) => t.id === selectedId) ?? null
  }, [workTypes, selectedId, mode])

  // Multiple mode selected types
  const selectedMultipleTypes = useMemo(() => {
    if (mode !== 'multiple') return []
    const set = new Set(selectedIds)
    return workTypes.filter((t) => set.has(t.id))
  }, [workTypes, selectedIds, mode])

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setSearch('')
        setError('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && !isCreating) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
      setHighlightedIndex(0)
    }
  }, [isOpen, isCreating])

  function handleSelect(type: WorkType) {
    if (mode === 'single') {
      if (selectedId === type.id) {
        onChangeSingle?.(null)
      } else {
        onChangeSingle?.(type)
      }
      setIsOpen(false)
      setSearch('')
      triggerRef.current?.focus()
    } else {
      const next = selectedIds.includes(type.id)
        ? selectedIds.filter((id) => id !== type.id)
        : [...selectedIds, type.id]
      onChangeMultiple?.(next)
    }
  }

  function handleRemoveMultiple(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChangeMultiple?.(selectedIds.filter((item) => item !== id))
  }

  function startCreation() {
    setIsCreating(true)
    setNewName(search.trim())
    setNewMinutes(60)
    setNewColor('lime')
    setError('')
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setIsSaving(true)
    setError('')
    try {
      const created = await createWorkType({
        name: newName.trim(),
        defaultMinutes: newMinutes,
        colorKey: newColor,
      })
      onWorkTypeCreated?.(created)
      if (mode === 'single') {
        onChangeSingle?.(created)
        setIsOpen(false)
      } else {
        onChangeMultiple?.([...selectedIds, created.id])
      }
      setIsCreating(false)
      setSearch('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tipo de trabalho.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setIsCreating(false)
      triggerRef.current?.focus()
      return
    }

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (isCreating) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filteredTypes.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTypes[highlightedIndex]) {
        handleSelect(filteredTypes[highlightedIndex])
      } else if (allowCreation && search.trim()) {
        startCreation()
      }
    }
  }

  return (
    <div className="work-type-selector" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={`work-type-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {mode === 'single' ? (
          selectedType ? (
            <div className="work-type-selected-single">
              <span
                className="work-type-color-bar"
                style={{ backgroundColor: colorMap[selectedType.colorKey] ?? '#c6ff38' }}
              />
              <span className="work-type-name">{selectedType.name}</span>
              <span className="work-type-duration-pill">
                {formatWorkTypeMinutes(selectedType.defaultMinutes)}
              </span>
            </div>
          ) : (
            <span className="work-type-trigger-placeholder">{placeholder}</span>
          )
        ) : (
          <div className="work-type-chips">
            {selectedMultipleTypes.length > 0 ? (
              selectedMultipleTypes.map((type) => (
                <span key={type.id} className="work-type-chip">
                  <span
                    className="work-type-color-badge"
                    style={{ backgroundColor: colorMap[type.colorKey] ?? '#c6ff38' }}
                  />
                  <b>{type.name}</b>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveMultiple(type.id, e)}
                    aria-label={`Remover ${type.name}`}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="work-type-trigger-placeholder">{placeholder}</span>
            )}
          </div>
        )}
        <span style={{ color: '#888', fontSize: '10px', marginLeft: 'auto' }}>▾</span>
      </button>

      {isOpen && (
        <div className="work-type-dropdown" role="listbox">
          {!isCreating ? (
            <>
              <input
                ref={searchInputRef}
                className="work-type-search-input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setHighlightedIndex(0)
                }}
                placeholder="Pesquisar tipo de trabalho..."
              />

              <div className="work-type-list">
                {filteredTypes.length > 0 ? (
                  filteredTypes.map((type, idx) => {
                    const isSelected =
                      mode === 'single'
                        ? selectedId === type.id
                        : selectedIds.includes(type.id)
                    const isHighlighted = idx === highlightedIndex

                    return (
                      <button
                        key={type.id}
                        type="button"
                        className={`work-type-item ${isSelected ? 'selected' : ''} ${
                          isHighlighted ? 'highlighted' : ''
                        }`}
                        onClick={() => handleSelect(type)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                      >
                        <div className="work-type-item-info">
                          <span
                            className="work-type-color-bar"
                            style={{ backgroundColor: colorMap[type.colorKey] ?? '#c6ff38' }}
                          />
                          <span className="work-type-name">{type.name}</span>
                        </div>
                        <div className="work-type-item-meta">
                          <span className="work-type-duration-pill">
                            {formatWorkTypeMinutes(type.defaultMinutes)}
                          </span>
                          {isSelected && <span style={{ color: '#c6ff38', fontWeight: 'bold' }}>✓</span>}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div style={{ padding: '8px', textAlign: 'center', color: '#888', fontSize: '11px' }}>
                    Nenhum tipo de trabalho encontrado.
                  </div>
                )}
              </div>

              {allowCreation && (
                <button
                  type="button"
                  className="work-type-add-button"
                  onClick={startCreation}
                >
                  + {search.trim() ? `Criar tipo "${search.trim()}"` : 'Novo tipo de trabalho'}
                </button>
              )}
            </>
          ) : (
            <form className="work-type-create-form" onSubmit={handleCreateSubmit}>
              <h4>NOVO TIPO DE TRABALHO</h4>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do tipo (ex.: Anúncio Estático)"
                maxLength={80}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>
                  <span style={{ fontSize: '8px', color: '#888', fontWeight: 800 }}>DURAÇÃO PADRÃO (HORAS)</span>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    max="168"
                    value={(newMinutes / 60).toString()}
                    onChange={(e) => {
                      const hrs = parseFloat(e.target.value) || 1
                      setNewMinutes(Math.round(hrs * 60))
                    }}
                  />
                </label>
                <div>
                  <span style={{ fontSize: '8px', color: '#888', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                    PALETA DE COR
                  </span>
                  <div className="work-type-palette">
                    {WORK_TYPE_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`work-type-palette-dot ${newColor === c.key ? 'selected' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setNewColor(c.key)}
                        title={c.label}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {error && <p style={{ margin: '4px 0', color: '#ff6b6b', fontSize: '10px' }}>{error}</p>}

              <div className="work-type-create-actions">
                <button type="submit" className="work-type-btn-save" disabled={isSaving}>
                  {isSaving ? 'CRIANDO...' : 'SALVAR E SELECIONAR'}
                </button>
                <button
                  type="button"
                  className="work-type-btn-cancel"
                  onClick={() => {
                    setIsCreating(false)
                    setError('')
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
