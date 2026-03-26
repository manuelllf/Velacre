'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const l = t.app.auth.login

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleGoogleLogin() {
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

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(l.error)
      setLoading(false)
      return
    }

    try {
      const u = await getMyUsuario()
      if (u.isAdmin || u.rol === 'admin') router.replace('/admin')
      else router.replace('/inicio')
    } catch {
      router.replace('/dashboard')
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
    if (error) {
      setError(l.error)
    } else {
      setResetSent(true)
    }
  }

  const disabled = loading || googleLoading

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{l.title}</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">{l.subtitle}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {googleLoading ? l.googleLoading : l.googleBtn}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-sm text-slate-400 dark:text-slate-500">{l.orDivider}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Reset / login form */}
          {showReset ? (
            resetSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-900 dark:text-white">{l.resetSent}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {l.resetSentDesc}
                </p>
                <button
                  onClick={() => { setShowReset(false); setResetSent(false); setResetEmail('') }}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {l.resetBack}
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {l.resetIntro}
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder={l.resetEmail}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {resetLoading ? l.resetLoading : l.resetBtn}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setError('') }}
                  className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1"
                >
                  {t.app.common.cancel}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  {l.email}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={disabled}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="tu@negocio.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {l.password}
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowReset(true); setResetEmail(email); setError('') }}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {l.forgotPassword}
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={disabled}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-base text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={disabled}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? l.loginLoading : l.loginBtn}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-base text-slate-500 dark:text-slate-400 mt-6">
          {l.noAccount}{' '}
          <Link href="/auth/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            {l.register}
          </Link>
        </p>

        <p className="text-center text-sm text-slate-400 dark:text-slate-600 mt-4">
          <Link href="/privacidad" className="hover:underline">{l.privacyNote}</Link>
        </p>
      </div>
    </div>
  )
}
