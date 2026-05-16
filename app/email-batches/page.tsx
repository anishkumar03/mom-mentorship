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

const empty = {
  batch_key: '', batch_name: '', type: 'group' as 'group' | '1on1',
  start_date: '', end_date: '', fee: '',
  payment_deadline: '', zoom_link: '',
  session_day: 'Wednesday', session_time: '7:00 PM – 9:00 PM ET',
}

export default function EmailBatchesPage() {
  const [batches, setBatches]   = useState<Batch[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Batch | null>(null)
  const [form, setForm]         = useState(empty)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')

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
      await supabase.from('email_batches').insert(payload)
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
