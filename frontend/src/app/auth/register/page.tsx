'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { createUsuario } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import { useOAuthLoading } from '@/hooks/useOAuthLoading'
import { GoogleIcon } from '@/components/landing/shared'
import '@/components/landing/landing.css'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const l = t.app.auth.register

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useOAuthLoading()

  async function handleGoogleRegister() {
    setError('')
    setGoogleLoading(true)
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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? l.errorAlreadyRegistered
          : signUpError.message
      )
      setLoading(false)
      return
    }

    try {
      await createUsuario({ nombre }, signUpData.session?.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : l.error)
      setLoading(false)
      return
    }

    router.replace('/onboarding')
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
              onClick={handleGoogleRegister}
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="auth-field">
                <label className="auth-label">{l.name}</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  disabled={disabled}
                  className="auth-input"
                  placeholder="María, Carlos, Ana..."
                  autoComplete="name"
                />
              </div>

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
                <label className="auth-label">{l.password}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={disabled}
                  className="auth-input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <p className="auth-hint">{l.passwordHint}</p>
              </div>

              {error && <p className="auth-err">{error}</p>}

              <button type="submit" disabled={disabled} className="auth-submit">
                {loading ? l.registerLoading : l.registerBtn}
              </button>

              <p className="auth-links-small" style={{ marginTop: 4 }}>
                {l.privacyNote}{' '}
                <Link href="/privacidad">{l.privacyLink}</Link>
              </p>
            </form>
          </div>

          <p className="auth-links">
            {l.hasAccount}{' '}
            <Link href="/auth/login">{l.login}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
