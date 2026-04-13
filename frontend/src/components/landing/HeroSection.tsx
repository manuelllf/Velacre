'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n'
import { GoogleIcon, EASE } from './shared'

export interface HeroSectionProps {
  googleLoading: boolean
  onGoogleSignup: () => void
}

export default function HeroSection({ googleLoading, onGoogleSignup }: HeroSectionProps) {
  const { t: l } = useLanguage()

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-blue-600/25 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 text-blue-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
        >
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          {l.hero.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6"
        >
          {l.hero.h1}<br />
          <span className="text-blue-400">{l.hero.h1highlight}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.35, ease: EASE }}
          className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {l.hero.p}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onGoogleSignup}
            disabled={googleLoading}
            className="flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-base transition-colors disabled:opacity-70 shadow-lg"
          >
            <GoogleIcon />
            {googleLoading ? l.hero.ctaGoogleLoading : l.hero.ctaGoogle}
          </motion.button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/auth/register"
              className="flex items-center justify-center px-6 py-3.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl text-base transition-colors"
            >
              {l.hero.ctaEmail}
            </Link>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="text-sm text-slate-600 mt-4"
        >
          {l.hero.setup}
        </motion.p>
      </div>
    </section>
  )
}
