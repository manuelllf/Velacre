import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad · Velacre',
  description: 'Cómo tratamos tus datos personales en Velacre',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Política de Privacidad</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">Última actualización: marzo de 2026</p>

        <div className="space-y-10 text-slate-700 dark:text-slate-300 text-base leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de tus datos personales es <strong>Manuel Llao Freire</strong>,
              titular del servicio <strong>Velacre</strong>, con domicilio en A Coruña, Galicia, España.
            </p>
            <p className="mt-2">
              Para cualquier consulta relacionada con la privacidad puedes contactarnos en{' '}
              <a href="mailto:privacidad@velacre.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                privacidad@velacre.com
              </a>.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">2. Datos que recogemos</h2>
            <p>En función del uso que hagas de Velacre, recogemos los siguientes datos:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y contraseña (almacenada de forma cifrada).</li>
              <li><strong>Datos del negocio:</strong> nombre comercial, teléfono, correo del negocio, descripción y el identificador de Google Place asociado.</li>
              <li><strong>Reseñas de clientes:</strong> texto de las reseñas importadas desde Google Maps y el texto que introduces manualmente. Estos datos pertenecen a terceros y los tratamos únicamente para generar respuestas.</li>
              <li><strong>Datos de uso:</strong> registros de acceso y actividad dentro de la plataforma (logs técnicos).</li>
            </ul>
            <p className="mt-3">
              No recogemos datos especialmente sensibles (salud, ideología, etc.) ni datos de menores de 16 años.
              Si eres menor de 16 años, no debes usar este servicio.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">3. Finalidad y base jurídica</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse mt-2">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700 text-left">
                    <th className="px-4 py-2 font-semibold text-slate-900 dark:text-white rounded-tl-lg">Finalidad</th>
                    <th className="px-4 py-2 font-semibold text-slate-900 dark:text-white rounded-tr-lg">Base jurídica (RGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  <tr>
                    <td className="px-4 py-3">Prestar el servicio de gestión y respuesta de reseñas</td>
                    <td className="px-4 py-3">Ejecución de contrato — art. 6.1.b</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Gestión de tu cuenta de usuario</td>
                    <td className="px-4 py-3">Ejecución de contrato — art. 6.1.b</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Mejora del servicio y análisis de uso</td>
                    <td className="px-4 py-3">Interés legítimo — art. 6.1.f</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Cumplimiento de obligaciones legales</td>
                    <td className="px-4 py-3">Obligación legal — art. 6.1.c</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Comunicaciones comerciales sobre Velacre (solo si las aceptas)</td>
                    <td className="px-4 py-3">Consentimiento — art. 6.1.a</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">4. Destinatarios y encargados del tratamiento</h2>
            <p>Para prestar el servicio trabajamos con los siguientes proveedores, todos ellos con garantías adecuadas de protección de datos:</p>
            <ul className="mt-3 space-y-3 list-disc list-inside">
              <li>
                <strong>Supabase Inc.</strong> (base de datos y autenticación) — los datos se almacenan en servidores dentro de la UE.
                Consulta su política en{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">supabase.com/privacy</a>.
              </li>
              <li>
                <strong>Google LLC</strong> (Google Places API) — accedemos a las reseñas públicas de tu negocio en Google Maps.
                Consulta su política en{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">policies.google.com/privacy</a>.
              </li>
              <li>
                <strong>Anthropic, PBC</strong> (modelo de IA Claude) — el texto de las reseñas se envía a la API de Anthropic para generar respuestas.
                Anthropic no usa estos datos para entrenar sus modelos por defecto.
                Consulta su política en{' '}
                <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">anthropic.com/privacy</a>.
              </li>
              <li>
                <strong>Outscraper Inc.</strong> (extracción de reseñas de Google Maps) — utilizamos este servicio para obtener las reseñas públicas de tu negocio.
                Los datos enviados se limitan al identificador público de Google Maps de tu local.
                Consulta su política en{' '}
                <a href="https://outscraper.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">outscraper.com/privacy-policy</a>.
              </li>
              <li>
                <strong>Railway / Vercel</strong> (infraestructura de alojamiento) — el código y los logs de la aplicación se ejecutan en servidores europeos o con adecuadas garantías de transferencia internacional.
              </li>
            </ul>
            <p className="mt-3">
              No vendemos ni cedemos tus datos a terceros con fines publicitarios.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">5. Conservación de los datos</h2>
            <p>Conservamos tus datos mientras tu cuenta esté activa. Una vez que solicites la baja:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Los datos de cuenta y negocio se eliminan en un plazo máximo de <strong>30 días</strong>.</li>
              <li>Los registros de facturación se conservan durante <strong>5 años</strong> por obligación fiscal.</li>
              <li>Los logs técnicos se eliminan a los <strong>90 días</strong>.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">6. Tus derechos</h2>
            <p>Como interesado, tienes los siguientes derechos reconocidos por el RGPD y la LOPDGDD:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li><strong>Acceso:</strong> obtener una copia de los datos que tenemos sobre ti.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión («derecho al olvido»):</strong> solicitar la eliminación de tus datos.</li>
              <li><strong>Limitación:</strong> solicitar que suspendamos el tratamiento en ciertos casos.</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado y legible por máquina.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento basado en interés legítimo.</li>
              <li><strong>Retirada del consentimiento:</strong> en cualquier momento, sin efectos retroactivos.</li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos escríbenos a{' '}
              <a href="mailto:privacidad@velacre.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                privacidad@velacre.com
              </a>{' '}
              indicando tu nombre y la solicitud concreta. Responderemos en un plazo máximo de un mes.
            </p>
            <p className="mt-3">
              Si consideras que el tratamiento de tus datos no es conforme a la normativa, puedes presentar una reclamación
              ante la{' '}
              <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Agencia Española de Protección de Datos (AEPD)
              </a>.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">7. Cookies</h2>
            <p>
              Velacre utiliza únicamente cookies técnicas estrictamente necesarias para el funcionamiento del servicio
              (gestión de sesión de usuario). No utilizamos cookies de seguimiento, publicidad ni analítica de terceros.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">8. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos frente a accesos no autorizados,
              pérdida o destrucción: cifrado en tránsito (HTTPS/TLS), contraseñas almacenadas con hash seguro y
              control de acceso basado en roles.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">9. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Cuando lo hagamos, actualizaremos la fecha de «Última actualización»
              y, si los cambios son significativos, te avisaremos por correo electrónico con al menos 15 días de antelación.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-center">
          <Link
            href="/auth/register"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors"
          >
            Volver al registro
          </Link>
        </div>
      </main>
    </div>
  )
}
