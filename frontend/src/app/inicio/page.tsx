'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMyUsuario, getMyNegocio } from '@/lib/api'
import { useLanguage } from '@/lib/i18n'
import LangSwitcher from '@/components/LangSwitcher'

export default function InicioPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [nombre, setNombre] = useState('')
  const [negocioNombre, setNegocioNombre] = useState('')
  const [plan, setPlan] = useState('basic')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      try {
        const [u, n] = await Promise.all([getMyUsuario(), getMyNegocio()])
        if (u.isAdmin) { router.replace('/admin'); return }
        if (!n) { router.replace('/onboarding'); return }
        if (!u.plan || u.plan === 'basic') {
          // keep on inicio - basic plan is valid (free tier)
        }
        setNombre(u.nombre ?? '')
        setNegocioNombre(n.nombre)
        setPlan(u.plan ?? 'basic')
      } catch {
        router.replace('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const planLabel = plan === 'pro' ? t.app.inicioPage.planPro : plan === 'core' ? t.app.inicioPage.planCore : t.app.inicioPage.planBasic
  const planColor = plan === 'pro'
    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    : plan === 'core'
    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'

  const greeting = nombre
    ? t.app.inicio.greeting.replace('{name}', nombre.split(' ')[0])
    : t.app.inicioPage.welcome

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900 dark:text-white">Velacre</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planColor}`}>{planLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{negocioNombre}</span>
            <div className="hidden sm:flex"><LangSwitcher /></div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {t.app.common.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.app.inicio.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/dashboard" className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t.app.inicio.cards.reviews.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.app.inicio.cards.reviews.desc}</p>
          </Link>

          <Link href="/dashboard/salud" className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all relative">
            {plan !== 'pro' && (
              <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full">Pro</span>
            )}
            <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/40 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{t.app.inicio.cards.health.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.app.inicio.cards.health.desc}</p>
          </Link>

          <Link href="/settings" className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{t.app.inicio.cards.config.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.app.inicio.cards.config.desc}</p>
          </Link>
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-100 dark:border-slate-800 py-5">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} Velacre · {t.footer.rights.replace('© 2026 Velacre. ', '')}</span>
          <div className="flex gap-4">
            <Link href="/privacidad" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.privacy}</Link>
            <Link href="/terminos" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.terms}</Link>
            <Link href="/contacto" className="hover:text-slate-300 dark:hover:text-slate-400 transition-colors">{t.footer.contact}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
