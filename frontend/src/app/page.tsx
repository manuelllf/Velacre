'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

const DEMO_REVIEW = {
  author: 'Carlos M.',
  stars: 2,
  text: 'La comida tardó 45 minutos y cuando llegó estaba fría. El camarero no se disculpó en ningún momento. Muy decepcionante para el precio que cobran.',
  date: 'hace 3 días',
}

const DEMO_RESPONSE = `Estimado Carlos, lamentamos profundamente que su experiencia no haya estado a la altura de nuestros estándares. Los tiempos de espera que describes y el servicio recibido no reflejan los valores que nos guían. Hemos trasladado tu comentario al equipo y tomaremos las medidas necesarias para que no se repita. Te invitamos a darnos una nueva oportunidad — con mucho gusto nos pondremos en contacto contigo directamente para compensarte.`

export default function LandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [showResponse, setShowResponse] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [router])

  // Typing animation for demo response
  useEffect(() => {
    if (!showResponse) return
    let i = 0
    setTypedText('')
    const interval = setInterval(() => {
      i++
      setTypedText(DEMO_RESPONSE.slice(0, i))
      if (i >= DEMO_RESPONSE.length) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [showResponse])

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-white">Velacre</span>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 text-indigo-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            IA generativa aplicada a la reputación online
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Responde a tus reseñas<br />
            <span className="text-indigo-400">con inteligencia artificial</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Velacre analiza cada reseña de Google y genera respuestas personalizadas al tono de tu negocio. En segundos, sin esfuerzo.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-base transition-colors disabled:opacity-70 shadow-lg"
            >
              <GoogleIcon />
              {googleLoading ? 'Conectando...' : 'Empezar con Google — gratis'}
            </button>
            <Link
              href="/auth/register"
              className="flex items-center justify-center px-6 py-3.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl text-base transition-colors"
            >
              Crear cuenta con email
            </Link>
          </div>

          <p className="text-sm text-slate-600 mt-4">Sin tarjeta de crédito · Configuración en 2 minutos</p>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-white">+40%</div>
            <div className="text-sm text-slate-500 mt-0.5">más reseñas respondidas</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">&lt; 30 seg</div>
            <div className="text-sm text-slate-500 mt-0.5">por respuesta generada</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">3 tonos</div>
            <div className="text-sm text-slate-500 mt-0.5">Profesional · Cercano · Directo</div>
          </div>
        </div>
      </section>

      {/* ── DEMO IA ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">La IA que trabaja por ti</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Pegas la reseña, seleccionas el tono y en segundos tienes una respuesta lista para copiar en Google.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Reseña */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">
                  {DEMO_REVIEW.author[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{DEMO_REVIEW.author}</div>
                  <div className="text-xs text-slate-500">{DEMO_REVIEW.date}</div>
                </div>
              </div>
              <div className="flex text-amber-400 text-sm">
                {'★'.repeat(DEMO_REVIEW.stars)}{'☆'.repeat(5 - DEMO_REVIEW.stars)}
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{DEMO_REVIEW.text}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-full">Google Maps</span>
              <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-1 rounded-full">⚠ Reseña negativa</span>
            </div>
          </div>

          {/* Respuesta generada */}
          <div className="bg-slate-900 border border-indigo-900 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-indigo-300">Respuesta generada</span>
              </div>
              <span className="text-xs bg-indigo-950 text-indigo-400 border border-indigo-900 px-2 py-1 rounded-full">Tono Profesional</span>
            </div>
            {!showResponse ? (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <button
                  onClick={() => setShowResponse(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Ver respuesta IA
                </button>
                <p className="text-xs text-slate-600">Pulsa para ver la magia</p>
              </div>
            ) : (
              <p className="text-sm text-slate-300 leading-relaxed min-h-[120px]">
                {typedText}
                {typedText.length < DEMO_RESPONSE.length && (
                  <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── PANEL SALUD ── */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Panel de salud de tu reputación</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Visualiza la evolución de tu nota media, el sentimiento de los clientes y las palabras que más se repiten.</p>
          </div>

          {/* Mockup panel */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Nota media</div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">4.3</span>
                  <span className="text-amber-400 text-lg mb-0.5">★</span>
                  <span className="text-emerald-400 text-sm mb-1 font-semibold">▲ 0.2</span>
                </div>
                <div className="text-xs text-slate-500">Mes anterior: 4.1★</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Índice de respuesta</div>
                <div className="text-3xl font-bold text-white">68%</div>
                <div className="text-xs text-slate-500">34 de 50 reseñas</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Reseñas este mes</div>
                <div className="text-3xl font-bold text-white">12</div>
                <div className="text-xs text-slate-500">12 reseñas nuevas</div>
              </div>
            </div>

            {/* Sentiment bar */}
            <div className="mb-6">
              <div className="text-xs text-slate-500 mb-2">Sentimiento general</div>
              <div className="flex rounded-full overflow-hidden h-5">
                <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '62%' }}>62%</div>
                <div className="bg-amber-400 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '18%' }}>18%</div>
                <div className="bg-red-500 flex items-center justify-center text-white text-xs font-semibold" style={{ width: '20%' }}>20%</div>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Positivas (31)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Neutras (9)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Negativas (10)</span>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <div className="text-xs text-slate-500 mb-2">Palabras más mencionadas</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { w: 'servicio', s: 'positive' }, { w: 'comida', s: 'positive' }, { w: 'espera', s: 'negative' },
                  { w: 'ambiente', s: 'positive' }, { w: 'precio', s: 'neutral' }, { w: 'trato', s: 'positive' },
                  { w: 'frío', s: 'negative' }, { w: 'recomendable', s: 'positive' },
                ].map(kw => (
                  <span key={kw.w} className={`px-3 py-1 rounded-full text-xs font-medium ${
                    kw.s === 'positive' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800' :
                    kw.s === 'negative' ? 'bg-red-900/40 text-red-300 border border-red-800' :
                    'bg-slate-700 text-slate-300 border border-slate-600'
                  }`}>{kw.w}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Tres pasos para empezar</h2>
          <p className="text-slate-400">Sin instalaciones, sin configuraciones complejas.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Conecta tu negocio',
              desc: 'Busca tu local en Google Maps y lo vinculamos automáticamente. Importamos tu nombre, dirección y reseñas.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              step: '02',
              title: 'Revisa tus reseñas',
              desc: 'Sincronizamos tus reseñas de Google automáticamente. Ve de un vistazo cuáles necesitan respuesta.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
            },
            {
              step: '03',
              title: 'Genera y publica',
              desc: 'La IA redacta la respuesta perfecta en el tono de tu negocio. Cópiala y pégala en Google en segundos.',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
            },
          ].map(item => (
            <div key={item.step} className="relative">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-950 border border-indigo-800 rounded-xl flex items-center justify-center text-indigo-400">
                    {item.icon}
                  </div>
                  <span className="text-xs font-bold text-indigo-500 tracking-widest">PASO {item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PARA QUIÉN ── */}
      <section className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Pensado para negocios locales</h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">Cualquier negocio con presencia en Google puede aprovechar Velacre.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Restaurantes', 'Hoteles', 'Cafeterías', 'Peluquerías', 'Talleres', 'Clínicas', 'Comercios', 'Bares'].map(sector => (
              <span key={sector} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-full">
                {sector}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-700/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Empieza hoy.<br />Responde mañana.
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Configúrate en 2 minutos y empieza a responder reseñas con IA desde el primer día.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-base transition-colors disabled:opacity-70 shadow-xl"
            >
              <GoogleIcon />
              {googleLoading ? 'Conectando...' : 'Empezar con Google — gratis'}
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-4">Sin tarjeta de crédito · Sin compromisos</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-500 text-sm">© 2025 Velacre. Todos los derechos reservados.</span>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/privacidad" className="hover:text-slate-300 transition-colors">Política de privacidad</Link>
            <a href="mailto:hola@velacre.com" className="hover:text-slate-300 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
