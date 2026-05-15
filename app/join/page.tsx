'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MARKETS = [
  'Futures',
  'Forex',
  'Stocks',
  'Crypto',
  'Options',
  'Multiple',
]

const EXPERIENCE = [
  { value: 'beginner', label: 'Beginner — 0 to 1 year' },
  { value: 'intermediate', label: 'Intermediate — 1 to 3 years' },
  { value: 'experienced', label: 'Experienced — 3+ years' },
]

const HOW_FOUND = [
  'Instagram',
  'Discord',
  'YouTube',
  'Referral from a friend',
  'Google',
  'Other',
]

export default function JoinPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    market: '',
    experience: '',
    struggling_with: '',
    how_found: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.full_name.trim()) return setError('Please enter your full name.')
    if (!form.email.trim()) return setError('Please enter your email.')
    if (!form.market) return setError('Please select the market you trade.')
    if (!form.experience) return setError('Please select your experience level.')

    setLoading(true)
    try {
      const { error: dbError } = await supabase.from('leads').insert({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        market: form.market,
        experience: form.experience,
        struggling_with: form.struggling_with.trim() || null,
        how_found: form.how_found || null,
        status: 'new',
      })

      if (dbError) throw dbError
      setSubmitted(true)
    } catch (err: any) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {/* Success checkmark */}
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Application Received!
          </h2>
          <p className="text-gray-400 mb-2">
            Thank you for reaching out. I will review your application and get
            back to you within 24-48 hours.
          </p>
          <p className="text-gray-500 text-sm">
            Keep an eye on your inbox at{' '}
            <span className="text-green-400">{form.email}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            Limited spots available
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Apply for Mentorship
          </h1>
          <p className="text-gray-400">
            Fill out the form below and I will get back to you within 24-48
            hours to discuss how we can work together.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5"
        >
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Your full name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Phone Number{' '}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            />
          </div>

          {/* Market */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Which market do you trade?{' '}
              <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MARKETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, market: m })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    form.market === m
                      ? 'bg-green-500/10 border-green-500 text-green-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Trading Experience <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {EXPERIENCE.map((exp) => (
                <button
                  key={exp.value}
                  type="button"
                  onClick={() => setForm({ ...form, experience: exp.value })}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium border text-left transition-all ${
                    form.experience === exp.value
                      ? 'bg-green-500/10 border-green-500 text-green-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {exp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Struggling with */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              What are you struggling with most?{' '}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              name="struggling_with"
              value={form.struggling_with}
              onChange={handleChange}
              rows={3}
              placeholder="e.g. Risk management, trading psychology, consistency..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors resize-none"
            />
          </div>

          {/* How found */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              How did you find me?{' '}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <select
              name="how_found"
              value={form.how_found}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            >
              <option value="">Select an option</option>
              {HOW_FOUND.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-gray-950 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Application →'
            )}
          </button>

          <p className="text-center text-gray-600 text-xs">
            Your information is kept private and will never be shared.
          </p>
        </form>
      </div>
    </div>
  )
}
