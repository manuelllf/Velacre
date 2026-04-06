import Link from 'next/link'

export const metadata = {
  title: 'Contacto · Velacre',
  description: 'Contacta con el equipo de Velacre',
}

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">Velacre</Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
              Iniciar sesión
            </Link>
            <Link href="/auth/register" className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors">
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Contacto</h1>
        <p className="text-slate-400 mb-12 text-base">
          Estamos aquí para ayudarte. Escríbenos y te responderemos en el menor tiempo posible.
        </p>

        <div className="grid md:grid-cols-2 gap-8">

          {/* Canales de contacto */}
          <div className="space-y-4">

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">Correo general</h2>
              </div>
              <a href="mailto:info@velacre.com" className="text-blue-400 hover:underline font-medium">
                info@velacre.com
              </a>
              <p className="text-sm text-slate-400 mt-1">
                Para consultas comerciales, soporte y cualquier otra cuestión.
              </p>
              <p className="text-xs text-slate-500 mt-2">Tiempo de respuesta habitual: menos de 24 h en días laborables.</p>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">Privacidad y datos</h2>
              </div>
              <a href="mailto:privacidad@velacre.com" className="text-blue-400 hover:underline font-medium">
                privacidad@velacre.com
              </a>
              <p className="text-sm text-slate-400 mt-1">
                Para ejercer tus derechos RGPD (acceso, rectificación, supresión, etc.).
              </p>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-white">Localización</h2>
              </div>
              <address className="not-italic text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">Manuel Llao Freire</strong><br />
                A Coruña, Galicia, España
              </address>
            </div>

          </div>

          {/* Preguntas frecuentes rápidas */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Preguntas frecuentes</h2>
            <div className="space-y-3">
              {[
                {
                  q: '¿Puedo probar Velacre antes de pagar?',
                  a: 'Sí. Puedes registrarte y usar el servicio. Cuando quieras activar tu suscripción, te guiaremos en el proceso.',
                },
                {
                  q: '¿Cómo se importan mis reseñas?',
                  a: 'Al conectar tu negocio de Google Maps, importamos automáticamente tus reseñas recientes. El proceso tarda menos de un minuto.',
                },
                {
                  q: '¿Puedo cambiar el tono de las respuestas?',
                  a: 'Sí. Puedes elegir entre Profesional, Cercano y Directo desde tu perfil de configuración en cualquier momento.',
                },
                {
                  q: '¿Velacre publica las respuestas en Google?',
                  a: 'Todavía no de forma automática. Velacre genera el texto y tú lo copias y publicas desde Google Business Profile. La publicación automática directa en Google está en desarrollo y llegará próximamente.',
                },
                {
                  q: '¿Cómo cancelo mi suscripción?',
                  a: 'Desde tu panel de Configuración encontrarás un enlace directo al portal de gestión de suscripción. Allí puedes cancelar, cambiar de plan o actualizar tu método de pago en cualquier momento. La cancelación es efectiva al final del período facturado.',
                },
              ].map((item, i) => (
                <div key={i} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <p className="text-sm font-semibold text-white mb-1">{item.q}</p>
                  <p className="text-sm text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-500 text-sm">© 2026 Velacre. Todos los derechos reservados.</span>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/privacidad" className="hover:text-slate-300 transition-colors">Privacidad</Link>
            <Link href="/terminos" className="hover:text-slate-300 transition-colors">Términos</Link>
            <Link href="/contacto" className="hover:text-slate-300 transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
