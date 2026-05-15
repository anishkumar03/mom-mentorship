'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MARKETS = ['Futures', 'Forex', 'Stocks', 'Crypto', 'Options', 'Multiple', "Beginner — Not Sure Yet"]

const EXPERIENCE = [
  { value: 'beginner',     label: 'Beginner',     sub: '0 – 1 year' },
  { value: 'intermediate', label: 'Intermediate', sub: '1 – 3 years' },
  { value: 'experienced',  label: 'Experienced',  sub: '3+ years' },
]

const HOW_FOUND = ['Instagram', 'Discord', 'YouTube', 'Referral', 'Google', 'Other']

const MARKET_ICONS: Record<string, string> = {
  Futures:                 '📈',
  Forex:                   '💱',
  Stocks:                  '📊',
  Crypto:                  '₿',
  Options:                 '⚙️',
  Multiple:                '🌐',
  'Beginner — Not Sure Yet': '🌱',
}

export default function JoinPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    market: '',
    experience: '',
    mentorship_type: '',
    struggling_with: '',
    how_found: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.full_name.trim()) return setError('Please enter your full name.')
    if (!form.email.trim())     return setError('Please enter your email.')
    if (!form.market)           return setError('Please select the market you trade.')
    if (!form.experience)       return setError('Please select your experience level.')
    if (!form.mentorship_type)   return setError('Please select a mentorship type.')

    setLoading(true)
    try {
      const { error: dbError } = await supabase
        .from('leads')
        .insert([{
          full_name:       form.full_name.trim(),
          name:            form.full_name.trim(),
          email:           form.email.trim().toLowerCase(),
          phone:           form.phone.trim() || null,
          market:          form.market,
          experience:      form.experience,
          struggling_with:  form.struggling_with.trim() || null,
          how_found:        form.how_found || null,
          notes:            form.mentorship_type ? `Mentorship type: ${form.mentorship_type}` : null,
          source:          form.how_found || 'Join Form',
          status:          'new',
        }])

      if (dbError) {
        console.error('Supabase error:', dbError)
        throw new Error(dbError.message)
      }

      setSubmitted(true)
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f0d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80,
            background: 'rgba(34,197,94,0.12)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            border: '1px solid rgba(34,197,94,0.3)',
          }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#22c55e">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'DM Serif Display', serif" }}>
            Application Received!
          </h2>
          <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: 8 }}>
            Thank you for reaching out. I will personally review your application and get back to you within 24–48 hours.
          </p>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Check your inbox at <span style={{ color: '#22c55e' }}>{form.email}</span>
          </p>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0f1e; }
        .input-field {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #fff;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        .input-field::placeholder { color: #475569; }
        .input-field:focus {
          border-color: #22c55e;
          background: rgba(34,197,94,0.04);
        }
        .chip-btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #94a3b8;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
        }
        .chip-btn:hover { border-color: rgba(255,255,255,0.25); color: #e2e8f0; }
        .chip-btn.selected {
          background: rgba(34,197,94,0.1);
          border-color: #22c55e;
          color: #22c55e;
        }
        .exp-btn {
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #94a3b8;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .exp-btn:hover { border-color: rgba(255,255,255,0.2); }
        .exp-btn.selected {
          background: rgba(34,197,94,0.08);
          border-color: #22c55e;
        }
        .submit-btn {
          width: 100%;
          background: #22c55e;
          color: #021a09;
          font-size: 16px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          padding: 16px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }
        .submit-btn:hover { background: #16a34a; transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { background: #14532d; color: #166534; cursor: not-allowed; transform: none; }
        select option { background: #1e293b; color: #fff; }
      `}</style>

      <div style={{
        minHeight: '100svh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a0d 100%)',
        padding: '32px 16px 60px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 100,
              padding: '6px 16px',
              marginBottom: 20,
            }}>
              <span style={{
                width: 6, height: 6,
                background: '#22c55e',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
                Limited spots available
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(28px, 6vw, 40px)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.15,
              marginBottom: 12,
              fontFamily: "'DM Serif Display', serif",
            }}>
              Apply for Trading<br />
              <span style={{ color: '#22c55e' }}>Mentorship</span>
            </h1>
            <p style={{ color: '#64748b', lineHeight: 1.65, fontSize: 15, maxWidth: 400, margin: '0 auto' }}>
              Fill out the form below. I will review every application personally and get back to you within 24–48 hours.
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 'clamp(20px, 5vw, 32px)',
          }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Name + Email row on desktop */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Your full name"
                    value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Phone <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span>
                </label>
                <input
                  className="input-field"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>

              {/* Market */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Market You Trade <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {/* Last item spans full width if odd count */}
                  {MARKETS.map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`chip-btn${form.market === m ? ' selected' : ''}`}
                      onClick={() => set('market', m)}
                    >
                      <span style={{ marginRight: 6 }}>{MARKET_ICONS[m]}</span>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Experience Level <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {EXPERIENCE.map(exp => (
                    <button
                      key={exp.value}
                      type="button"
                      className={`exp-btn${form.experience === exp.value ? ' selected' : ''}`}
                      onClick={() => set('experience', exp.value)}
                    >
                      <div>
                        <span style={{ color: form.experience === exp.value ? '#22c55e' : '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
                          {exp.label}
                        </span>
                        <span style={{ color: '#475569', fontSize: 13, marginLeft: 8 }}>
                          {exp.sub}
                        </span>
                      </div>
                      {form.experience === exp.value && (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#22c55e">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mentorship type */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Mentorship Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { value: 'group', label: 'Group Mentorship', icon: '👥', sub: 'Learn with a cohort' },
                    { value: '1on1',  label: '1-on-1 Mentorship', icon: '🎯', sub: 'Personalised sessions' },
                  ].map(mt => (
                    <button
                      key={mt.value}
                      type="button"
                      className={`exp-btn${form.mentorship_type === mt.value ? ' selected' : ''}`}
                      onClick={() => set('mentorship_type', mt.value)}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '14px 16px' }}
                    >
                      <span style={{ fontSize: 22 }}>{mt.icon}</span>
                      <span style={{ color: form.mentorship_type === mt.value ? '#22c55e' : '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{mt.label}</span>
                      <span style={{ color: '#475569', fontSize: 12 }}>{mt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Struggling with */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  What are you struggling with? <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span>
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="e.g. Risk management, trading psychology, staying consistent..."
                  value={form.struggling_with}
                  onChange={e => set('struggling_with', e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* How found */}
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 8, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  How did you find me? <span style={{ color: '#475569', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional)</span>
                </label>
                <select
                  className="input-field"
                  value={form.how_found}
                  onChange={e => set('how_found', e.target.value)}
                >
                  <option value="">Select an option</option>
                  {HOW_FOUND.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: '#f87171',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0110 10" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application →'
                )}
              </button>

              <p style={{ textAlign: 'center', color: '#334155', fontSize: 13 }}>
                🔒 Your information is private and will never be shared.
              </p>
            </form>
          </div>

          {/* Footer trust signals */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 28, flexWrap: 'wrap' }}>
            {['100+ Students Mentored', 'Personal Response', 'Free Consultation'].map(t => (
              <span key={t} style={{ color: '#334155', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#22c55e' }}>✓</span> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
