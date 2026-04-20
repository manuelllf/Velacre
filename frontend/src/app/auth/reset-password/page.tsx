'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/i18n'
import '@/components/landing/landing.css'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const rp = t.app.auth.resetPassword
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(rp.passwordMismatch)
      return
    }
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) {
      setError(rp.updateError)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 2500)
    }
  }

  if (done) {
    return (
      <div className="vel-lp">
        <div className="auth-screen">
          <div className="auth-col">
            <div className="auth-success" style={{ padding: '48px 0' }}>
              <div className="auth-success-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3>{rp.successTitle}</h3>
              <p>{rp.successRedirecting}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vel-lp">
      <div className="auth-screen">
        <div className="auth-col">
          <div className="auth-head">
            <Link href="/" className="auth-brand">
              <img src="/icons/logo-64.png" alt="" />
              <span className="auth-brand-name">velacre</span>
            </Link>
            <h1 className="auth-title">{rp.title}</h1>
            <p className="auth-sub">{rp.subtitle}</p>
          </div>

          <div className="auth-card">
            {!ready ? (
              <div className="auth-spinner" />
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="auth-field">
                  <label className="auth-label">{rp.newPasswordLabel}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="auth-input"
                    placeholder={rp.placeholder}
                    autoComplete="new-password"
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label">{rp.repeatPasswordLabel}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="auth-input"
                    placeholder={rp.placeholder}
                    autoComplete="new-password"
                  />
                </div>

                {error && <p className="auth-err">{error}</p>}

                <button type="submit" disabled={loading} className="auth-submit">
                  {loading ? rp.savingBtn : rp.saveBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
