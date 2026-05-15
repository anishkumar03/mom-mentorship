'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Lead = {
  id: string
  full_name: string
  email: string
  phone: string | null
  market: string
  experience: string
  struggling_with: string | null
  how_found: string | null
  status: string
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new:        'bg-blue-500/10 text-blue-400 border-blue-500/30',
  contacted:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  interested: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enrolled:   'bg-green-500/10 text-green-400 border-green-500/30',
  declined:   'bg-red-500/10 text-red-400 border-red-500/30',
}

const STATUS_OPTIONS = ['new', 'contacted', 'interested', 'enrolled', 'declined']

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner:     '0–1 yr',
  intermediate: '1–3 yrs',
  experienced:  '3+ yrs',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMarket, setFilterMarket] = useState('all')
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(leads.map(l => l.id === id ? { ...l, status } : l))
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  async function saveNotes() {
    if (!selected) return
    setSaving(true)
    await supabase.from('leads').update({ notes }).eq('id', selected.id)
    setLeads(leads.map(l => l.id === selected.id ? { ...l, notes } : l))
    setSelected({ ...selected, notes })
    setSaving(false)
  }

  function openLead(lead: Lead) {
    setSelected(lead)
    setNotes(lead.notes || '')
  }

  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (filterMarket !== 'all' && l.market !== filterMarket) return false
    if (search && !l.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !l.email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const markets = [...new Set(leads.map(l => l.market))]

  // Stats
  const stats = {
    total:      leads.length,
    new:        leads.filter(l => l.status === 'new').length,
    interested: leads.filter(l => l.status === 'interested').length,
    enrolled:   leads.filter(l => l.status === 'enrolled').length,
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Students who applied through your join form
            </p>
          </div>
          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Leads',  value: stats.total,      color: 'text-white' },
            { label: 'New',          value: stats.new,        color: 'text-blue-400' },
            { label: 'Interested',   value: stats.interested, color: 'text-purple-400' },
            { label: 'Enrolled',     value: stats.enrolled,   color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-sm">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Lead list */}
          <div className="flex-1 min-w-0">

            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-green-500"
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <select
                value={filterMarket}
                onChange={e => setFilterMarket(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-green-500"
              >
                <option value="all">All Markets</option>
                {markets.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? (
                <div className="text-center py-16 text-gray-500">Loading leads...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500">No leads found</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Market</th>
                      <th className="px-4 py-3 text-left">Experience</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(lead => (
                      <tr
                        key={lead.id}
                        onClick={() => openLead(lead)}
                        className={`border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                          selected?.id === lead.id ? 'bg-gray-800/70' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-white text-sm">{lead.full_name}</p>
                          <p className="text-gray-500 text-xs">{lead.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-300 text-sm">{lead.market}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-400 text-sm">
                            {EXPERIENCE_LABELS[lead.experience] || lead.experience}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={lead.status}
                            onChange={e => {
                              e.stopPropagation()
                              updateStatus(lead.id, e.target.value)
                            }}
                            onClick={e => e.stopPropagation()}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border bg-transparent cursor-pointer focus:outline-none ${
                              STATUS_COLORS[lead.status] || STATUS_COLORS.new
                            }`}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s} className="bg-gray-900 text-white">
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(lead.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 shrink-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-8">
                {/* Close */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Lead Details</h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 font-bold text-lg">
                    {selected.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{selected.full_name}</p>
                    <p className="text-gray-400 text-sm">{selected.email}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-5">
                  {[
                    { label: 'Phone',      value: selected.phone || '—' },
                    { label: 'Market',     value: selected.market },
                    { label: 'Experience', value: EXPERIENCE_LABELS[selected.experience] || selected.experience },
                    { label: 'Found via',  value: selected.how_found || '—' },
                    { label: 'Applied',    value: new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                  ].map(d => (
                    <div key={d.label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{d.label}</span>
                      <span className="text-gray-300 text-right">{d.value}</span>
                    </div>
                  ))}
                </div>

                {/* Struggling with */}
                {selected.struggling_with && (
                  <div className="mb-5">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Struggling With</p>
                    <p className="text-gray-300 text-sm bg-gray-800 rounded-lg p-3">
                      {selected.struggling_with}
                    </p>
                  </div>
                )}

                {/* Status */}
                <div className="mb-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Status</p>
                  <select
                    value={selected.status}
                    onChange={e => updateStatus(selected.id, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Your Notes</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Add notes about this lead..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
                  />
                  <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="w-full mt-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
