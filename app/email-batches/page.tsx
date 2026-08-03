'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Batch {
  id: string
  batch_key: string
  batch_name: string
  type: 'group' | '1on1'
  start_date: string | null
  end_date: string | null
  fee: string
  payment_deadline: string | null
  zoom_link: string | null
  session_day: string | null
  session_time: string | null
  created_at: string
}

interface BatchSession {
  id: string
  batch_id: string
  session_number: number
  session_date: string
  status: 'scheduled' | 'skipped' | 'completed'
  topic: string | null
  notes: string | null
}

const empty = {
  batch_key: '', batch_name: '', type: 'group' as 'group' | '1on1',
  start_date: '', end_date: '', fee: '',
  payment_deadline: '', zoom_link: '',
  session_day: 'Wednesday', session_time: '7:00 PM – 9:00 PM ET',
}

// UTC-safe date math — session_date is a plain date column, no timezone to worry about.
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

function generateSessionRows(batchId: string, startDate: string) {
  return Array.from({ length: 7 }, (_, i) => ({
    batch_id: batchId,
    session_number: i + 1,
    session_date: addDays(startDate, i * 7),
    status: 'scheduled' as const,
  }))
}

export default function EmailBatchesPage() {
  const [batches, setBatches]   = useState<Batch[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Batch | null>(null)
  const [form, setForm]         = useState(empty)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')

  // Session schedule modal
  const [sessionsModal, setSessionsModal]   = useState<Batch | null>(null)
  const [sessions, setSessions]             = useState<BatchSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionBusy, setSessionBusy]       = useState<Record<string, boolean>>({})
  const [editingDateFor, setEditingDateFor] = useState<string | null>(null)
  const [dateEditValue, setDateEditValue]   = useState('')

  useEffect(() => { loadBatches() }, [])

  async function loadBatches() {
    setLoading(true)
    const { data } = await supabase
      .from('email_batches')
      .select('*')
      .order('created_at', { ascending: false })
    setBatches(data || [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setShowForm(true)
  }

  function openEdit(b: Batch) {
    setEditing(b)
    setForm({
      batch_key:        b.batch_key,
      batch_name:       b.batch_name,
      type:             b.type,
      start_date:       b.start_date || '',
      end_date:         b.end_date || '',
      fee:              b.fee,
      payment_deadline: b.payment_deadline || '',
      zoom_link:        b.zoom_link || '',
      session_day:      b.session_day || 'Wednesday',
      session_time:     b.session_time || '7:00 PM – 9:00 PM ET',
    })
    setShowForm(true)
  }

  async function saveBatch() {
    // dates only required for group
    if (!form.batch_key || !form.batch_name || !form.fee) {
      showToast('Please fill in Batch Key, Name and Fee.')
      return
    }
    if (form.type === 'group' && (!form.start_date || !form.end_date)) {
      showToast('Start and End date are required for Group batches.')
      return
    }

    setSaving(true)
    const payload = {
      batch_key:        form.batch_key.toLowerCase().replace(/\s+/g, ''),
      batch_name:       form.batch_name,
      type:             form.type,
      start_date:       form.start_date || null,
      end_date:         form.end_date   || null,
      fee:              form.fee,
      payment_deadline: form.payment_deadline || null,
      zoom_link:        form.zoom_link   || null,
      session_day:      form.type === 'group' ? form.session_day  : null,
      session_time:     form.type === 'group' ? form.session_time : null,
    }

    if (editing) {
      await supabase.from('email_batches').update(payload).eq('id', editing.id)
      showToast('Batch updated!')
    } else {
      const { data: created, error } = await supabase.from('email_batches').insert(payload).select().single()
      if (!error && created && payload.type === 'group' && payload.start_date) {
        await supabase.from('batch_sessions').insert(generateSessionRows(created.id, payload.start_date))
      }
      showToast('Batch created!')
    }

    setSaving(false)
    setShowForm(false)
    loadBatches()
  }

  async function deleteBatch(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('email_batches').delete().eq('id', id)
    showToast('Batch deleted.')
    loadBatches()
  }

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  // ── Session schedule ──────────────────────────────────────────────────────
  async function loadSessions(batchId: string) {
    setSessionsLoading(true)
    const { data } = await supabase
      .from('batch_sessions').select('*').eq('batch_id', batchId).order('session_number')
    setSessions((data || []) as BatchSession[])
    setSessionsLoading(false)
  }

  function openSessions(b: Batch) {
    setSessionsModal(b)
    setEditingDateFor(null)
    loadSessions(b.id)
  }

  async function generateSessions(b: Batch) {
    if (!b.start_date) { showToast('Set a start date first.'); return }
    setSessionsLoading(true)
    await supabase.from('batch_sessions').insert(generateSessionRows(b.id, b.start_date))
    await syncEndDateAndReload(b.id)
    setSessionsLoading(false)
  }

  // Keeps email_batches.end_date matching the last session's actual date, so the list view's
  // start–end summary never goes stale once a batch has skips/manual edits.
  async function syncEndDateAndReload(batchId: string) {
    const { data } = await supabase
      .from('batch_sessions').select('*').eq('batch_id', batchId).order('session_number')
    const list = (data || []) as BatchSession[]
    setSessions(list)
    const last = list[list.length - 1]
    if (last) {
      await supabase.from('email_batches').update({ end_date: last.session_date }).eq('id', batchId)
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, end_date: last.session_date } : b))
      setSessionsModal(prev => prev && prev.id === batchId ? { ...prev, end_date: last.session_date } : prev)
    }
  }

  async function skipSession(s: BatchSession) {
    setSessionBusy(prev => ({ ...prev, [s.id]: true }))
    const toShift = sessions.filter(x => x.session_number >= s.session_number)
    for (const x of toShift) {
      await supabase.from('batch_sessions').update({
        session_date: addDays(x.session_date, 7),
        status: x.id === s.id ? 'skipped' : x.status,
      }).eq('id', x.id)
    }
    await syncEndDateAndReload(s.batch_id)
    setSessionBusy(prev => ({ ...prev, [s.id]: false }))
  }

  async function undoSkip(s: BatchSession) {
    setSessionBusy(prev => ({ ...prev, [s.id]: true }))
    const toShift = sessions.filter(x => x.session_number >= s.session_number)
    for (const x of toShift) {
      await supabase.from('batch_sessions').update({
        session_date: addDays(x.session_date, -7),
        status: x.id === s.id ? 'scheduled' : x.status,
      }).eq('id', x.id)
    }
    await syncEndDateAndReload(s.batch_id)
    setSessionBusy(prev => ({ ...prev, [s.id]: false }))
  }

  async function toggleCompleted(s: BatchSession) {
    setSessionBusy(prev => ({ ...prev, [s.id]: true }))
    const nextStatus = s.status === 'completed' ? 'scheduled' : 'completed'
    await supabase.from('batch_sessions').update({ status: nextStatus }).eq('id', s.id)
    await loadSessions(s.batch_id)
    setSessionBusy(prev => ({ ...prev, [s.id]: false }))
  }

  function startDateEdit(s: BatchSession) {
    setEditingDateFor(s.id)
    setDateEditValue(s.session_date)
  }

  async function saveDateEdit(s: BatchSession) {
    if (!dateEditValue || dateEditValue === s.session_date) { setEditingDateFor(null); return }
    const delta = daysBetween(s.session_date, dateEditValue)
    const shiftLater = confirm(
      `Move session ${s.session_number} to ${formatDate(dateEditValue)}?\n\n` +
      `OK — also shift every session after it by the same ${delta > 0 ? '+' : ''}${delta} day(s).\n` +
      `Cancel — only change this session's date, leave the rest where they are.`
    )
    setSessionBusy(prev => ({ ...prev, [s.id]: true }))
    if (shiftLater) {
      const toShift = sessions.filter(x => x.session_number >= s.session_number)
      for (const x of toShift) {
        await supabase.from('batch_sessions')
          .update({ session_date: x.id === s.id ? dateEditValue : addDays(x.session_date, delta) })
          .eq('id', x.id)
      }
    } else {
      await supabase.from('batch_sessions').update({ session_date: dateEditValue }).eq('id', s.id)
    }
    await syncEndDateAndReload(s.batch_id)
    setSessionBusy(prev => ({ ...prev, [s.id]: false }))
    setEditingDateFor(null)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', background: '#0a1628',
          color: '#d4a832', padding: '12px 20px', borderRadius: '10px',
          fontSize: '14px', fontWeight: 600, zIndex: 1000,
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', margin: 0 }}>Email Batches</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Create batch templates. Use <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>send &lt;key&gt; email@x.com</code> in Telegram to send.
          </p>
        </div>
        <button onClick={openCreate} style={{
          background: '#0a1628', color: '#d4a832', border: 'none',
          padding: '10px 20px', borderRadius: '8px', fontSize: '14px',
          fontWeight: 700, cursor: 'pointer',
        }}>
          + New Batch
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', padding: '32px',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628', margin: '0 0 24px' }}>
              {editing ? 'Edit Batch' : 'Create New Batch'}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>

              {/* Type toggle */}
              <div>
                <label style={labelStyle}>Type *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['group', '1on1'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{
                        flex: 1, padding: '10px', border: '1.5px solid',
                        borderColor: form.type === t ? '#0a1628' : '#e2e8f0',
                        background: form.type === t ? '#0a1628' : '#fff',
                        color: form.type === t ? '#d4a832' : '#64748b',
                        borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                      }}
                    >
                      {t === 'group' ? '👥 Group Mentorship' : '🎯 1-on-1 Mentorship'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Key */}
              <div>
                <label style={labelStyle}>Batch Key * <span style={{ color: '#94a3b8', fontWeight: 400 }}>(no spaces — used in Telegram)</span></label>
                <input
                  value={form.batch_key}
                  onChange={e => setForm(f => ({ ...f, batch_key: e.target.value }))}
                  placeholder={form.type === 'group' ? 'e.g. june10' : 'e.g. 1on1'}
                  style={inputStyle}
                />
              </div>

              {/* Batch Name */}
              <div>
                <label style={labelStyle}>Batch Name *</label>
                <input
                  value={form.batch_name}
                  onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))}
                  placeholder={form.type === 'group' ? 'e.g. June 10 Group Mentorship' : 'e.g. 1-on-1 Mentorship'}
                  style={inputStyle}
                />
              </div>

              {/* Dates — only required for group, optional hint for 1-on-1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>
                    Start Date {form.type === 'group' ? '*' : <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>}
                  </label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    End Date {form.type === 'group' ? '*' : <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>}
                  </label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>

              {/* Fee */}
              <div>
                <label style={labelStyle}>Fee *</label>
                <input
                  value={form.fee}
                  onChange={e => setForm(f => ({ ...f, fee: e.target.value }))}
                  placeholder={form.type === 'group' ? '$625 CAD' : '$1,500 CAD'}
                  style={inputStyle}
                />
              </div>

              {/* Group-only fields */}
              {form.type === 'group' && (
                <>
                  <div>
                    <label style={labelStyle}>Payment Deadline</label>
                    <input type="date" value={form.payment_deadline}
                      onChange={e => setForm(f => ({ ...f, payment_deadline: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Zoom Link</label>
                    <input
                      value={form.zoom_link}
                      onChange={e => setForm(f => ({ ...f, zoom_link: e.target.value }))}
                      placeholder="https://us06web.zoom.us/j/..."
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Session Day</label>
                      <input
                        value={form.session_day}
                        onChange={e => setForm(f => ({ ...f, session_day: e.target.value }))}
                        placeholder="Wednesday"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Session Time</label>
                      <input
                        value={form.session_time}
                        onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))}
                        placeholder="7:00 PM – 9:00 PM ET"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '11px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={saveBatch}
                disabled={saving}
                style={{ flex: 2, padding: '11px', background: '#0a1628', color: '#d4a832', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                {saving ? 'Saving...' : editing ? 'Update Batch' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Schedule Modal */}
      {sessionsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '14px', padding: '32px',
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628', margin: 0 }}>
                Session Schedule
              </h2>
              <button
                onClick={() => setSessionsModal(null)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>{sessionsModal.batch_name}</p>

            {sessionsLoading ? (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</p>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', border: '1.5px dashed #e2e8f0', borderRadius: '12px' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 14px' }}>
                  No sessions generated yet for this batch.
                </p>
                <button
                  onClick={() => generateSessions(sessionsModal)}
                  style={{ padding: '9px 18px', background: '#0a1628', color: '#d4a832', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Generate 7 Sessions
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  background: '#f0f7ff', border: '0.5px solid #bfdbfe', borderRadius: '10px',
                  padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#1d4ed8',
                }}>
                  Batch runs through <strong>{formatDate(sessions[sessions.length - 1].session_date)}</strong>
                  {sessions.some(s => s.status === 'skipped') && ' (extended by skipped week(s))'}
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  {sessions.map(s => {
                    const busy = !!sessionBusy[s.id]
                    return (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', border: '0.5px solid #e2e8f0', borderRadius: '10px',
                        opacity: busy ? 0.6 : 1,
                      }}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '999px', flexShrink: 0,
                          background: '#f1f5f9', color: '#0a1628', fontSize: '12px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {s.session_number}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingDateFor === s.id ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="date"
                                value={dateEditValue}
                                onChange={e => setDateEditValue(e.target.value)}
                                style={{ ...inputStyle, width: 'auto' }}
                              />
                              <button onClick={() => saveDateEdit(s)} style={smallBtnPrimary}>Save</button>
                              <button onClick={() => setEditingDateFor(null)} style={smallBtnGhost}>Cancel</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628' }}>
                                {formatDate(s.session_date)}
                              </span>
                              <span style={{ ...statusBadgeStyle(s.status) }}>{s.status}</span>
                              {s.topic && <span style={{ fontSize: '12px', color: '#94a3b8' }}>{s.topic}</span>}
                            </div>
                          )}
                        </div>

                        {editingDateFor !== s.id && (
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                              onClick={() => startDateEdit(s)}
                              disabled={busy}
                              title="Edit date"
                              style={smallBtnGhost}
                            >
                              ✎
                            </button>
                            {s.status === 'skipped' ? (
                              <button onClick={() => undoSkip(s)} disabled={busy} style={smallBtnGhost}>
                                Undo skip
                              </button>
                            ) : (
                              <button onClick={() => skipSession(s)} disabled={busy} style={smallBtnGhost}>
                                Skip this week
                              </button>
                            )}
                            <button onClick={() => toggleCompleted(s)} disabled={busy} style={smallBtnGhost}>
                              {s.status === 'completed' ? 'Unmark' : 'Mark done'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch List */}
      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading batches...</p>
      ) : batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1.5px dashed #e2e8f0', borderRadius: '12px' }}>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>No batches yet. Create your first one above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {batches.map(b => (
            <div key={b.id} style={{
              background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: '12px',
              padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px',
            }}>
              {/* Type badge */}
              <div style={{
                background: b.type === 'group' ? '#f0f7ff' : '#fdf8ec',
                color: b.type === 'group' ? '#1d4ed8' : '#92400e',
                borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                {b.type === 'group' ? '👥 Group' : '🎯 1-on-1'}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0a1628', fontSize: '15px' }}>{b.batch_name}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
                  <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', marginRight: '10px' }}>{b.batch_key}</code>
                  {b.start_date ? `${formatDate(b.start_date)} – ${formatDate(b.end_date)}` : 'Flexible dates'}
                  &nbsp;·&nbsp; {b.fee}
                  {b.payment_deadline && ` · Due ${formatDate(b.payment_deadline)}`}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {b.type === 'group' && (
                  <button
                    onClick={() => openSessions(b)}
                    style={{ padding: '7px 14px', border: '0.5px solid #bfdbfe', background: '#eff6ff', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                  >
                    📅 Sessions
                  </button>
                )}
                <button
                  onClick={() => openEdit(b)}
                  style={{ padding: '7px 14px', border: '0.5px solid #e2e8f0', background: '#fff', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', color: '#374151' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteBatch(b.id, b.batch_name)}
                  style={{ padding: '7px 14px', border: '0.5px solid #fecaca', background: '#fff', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', color: '#dc2626' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700,
  color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px', color: '#0a1628',
  boxSizing: 'border-box', outline: 'none',
}

const smallBtnGhost: React.CSSProperties = {
  padding: '6px 10px', border: '0.5px solid #e2e8f0', background: '#fff',
  borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap',
}

const smallBtnPrimary: React.CSSProperties = {
  padding: '6px 12px', border: 'none', background: '#0a1628',
  borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#d4a832', whiteSpace: 'nowrap',
}

function statusBadgeStyle(status: BatchSession['status']): React.CSSProperties {
  const map: Record<BatchSession['status'], { bg: string; color: string }> = {
    scheduled: { bg: '#f1f5f9', color: '#475569' },
    skipped:   { bg: '#fef3c7', color: '#92400e' },
    completed: { bg: '#f0fdf4', color: '#16a34a' },
  }
  const c = map[status]
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    background: c.bg, color: c.color,
  }
}
