'use client'

import { useState, useMemo, useRef } from 'react'
import {
  INVESTOR_TYPES, GENERAL_TYPES, SOURCES,
  stagesFor, stageLabel, typeLabel, sourceLabel, sourcePlaceholder,
  PRIORITY_DOT, PRIORITY_LABEL,
  type Board, type Contact, type Priority,
} from '@/lib/crm'

type CustomTypes = { investor: string[]; general: string[] }
type SortCol = 'name' | 'company' | 'type' | 'stage' | 'priority' | 'next_action_date' | 'updated_at'

export default function CrmBoard({ initialContacts, initialCustomTypes }: { initialContacts: Contact[]; initialCustomTypes: CustomTypes }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [customTypes, setCustomTypes] = useState<CustomTypes>(initialCustomTypes)
  const [board, setBoard] = useState<Board>('investor')

  // Filters (per board — kept in two separate state objects)
  const [filterP, setFilterP] = useState<{ priority: string; type: string; source: string; stage: string; action: string; search: string; showLost: boolean }>(emptyFilters())
  const [filterG, setFilterG] = useState<{ priority: string; type: string; source: string; stage: string; action: string; search: string; showLost: boolean }>(emptyFilters())
  const filters = board === 'investor' ? filterP : filterG
  const setFilters = board === 'investor' ? setFilterP : setFilterG

  const [showAdd, setShowAdd] = useState<{ open: boolean; prefill?: Partial<Contact> }>({ open: false })
  const [editing, setEditing] = useState<Contact | null>(null)

  // Per-board view preference + sort state (Table view only)
  const [viewP, setViewP] = useState<'kanban' | 'table'>('table')
  const [viewG, setViewG] = useState<'kanban' | 'table'>('table')
  const view = board === 'investor' ? viewP : viewG
  const setView = board === 'investor' ? setViewP : setViewG

  const [sortP, setSortP] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'updated_at', dir: 'desc' })
  const [sortG, setSortG] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'updated_at', dir: 'desc' })
  const sort = board === 'investor' ? sortP : sortG
  const setSort = board === 'investor' ? setSortP : setSortG

  // Counts per board
  const investorCount = useMemo(() => contacts.filter(c => c.board === 'investor' && !c.is_lost).length, [contacts])
  const generalCount  = useMemo(() => contacts.filter(c => c.board === 'general'  && !c.is_lost).length, [contacts])

  // Visible after filters (for current board)
  const visible = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekFromNow = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10)
    return contacts.filter(c => {
      if (c.board !== board) return false
      if (c.is_lost && !filters.showLost) return false
      if (filters.priority !== 'all' && c.priority !== filters.priority) return false
      if (filters.type !== 'all' && c.contact_type !== filters.type) return false
      if (filters.source !== 'all' && c.met_at_source !== filters.source) return false
      if (filters.stage !== 'all' && c.stage !== filters.stage) return false
      if (filters.action !== 'all') {
        const d = c.next_action_date
        if (filters.action === 'overdue'   && !(d && d < today)) return false
        if (filters.action === 'this_week' && !(d && d >= today && d <= weekFromNow)) return false
        if (filters.action === 'none'      && (c.next_action || d)) return false
        if (filters.action === 'future'    && !(d && d > today)) return false
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const hay = [c.name, c.company, c.title, c.notes, c.met_at_details].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [contacts, board, filters])

  const lostHidden = contacts.filter(c => c.board === board && c.is_lost).length

  const stages = stagesFor(board)
  const grouped = useMemo(() => {
    const m: Record<string, Contact[]> = {}
    for (const s of stages) m[s.key] = []
    for (const c of visible) {
      if (c.is_lost) continue
      if (m[c.stage]) m[c.stage].push(c)
    }
    return m
  }, [visible, stages])
  const lostVisible = visible.filter(c => c.is_lost)

  // ─── API actions ─────────────────────────────────────────────
  async function createContact(payload: Partial<Contact>) {
    const res = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok && data.contact) setContacts([data.contact, ...contacts])
    return res.ok ? null : (data.error || 'Failed')
  }
  async function updateContact(id: string, patch: Partial<Contact>) {
    const res = await fetch(`/api/crm/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const data = await res.json()
    if (res.ok && data.contact) setContacts(contacts.map(c => c.id === id ? data.contact : c))
    return res.ok ? null : (data.error || 'Failed')
  }
  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    const res = await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' })
    if (res.ok) { setContacts(contacts.filter(c => c.id !== id)); setEditing(null) }
  }
  async function addCustomType(label: string, b: Board) {
    const res = await fetch('/api/crm/custom-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, board: b }) })
    const data = await res.json()
    if (res.ok && data.customTypes) setCustomTypes(data.customTypes)
  }

  // Drag handlers
  const dragId = useRef<string | null>(null)
  function onDragStart(id: string) { dragId.current = id }
  async function onDropToStage(stageKey: string) {
    const id = dragId.current; dragId.current = null
    if (!id) return
    const c = contacts.find(x => x.id === id)
    if (!c || c.stage === stageKey) return
    // optimistic
    setContacts(contacts.map(x => x.id === id ? { ...x, stage: stageKey } : x))
    await updateContact(id, { stage: stageKey })
  }

  // Excel export — both boards as two sheets, respecting each board's filters
  async function exportExcel() {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    for (const b of ['investor', 'general'] as Board[]) {
      const f = b === 'investor' ? filterP : filterG
      const rows = applyFilters(contacts.filter(c => c.board === b), f, customTypes)
      const sheet = rowsToSheet(XLSX, rows, customTypes)
      // Transparency footer at the bottom of the sheet
      const totalForBoard = contacts.filter(c => c.board === b).length
      const filtersDesc = describeFilters(f)
      XLSX.utils.sheet_add_aoa(sheet, [
        [],
        [`Filters applied: ${filtersDesc} · ${rows.length} of ${totalForBoard} ${b === 'investor' ? 'investor' : 'general'} contacts shown`],
      ], { origin: -1 })
      XLSX.utils.book_append_sheet(wb, sheet, b === 'investor' ? 'Investors' : 'General')
    }
    XLSX.writeFile(wb, `raisesea-crm-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const anyFilterActive = ['priority', 'type', 'source', 'stage', 'action'].some(k => (filters as Record<string, string | boolean>)[k] !== 'all') || filters.search.length > 0 || filters.showLost

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Fundraising CRM</h1>
          <p className="text-sm text-text-tertiary mt-1">Track investors + general contacts. Drag cards between stages.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center border border-border-strong rounded-md overflow-hidden">
            <button onClick={() => setView('table')}
              className={`text-xs font-medium px-2.5 py-1.5 transition ${view === 'table' ? 'bg-brand text-white' : 'bg-white text-text-secondary hover:bg-surface-muted'}`}>
              ☰ Table
            </button>
            <button onClick={() => setView('kanban')}
              className={`text-xs font-medium px-2.5 py-1.5 transition border-l border-border-strong ${view === 'kanban' ? 'bg-brand text-white' : 'bg-white text-text-secondary hover:bg-surface-muted'}`}>
              📋 Kanban
            </button>
          </div>
          <button onClick={() => setShowAdd({ open: true })}
            className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap">
            + Add contact
          </button>
          <button onClick={exportExcel}
            className="text-xs font-medium border border-border-strong rounded-md px-3 py-1.5 hover:border-text-tertiary transition whitespace-nowrap">
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        <TabBtn active={board === 'investor'} onClick={() => setBoard('investor')}>💰 Investors ({investorCount})</TabBtn>
        <TabBtn active={board === 'general'}  onClick={() => setBoard('general')}>🤝 General ({generalCount})</TabBtn>
      </div>

      {/* Quick stats for current board */}
      <QuickStats board={board} contacts={contacts.filter(c => c.board === board && !c.is_lost)} />

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Filter</div>
          {anyFilterActive && <button onClick={() => board === 'investor' ? setFilterP(emptyFilters()) : setFilterG(emptyFilters())} className="text-[11px] text-brand hover:underline">Reset all</button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <FilterSelect label="Priority" value={filters.priority} onChange={v => setFilters({ ...filters, priority: v })}
            options={[['all', 'All priorities'], ['high', '🔴 High'], ['medium', '🟡 Medium'], ['low', '🟢 Low']]} />
          <FilterSelect label="Type" value={filters.type} onChange={v => setFilters({ ...filters, type: v })}
            options={[['all', 'All types'], ...typeOptionsFor(board, customTypes)]} />
          <FilterSelect label="Met at" value={filters.source} onChange={v => setFilters({ ...filters, source: v })}
            options={[['all', 'All sources'], ...SOURCES.map(s => [s.key, s.label] as [string, string])]} />
          <FilterSelect label="Stage" value={filters.stage} onChange={v => setFilters({ ...filters, stage: v })}
            options={[['all', 'All stages'], ...stages.map(s => [s.key, s.label] as [string, string])]} />
          <FilterSelect label="Next action" value={filters.action} onChange={v => setFilters({ ...filters, action: v })}
            options={[['all', 'All'], ['overdue', '🔴 Overdue'], ['this_week', '🟡 This week'], ['future', '✅ Has future'], ['none', '⚪ No action set']]} />
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search name, company, title, notes…"
            className="flex-1 w-full sm:w-auto sm:min-w-[200px] text-xs border border-border-strong rounded-md px-2 py-1.5 focus:outline-none focus:border-brand" />
          <label className="text-xs text-text-tertiary flex items-center gap-1.5">
            <input type="checkbox" checked={filters.showLost} onChange={e => setFilters({ ...filters, showLost: e.target.checked })} />
            Show archived ({lostHidden})
          </label>
        </div>
        <div className="text-[11px] text-text-tertiary mt-2">{visible.length} contact{visible.length === 1 ? '' : 's'} match</div>
      </div>

      {/* Kanban OR Table view */}
      {view === 'kanban' ? (
        <div className="grid gap-2.5 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${stages.length + (filters.showLost && lostVisible.length > 0 ? 1 : 0)}, minmax(220px, 1fr))` }}>
          {stages.map(stg => (
            <Column key={stg.key} title={stg.label} count={grouped[stg.key].length}
              onDrop={() => onDropToStage(stg.key)}>
              {grouped[stg.key].map(c => (
                <ContactCard key={c.id} contact={c} customTypes={customTypes}
                  onDragStart={() => onDragStart(c.id)}
                  onClick={() => setEditing(c)} />
              ))}
            </Column>
          ))}
          {filters.showLost && lostVisible.length > 0 && (
            <Column title="Lost / Archived" count={lostVisible.length} lost>
              {lostVisible.map(c => (
                <ContactCard key={c.id} contact={c} customTypes={customTypes} dimmed onClick={() => setEditing(c)} />
              ))}
            </Column>
          )}
        </div>
      ) : (
        <ContactTable
          contacts={visible}
          board={board}
          customTypes={customTypes}
          sort={sort}
          onSortChange={setSort}
          onRowClick={c => setEditing(c)}
          onStageChange={(id, stage) => updateContact(id, { stage })}
          onPriorityChange={(id, priority) => updateContact(id, { priority })}
        />
      )}

      {showAdd.open && (
        <ContactModal mode="create" customTypes={customTypes}
          prefill={showAdd.prefill}
          onAddCustomType={addCustomType}
          onClose={() => setShowAdd({ open: false })}
          onSave={async (p) => {
            const err = await createContact(p)
            if (!err) setShowAdd({ open: false })
            return err
          }}
        />
      )}
      {editing && (
        <ContactModal mode="edit" customTypes={customTypes}
          existing={editing}
          onAddCustomType={addCustomType}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            const err = await updateContact(editing.id, p)
            if (!err) setEditing(null)
            return err
          }}
          onDelete={() => deleteContact(editing.id)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
function emptyFilters() {
  return { priority: 'all', type: 'all', source: 'all', stage: 'all', action: 'all', search: '', showLost: false }
}

function typeOptionsFor(board: Board, customTypes: CustomTypes): [string, string][] {
  const sys = board === 'investor' ? INVESTOR_TYPES : GENERAL_TYPES
  const custom = customTypes[board].map(label => [label, label] as [string, string])
  return [...sys.map(t => [t.key, t.label] as [string, string]), ...custom]
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-sm px-3 py-1.5 border-b-2 transition ${active ? 'border-brand text-brand font-medium' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
      {children}
    </button>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-text-disabled mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-xs border border-border-strong rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-brand">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function QuickStats({ board, contacts }: { board: Board; contacts: Contact[] }) {
  const byStage = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of contacts) m[c.stage] = (m[c.stage] || 0) + 1
    return m
  }, [contacts])
  const highlights = board === 'investor'
    ? [
        { label: 'Active', value: contacts.length },
        { label: 'In DD', value: byStage['due_diligence'] || 0 },
        { label: 'Term sheets', value: byStage['term_sheet'] || 0 },
        { label: 'Closed-won', value: byStage['closed_won'] || 0 },
      ]
    : [
        { label: 'Active', value: contacts.length },
        { label: 'Meeting scheduled', value: byStage['meeting_scheduled'] || 0 },
        { label: 'MoU signed', value: byStage['mou_signed'] || 0 },
        { label: 'Deals signed', value: byStage['deal_signed'] || 0 },
      ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {highlights.map(h => (
        <div key={h.label} className="bg-white border border-border rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-tertiary">{h.label}</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">{h.value}</div>
        </div>
      ))}
    </div>
  )
}

function Column({ title, count, lost, onDrop, children }: { title: string; count: number; lost?: boolean; onDrop?: () => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div className={`rounded-xl p-2 ${lost ? 'bg-surface-muted' : over ? 'bg-[#f4f9f5]' : 'bg-surface-muted'}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop?.() }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary px-1 pb-2 flex justify-between">
        <span>{title}</span><span className="text-text-disabled">{count}</span>
      </div>
      <div className="space-y-2 min-h-[40px]">{children}</div>
    </div>
  )
}

function ContactCard({ contact, customTypes, onDragStart, onClick, dimmed }: { contact: Contact; customTypes: CustomTypes; onDragStart?: () => void; onClick?: () => void; dimmed?: boolean }) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = contact.next_action_date && contact.next_action_date < today
  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} onClick={onClick}
      className={`bg-white border rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition ${dimmed ? 'opacity-60 border-border' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{contact.name}</div>
          {contact.company && <div className="text-[11px] text-text-tertiary truncate">{contact.company}{contact.title ? ` · ${contact.title}` : ''}</div>}
        </div>
        <span className="text-xs flex-shrink-0" title={`Priority: ${PRIORITY_LABEL[contact.priority]}`}>{PRIORITY_DOT[contact.priority]}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        <span className="text-[10px] bg-surface-muted text-text-secondary px-1.5 py-0.5 rounded-full">{typeLabel(contact.contact_type, customTypes)}</span>
        {contact.next_action && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-danger-text' : 'bg-warning-bg text-warning-text'}`}>
            {overdue ? '🔴 ' : '⏰ '}{contact.next_action}{contact.next_action_date ? ` · ${shortDate(contact.next_action_date)}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// ─── Table view ─────────────────────────────────────────────────────
function ContactTable({ contacts, board, customTypes, sort, onSortChange, onRowClick, onStageChange, onPriorityChange }: {
  contacts: Contact[]
  board: Board
  customTypes: CustomTypes
  sort: { col: SortCol; dir: 'asc' | 'desc' }
  onSortChange: (s: { col: SortCol; dir: 'asc' | 'desc' }) => void
  onRowClick: (c: Contact) => void
  onStageChange: (id: string, stage: string) => void
  onPriorityChange: (id: string, priority: Priority) => void
}) {
  const stages = stagesFor(board)
  const today = new Date().toISOString().slice(0, 10)

  const sorted = useMemo(() => {
    const priRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
    const stageIdx: Record<string, number> = {}
    stages.forEach((s, i) => { stageIdx[s.key] = i })
    const arr = [...contacts]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sort.col) {
        case 'name':             cmp = a.name.localeCompare(b.name); break
        case 'company':          cmp = (a.company || '').localeCompare(b.company || ''); break
        case 'type':             cmp = typeLabel(a.contact_type, customTypes).localeCompare(typeLabel(b.contact_type, customTypes)); break
        case 'stage':            cmp = (stageIdx[a.stage] ?? 99) - (stageIdx[b.stage] ?? 99); break
        case 'priority':         cmp = priRank[a.priority] - priRank[b.priority]; break
        case 'next_action_date': cmp = (a.next_action_date || '\uffff').localeCompare(b.next_action_date || '\uffff'); break
        case 'updated_at':       cmp = a.updated_at.localeCompare(b.updated_at); break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [contacts, sort, stages, customTypes])

  function clickHeader(col: SortCol) {
    if (sort.col === col) onSortChange({ col, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    else onSortChange({ col, dir: 'asc' })
  }
  const arrow = (col: SortCol) => sort.col === col ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b border-border">
            <tr className="text-left">
              <Th col="name" sort={sort} onClick={clickHeader} arrow={arrow}>Name · Title</Th>
              <Th col="company" sort={sort} onClick={clickHeader} arrow={arrow}>Company</Th>
              <Th col="type" sort={sort} onClick={clickHeader} arrow={arrow}>Type</Th>
              <Th col="stage" sort={sort} onClick={clickHeader} arrow={arrow}>Stage</Th>
              <Th col="priority" sort={sort} onClick={clickHeader} arrow={arrow}>Priority</Th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Next action</th>
              <Th col="next_action_date" sort={sort} onClick={clickHeader} arrow={arrow}>Due</Th>
              <th className="px-3 py-2 text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Met at</th>
              <Th col="updated_at" sort={sort} onClick={clickHeader} arrow={arrow}>Updated</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-text-tertiary py-8 text-sm">Nothing matches. Try clearing filters above.</td></tr>
            ) : sorted.map(c => {
              const overdue = c.next_action_date && c.next_action_date < today
              return (
                <tr key={c.id} onClick={() => onRowClick(c)}
                  className={`cursor-pointer hover:bg-[#f4f9f5]/40 ${c.is_lost ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-text-primary">{c.name}</div>
                    {c.title && <div className="text-[11px] text-text-tertiary">{c.title}</div>}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{c.company || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] bg-surface-muted text-text-secondary px-1.5 py-0.5 rounded-full whitespace-nowrap">{typeLabel(c.contact_type, customTypes)}</span>
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <select value={c.stage} onChange={e => onStageChange(c.id, e.target.value)}
                      className="text-xs border border-border rounded px-1.5 py-1 bg-white focus:outline-none focus:border-brand cursor-pointer">
                      {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <select value={c.priority} onChange={e => onPriorityChange(c.id, e.target.value as Priority)}
                      className="text-xs border border-border rounded px-1.5 py-1 bg-white focus:outline-none focus:border-brand cursor-pointer">
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-text-secondary max-w-[180px] truncate" title={c.next_action || ''}>{c.next_action || '—'}</td>
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${overdue ? 'text-danger-text font-medium' : 'text-text-tertiary'}`}>
                    {c.next_action_date ? (overdue ? '🔴 ' : '') + shortDate(c.next_action_date) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-text-tertiary">{sourceLabel(c.met_at_source) || '—'}</td>
                  <td className="px-3 py-2 text-xs text-text-tertiary whitespace-nowrap">{relativeDate(c.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ col, sort, onClick, arrow, children }: {
  col: SortCol
  sort: { col: SortCol; dir: 'asc' | 'desc' }
  onClick: (col: SortCol) => void
  arrow: (col: SortCol) => string
  children: React.ReactNode
}) {
  const active = sort.col === col
  return (
    <th onClick={() => onClick(col)}
      className={`px-3 py-2 text-[10px] uppercase tracking-wide font-medium cursor-pointer select-none hover:text-text-primary whitespace-nowrap ${active ? 'text-brand' : 'text-text-tertiary'}`}>
      {children}{arrow(col)}
    </th>
  )
}

// ─── Helpers for Excel ─────────────────────────────────────────────
function applyFilters(contacts: Contact[], f: ReturnType<typeof emptyFilters>, _customTypes: CustomTypes): Contact[] {
  const today = new Date().toISOString().slice(0, 10)
  const weekFromNow = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10)
  return contacts.filter(c => {
    if (c.is_lost && !f.showLost) return false
    if (f.priority !== 'all' && c.priority !== f.priority) return false
    if (f.type !== 'all' && c.contact_type !== f.type) return false
    if (f.source !== 'all' && c.met_at_source !== f.source) return false
    if (f.stage !== 'all' && c.stage !== f.stage) return false
    if (f.action !== 'all') {
      const d = c.next_action_date
      if (f.action === 'overdue'   && !(d && d < today)) return false
      if (f.action === 'this_week' && !(d && d >= today && d <= weekFromNow)) return false
      if (f.action === 'none'      && (c.next_action || d)) return false
      if (f.action === 'future'    && !(d && d > today)) return false
    }
    if (f.search) {
      const q = f.search.toLowerCase()
      const hay = [c.name, c.company, c.title, c.notes, c.met_at_details].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function rowsToSheet(XLSX: typeof import('xlsx'), rows: Contact[], customTypes: CustomTypes) {
  type Row = Record<string, string | number>
  const data: Row[] = rows.map(c => ({
    Name: c.name,
    Title: c.title || '',
    Company: c.company || '',
    'Contact type': typeLabel(c.contact_type, customTypes),
    Stage: stageLabel(c.board, c.stage),
    Priority: PRIORITY_LABEL[c.priority],
    Status: c.is_lost ? 'Lost' : 'Active',
    Email: c.email || '',
    Phone: c.phone || '',
    LinkedIn: c.linkedin_url || '',
    'Met at': sourceLabel(c.met_at_source) || '',
    'Met where': c.met_at_details || '',
    'Next action': c.next_action || '',
    'Next action date': c.next_action_date || '',
    Notes: c.notes || '',
    'Date added': new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    'Last updated': new Date(c.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 8 },
    { wch: 26 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 22 }, { wch: 16 },
    { wch: 50 }, { wch: 14 }, { wch: 14 },
  ]
  return ws
}

function describeFilters(f: ReturnType<typeof emptyFilters>): string {
  const bits: string[] = []
  if (f.priority !== 'all') bits.push(`Priority=${f.priority}`)
  if (f.type !== 'all') bits.push(`Type=${f.type}`)
  if (f.source !== 'all') bits.push(`Source=${f.source}`)
  if (f.stage !== 'all') bits.push(`Stage=${f.stage}`)
  if (f.action !== 'all') bits.push(`Action=${f.action}`)
  if (f.search) bits.push(`Search="${f.search}"`)
  if (f.showLost) bits.push('Lost shown')
  return bits.length === 0 ? 'None (all active contacts)' : bits.join(', ')
}

// ─── The big modal: create or edit ─────────────────────────────────
type ContactModalProps = {
  mode: 'create' | 'edit'
  customTypes: CustomTypes
  prefill?: Partial<Contact>
  existing?: Contact
  onAddCustomType: (label: string, board: Board) => Promise<void> | void
  onClose: () => void
  onSave: (payload: Partial<Contact>) => Promise<string | null>
  onDelete?: () => void
}
function ContactModal({ mode, customTypes, prefill, existing, onAddCustomType, onClose, onSave, onDelete }: ContactModalProps) {
  const seed: Partial<Contact> = existing || prefill || {}
  const [name, setName] = useState(seed.name || '')
  const [title, setTitle] = useState(seed.title || '')
  const [company, setCompany] = useState(seed.company || '')
  const [email, setEmail] = useState(seed.email || '')
  const [phone, setPhone] = useState(seed.phone || '')
  const [linkedin, setLinkedin] = useState(seed.linkedin_url || '')
  const [type, setType] = useState(seed.contact_type || 'vc_fund')
  const [stage, setStage] = useState(seed.stage || 'to_contact')
  const [priority, setPriority] = useState<Priority>((seed.priority as Priority) || 'medium')
  const [source, setSource] = useState(seed.met_at_source || '')
  const [where, setWhere] = useState(seed.met_at_details || '')
  const [notes, setNotes] = useState(seed.notes || '')
  const [nextAction, setNextAction] = useState(seed.next_action || '')
  const [nextDate, setNextDate] = useState(seed.next_action_date || '')
  const [isLost, setIsLost] = useState(Boolean(seed.is_lost))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showScan, setShowScan] = useState(false)
  const [appendNote, setAppendNote] = useState('')

  // Determine board from the selected type (falls back to general)
  const typeBoard: Board =
    INVESTOR_TYPES.some(t => t.key === type) ? 'investor' :
    GENERAL_TYPES.some(t => t.key === type) ? 'general' :
    customTypes.investor.includes(type) ? 'investor' :
    customTypes.general.includes(type) ? 'general' :
    'general'

  const stagesAvailable = stagesFor(typeBoard)
  // Reset stage if it doesn't fit the current board
  if (!stagesAvailable.some(s => s.key === stage)) {
    // do this outside render in real React, but for simplicity we just adjust the option list
  }

  function applyExtracted(ext: { name: string; title: string; company: string; email: string; phone: string; linkedin_url: string }) {
    if (ext.name) setName(ext.name)
    if (ext.title) setTitle(ext.title)
    if (ext.company) setCompany(ext.company)
    if (ext.email) setEmail(ext.email)
    if (ext.phone) setPhone(ext.phone)
    if (ext.linkedin_url) setLinkedin(ext.linkedin_url)
    // Default source to "Business card scan" when scan succeeds
    if (!source) setSource('card_scan')
    if (!where) setWhere(`Scanned ${new Date().toLocaleDateString('en-US')}`)
    setShowScan(false)
  }

  async function save() {
    if (!name.trim()) { setErr('Name required'); return }
    setBusy(true); setErr(null)
    // Append the new note (if any) to existing notes, with a timestamp prefix
    let finalNotes = notes
    if (appendNote.trim()) {
      const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      finalNotes = `${stamp} — ${appendNote.trim()}\n${notes || ''}`.trim()
    }
    const payload: Partial<Contact> = {
      name: name.trim(),
      title: title.trim() || null, company: company.trim() || null,
      email: email.trim() || null, phone: phone.trim() || null, linkedin_url: linkedin.trim() || null,
      contact_type: type, board: typeBoard, stage,
      priority,
      is_lost: isLost,
      met_at_source: source || null, met_at_details: where.trim() || null,
      notes: finalNotes || null,
      next_action: nextAction.trim() || null,
      next_action_date: nextDate || null,
    }
    const e = await onSave(payload)
    if (e) { setErr(e); setBusy(false) }
  }

  // Type options for the current board context, including a separator + custom + "Add new"
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full my-6 max-h-[calc(100vh-3rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-text-primary">{mode === 'create' ? 'Add contact' : 'Edit contact'}</h2>
          <div className="flex items-center gap-2">
            {mode === 'create' && (
              <button onClick={() => setShowScan(true)} className="text-xs border border-border-strong rounded-md px-2.5 py-1 hover:border-text-tertiary">📷 Scan business card</button>
            )}
            <button onClick={onClose} className="text-text-disabled hover:text-text-secondary">×</button>
          </div>
        </div>

        {showScan && <ScanCard onExtracted={applyExtracted} onCancel={() => setShowScan(false)} />}

        <div className="p-5 space-y-5">
          {err && <div className="bg-danger-bg border border-danger-border text-danger-text text-sm rounded-md p-2.5">{err}</div>}

          {/* ─── Identity ─── */}
          <section>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">Contact</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name *"><input value={name} onChange={e => setName(e.target.value)} className={inputCls} /></Field>
              <Field label="Title"><input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} /></Field>
              <Field label="Company / Firm"><input value={company} onChange={e => setCompany(e.target.value)} className={inputCls} /></Field>
              <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></Field>
              <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></Field>
              <Field label="LinkedIn URL"><input value={linkedin} onChange={e => setLinkedin(e.target.value)} className={inputCls} /></Field>
            </div>
          </section>

          {/* ─── Categorization ─── */}
          <section className="pt-5 border-t border-border-muted">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">Categorize</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <TypePicker label="Contact type" board={typeBoard} value={type} onChange={setType}
                customTypes={customTypes}
                onAddCustom={async (label, b) => { await onAddCustomType(label, b); setType(label) }} />
              <Field label="Stage">
                <select value={stage} onChange={e => setStage(e.target.value)} className={inputCls}>
                  {stagesAvailable.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Priority">
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as Priority[]).map(p => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${priority === p ? 'bg-brand text-white border-brand font-medium' : 'bg-white text-text-secondary border-border-strong hover:border-text-tertiary'}`}>
                    {PRIORITY_DOT[p]} {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </Field>
          </section>

          {/* ─── Where you met ─── */}
          <section className="pt-5 border-t border-border-muted">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">Where you met</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Source">
                <select value={source} onChange={e => setSource(e.target.value)} className={inputCls}>
                  <option value="">Not specified</option>
                  {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Details">
                <input value={where} onChange={e => setWhere(e.target.value)} placeholder={sourcePlaceholder(source)} className={inputCls} />
              </Field>
            </div>
          </section>

          {/* ─── Action tracking ─── */}
          <section className="pt-5 border-t border-border-muted">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2.5">Next steps</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Next action"><input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Send updated deck" className={inputCls} /></Field>
              <Field label="Next action date"><input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={inputCls} /></Field>
            </div>

            {mode === 'edit' && (
              <div className="mb-3">
                <Field label="Add note (timestamped, prepended to the log)">
                  <textarea value={appendNote} onChange={e => setAppendNote(e.target.value)} rows={2} placeholder="e.g. Had 30-min call. Interested but wants traction proof." className={inputCls} />
                </Field>
              </div>
            )}

            <Field label={mode === 'edit' ? 'Notes log' : 'Notes'}>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className={inputCls} />
            </Field>
          </section>

          {mode === 'edit' && (
            <section className="pt-5 border-t border-border-muted">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={isLost} onChange={e => setIsLost(e.target.checked)} />
                Mark as Lost / Archived
              </label>
            </section>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-border px-5 py-3 flex items-center justify-between rounded-b-xl">
          <div>
            {mode === 'edit' && onDelete && (
              <button onClick={onDelete} className="text-xs text-danger-text hover:underline">Delete contact</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm border border-border-strong rounded-md px-3 py-1.5">Cancel</button>
            <button onClick={save} disabled={busy} className="text-sm bg-brand hover:bg-brand-hover text-white rounded-md px-3 py-1.5 disabled:opacity-50">
              {busy ? 'Saving…' : (mode === 'create' ? 'Add contact' : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full text-sm bg-white border border-border-strong rounded-md px-2.5 py-1.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Contact type picker with custom-type add flow ─────────────────
function TypePicker({ label, board, value, onChange, customTypes, onAddCustom }: {
  label: string; board: Board; value: string; onChange: (v: string) => void; customTypes: CustomTypes;
  onAddCustom: (label: string, board: Board) => Promise<void> | void;
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftBoard, setDraftBoard] = useState<Board>(board)

  async function addNow() {
    const v = draft.trim()
    if (!v) return
    await onAddCustom(v, draftBoard)
    setDraft(''); setAdding(false)
  }

  return (
    <Field label={label}>
      <select value={value} onChange={e => { if (e.target.value === '__add__') setAdding(true); else onChange(e.target.value) }} className={inputCls}>
        <optgroup label="Investor">
          {INVESTOR_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          {customTypes.investor.map(l => <option key={'ci_' + l} value={l}>{l}</option>)}
        </optgroup>
        <optgroup label="General">
          {GENERAL_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          {customTypes.general.map(l => <option key={'cg_' + l} value={l}>{l}</option>)}
        </optgroup>
        <option value="__add__">+ Add custom type…</option>
      </select>
      {adding && (
        <div className="mt-2 bg-surface-muted border border-border rounded-md p-2 space-y-2">
          <div className="text-xs text-text-tertiary">Add a new contact type (saved to your account only).</div>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="e.g. Sovereign wealth fund" className={inputCls} />
          <div className="flex items-center gap-2 text-xs">
            <span>For board:</span>
            <button type="button" onClick={() => setDraftBoard('investor')} className={`px-2 py-1 rounded border ${draftBoard === 'investor' ? 'bg-brand text-white border-brand' : 'border-border-strong'}`}>💰 Investor</button>
            <button type="button" onClick={() => setDraftBoard('general')} className={`px-2 py-1 rounded border ${draftBoard === 'general' ? 'bg-brand text-white border-brand' : 'border-border-strong'}`}>🤝 General</button>
            <button type="button" onClick={addNow} className="ml-auto text-xs bg-brand text-white rounded px-2 py-1">Add</button>
            <button type="button" onClick={() => { setAdding(false); setDraft('') }} className="text-xs text-text-tertiary">Cancel</button>
          </div>
        </div>
      )}
    </Field>
  )
}

// ─── Card scan UI ──────────────────────────────────────────────────
function ScanCard({ onExtracted, onCancel }: { onExtracted: (ext: { name: string; title: string; company: string; email: string; phone: string; linkedin_url: string }) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setBusy(true); setErr(null)
    try {
      // Read into base64 (in browser memory only — never uploaded to storage)
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1] || '')
        r.onerror = () => rej(new Error('File read failed'))
        r.readAsDataURL(file)
      })
      const r = await fetch('/api/crm/scan-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })
      const data = await r.json()
      if (!r.ok || !data.extracted) throw new Error(data.error || 'Scan failed')
      onExtracted(data.extracted)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Scan failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-blue-50 border-y border-blue-200 p-4">
      <div className="text-sm font-medium text-blue-900 mb-2">📷 Scan a business card</div>
      <p className="text-xs text-blue-800 mb-2.5">Upload or snap a photo. The image is processed in-memory by Gemini AI to extract the contact details. <strong>The image is not stored anywhere.</strong> Review the extracted fields before saving.</p>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" disabled={busy}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        className="text-xs" />
      {busy && <div className="text-xs text-blue-800 mt-2">⏳ Extracting…</div>}
      {err && <div className="text-xs text-danger-text mt-2">{err}</div>}
      <button onClick={onCancel} className="text-xs text-text-tertiary mt-2 hover:underline">Cancel</button>
    </div>
  )
}

// (end of file)
