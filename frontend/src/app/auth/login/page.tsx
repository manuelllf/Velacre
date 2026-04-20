'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import { useOAuthLoading } from '@/hooks/useOAuthLoading'
import { armWelcome } from '@/lib/welcome'
import { GoogleIcon } from '@/components/landing/shared'
import '@/components/landing/landing.css'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const l = t.app.auth.login

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useOAuthLoading()

  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    armWelcome()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(l.error)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(l.error)
      setLoading(false)
      return
    }

    try {
      const u = await getMyUsuario()
      if (u.isAdmin || u.rol === 'admin') router.replace('/admin?welcome=1')
      else router.replace('/inicio?welcome=1')
    } catch {
      router.replace('/dashboard?welcome=1')
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetLoading(false)
    if (error) setError(l.error)
    else setResetSent(true)
  }

  const disabled = loading || googleLoading

  return (
    <div className="vel-lp">
      <div className="auth-screen">
        <div className="auth-col">
          <div className="auth-head">
            <Link href="/" className="auth-brand">
              <img src="/icons/logo-64.png" alt="" />
              <span className="auth-brand-name">velacre</span>
            </Link>
            <h1 className="auth-title">{l.title}</h1>
            <p className="auth-sub">{l.subtitle}</p>
          </div>

          <div className="auth-card">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={disabled}
              className="auth-google"
            >
              <GoogleIcon />
              {googleLoading ? l.googleLoading : l.googleBtn}
            </button>

            <div className="auth-divider">
              <div className="line" />
              <span className="lbl">{l.orDivider}</span>
              <div className="line" />
            </div>

            {showReset ? (
              resetSent ? (
                <div className="auth-success">
                  <div className="auth-success-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3>{l.resetSent}</h3>
                  <p>{l.resetSentDesc}</p>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setResetSent(false); setResetEmail('') }}
                    className="auth-text-btn"
                  >
                    {l.resetBack}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 13.5, color: 'var(--muted-strong)', margin: 0 }}>{l.resetIntro}</p>
                  <div className="auth-field">
                    <label className="auth-label">{l.resetEmail}</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="tu@negocio.com"
                      className="auth-input"
                    />
                  </div>
                  {error && <p className="auth-err">{error}</p>}
                  <button type="submit" disabled={resetLoading} className="auth-submit">
                    {resetLoading ? l.resetLoading : l.resetBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setError('') }}
                    className="auth-text-btn"
                    style={{ alignSelf: 'center' }}
                  >
                    {t.app.common.cancel}
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="auth-field">
                  <label className="auth-label">{l.email}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={disabled}
                    className="auth-input"
                    placeholder="tu@negocio.com"
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label">
                    <span>{l.password}</span>
                    <button
                      type="button"
                      onClick={() => { setShowReset(true); setResetEmail(email); setError('') }}
                      className="auth-text-btn"
                    >
                      {l.forgotPassword}
                    </button>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={disabled}
                    className="auth-input"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                {error && <p className="auth-err">{error}</p>}

                <button type="submit" disabled={disabled} className="auth-submit">
                  {loading ? l.loginLoading : l.loginBtn}
                </button>
              </form>
            )}
          </div>

          <p className="auth-links">
            {l.noAccount}{' '}
            <Link href="/auth/register">{l.register}</Link>
          </p>
          <p className="auth-links-small">
            <Link href="/privacidad">{l.privacyNote}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
