import Link from 'next/link'

export const metadata = {
  title: 'Términos y Condiciones · Velacre',
  description: 'Condiciones de uso del servicio Velacre',
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-slate-900 dark:text-white">Velacre</Link>
          <Link href="/auth/login" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">Última actualización: marzo de 2026</p>

        <div className="space-y-10 text-slate-700 dark:text-slate-300 text-base leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">1. Objeto y aceptación</h2>
            <p>
              Los presentes Términos y Condiciones (en adelante, «Términos») regulan el acceso y uso del servicio
              <strong> Velacre</strong>, una plataforma SaaS de gestión y generación de respuestas a reseñas online
              mediante inteligencia artificial, accesible en <strong>velacre.com</strong> (en adelante, el «Servicio»).
            </p>
            <p className="mt-3">
              El titular del Servicio es <strong>[NOMBRE O RAZÓN SOCIAL]</strong>, con NIF/CIF <strong>[NIF]</strong>
              y domicilio en <strong>[DIRECCIÓN COMPLETA, CIUDAD, CÓDIGO POSTAL]</strong>, Galicia, España
              (en adelante, «Velacre», «nosotros» o «el Proveedor»).
            </p>
            <p className="mt-3">
              Al registrarte o utilizar el Servicio, aceptas íntegramente estos Términos. Si no estás de acuerdo,
              no debes utilizar el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">2. Descripción del Servicio</h2>
            <p>Velacre permite a negocios locales:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Conectar su perfil de Google Business y sincronizar reseñas de Google Maps.</li>
              <li>Generar respuestas personalizadas a dichas reseñas mediante modelos de inteligencia artificial.</li>
              <li>Analizar la evolución de su reputación online a través del Panel de Salud.</li>
              <li>Gestionar el tono y estilo de las respuestas generadas.</li>
            </ul>
            <p className="mt-3">
              Velacre actúa como herramienta de apoyo. La revisión final y publicación de cualquier respuesta
              es responsabilidad exclusiva del usuario. El Servicio no publica respuestas en Google de forma automática.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">3. Registro y cuenta de usuario</h2>
            <p>
              Para acceder al Servicio es necesario crear una cuenta. El usuario garantiza que los datos facilitados
              durante el registro son verídicos, completos y actualizados.
            </p>
            <p className="mt-3">
              El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las
              actividades realizadas desde su cuenta. Debe notificarnos inmediatamente cualquier uso no autorizado en{' '}
              <a href="mailto:hola@velacre.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">hola@velacre.com</a>.
            </p>
            <p className="mt-3">
              El Servicio está dirigido exclusivamente a profesionales y empresas. No está permitido el uso por
              personas menores de 18 años ni por consumidores finales que actúen fuera de su actividad comercial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">4. Obligaciones del usuario</h2>
            <p>El usuario se compromete a:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside">
              <li>Usar el Servicio únicamente para los fines previstos y de forma lícita.</li>
              <li>No intentar acceder a cuentas, sistemas o datos de otros usuarios.</li>
              <li>No realizar ingeniería inversa, descompilar ni intentar extraer el código fuente del Servicio.</li>
              <li>No usar el Servicio para generar contenido difamatorio, engañoso, ilegal o que infrinja derechos de terceros.</li>
              <li>No sobrecargar, interrumpir ni comprometer la seguridad de la infraestructura del Servicio.</li>
              <li>Cumplir con los Términos de Servicio de Google Maps Platform al utilizar las funciones de sincronización de reseñas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">5. Planes y precios</h2>
            <p>
              El Servicio se ofrece mediante suscripción mensual. Los planes disponibles, sus características y precios
              están descritos en la página de precios de <strong>velacre.com</strong> y pueden actualizarse con
              al menos <strong>30 días de preaviso</strong>.
            </p>
            <p className="mt-3">
              Los precios se indican en euros (€) e incluyen el IVA aplicable cuando corresponda. El pago se realiza
              a través de plataformas de pago seguras de terceros. Velacre no almacena datos de tarjetas de crédito.
            </p>
            <p className="mt-3">
              Las suscripciones se renuevan automáticamente al inicio de cada período facturado. El usuario puede
              cancelar en cualquier momento desde su área de cliente; la cancelación tendrá efecto al final del período
              en curso, sin derecho a reembolso parcial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">6. Propiedad intelectual</h2>
            <p>
              Todos los derechos de propiedad intelectual sobre el Servicio, su interfaz, marca, código y contenidos
              propios pertenecen a Velacre o a sus licenciantes. Queda prohibida su reproducción, distribución o
              explotación sin autorización escrita previa.
            </p>
            <p className="mt-3">
              Las respuestas generadas por la IA a partir de las reseñas del usuario son cedidas íntegramente al
              usuario para su uso. Velacre no reclama derechos sobre dicho contenido generado.
            </p>
            <p className="mt-3">
              El usuario conserva todos los derechos sobre los datos de su negocio y las reseñas que introduzca
              en la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">7. Disponibilidad y nivel de servicio</h2>
            <p>
              Velacre se esfuerza por mantener el Servicio disponible de forma continua, pero no garantiza una
              disponibilidad del 100 %. El Servicio puede interrumpirse por mantenimiento programado, actualizaciones
              o causas ajenas a nuestra voluntad.
            </p>
            <p className="mt-3">
              Notificaremos los mantenimientos programados con al menos 24 horas de antelación, salvo en casos de
              urgencia técnica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">8. Limitación de responsabilidad</h2>
            <p>
              Las respuestas generadas por la IA son sugerencias automáticas. Velacre no garantiza su exactitud,
              idoneidad ni corrección para ningún caso concreto. El usuario es el único responsable de revisar,
              aprobar y publicar dichas respuestas.
            </p>
            <p className="mt-3">
              En la máxima medida permitida por la ley, Velacre no será responsable de daños indirectos, lucro
              cesante, pérdida de reputación ni daños derivados del uso o imposibilidad de uso del Servicio.
              La responsabilidad total de Velacre frente al usuario no excederá el importe pagado por el Servicio
              durante los <strong>3 meses</strong> anteriores al hecho generador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">9. Suspensión y cancelación</h2>
            <p>
              Velacre se reserva el derecho de suspender o cancelar el acceso al Servicio, con o sin previo aviso,
              en caso de incumplimiento de estos Términos, impago, uso fraudulento o actividad que ponga en riesgo
              la seguridad de la plataforma o de otros usuarios.
            </p>
            <p className="mt-3">
              El usuario puede solicitar la baja de su cuenta en cualquier momento escribiendo a{' '}
              <a href="mailto:hola@velacre.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">hola@velacre.com</a>.
              Tras la baja, los datos se eliminarán conforme a lo indicado en la Política de Privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">10. Modificaciones</h2>
            <p>
              Velacre puede modificar estos Términos en cualquier momento. Los cambios se comunicarán por correo
              electrónico y/o mediante aviso en la plataforma con al menos <strong>15 días de antelación</strong>.
              El uso continuado del Servicio tras ese plazo implica la aceptación de los nuevos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">11. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por la legislación española, en particular la Ley 34/2002 de Servicios de la
              Sociedad de la Información (LSSI), el Real Decreto Legislativo 1/2007 (TRLGDCU) en lo que resulte
              aplicable a relaciones B2B, el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
            </p>
            <p className="mt-3">
              Para la resolución de cualquier controversia derivada de estos Términos, las partes se someten,
              con renuncia expresa a cualquier otro fuero, a los Juzgados y Tribunales de{' '}
              <strong>[CIUDAD — p. ej. Ferrol o A Coruña]</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">12. Contacto</h2>
            <p>
              Para cualquier consulta sobre estos Términos puedes contactarnos en:{' '}
              <a href="mailto:hola@velacre.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                hola@velacre.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 justify-center text-sm">
          <Link href="/privacidad" className="text-indigo-600 dark:text-indigo-400 hover:underline">Política de Privacidad</Link>
          <Link href="/contacto" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contacto</Link>
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:underline">Volver al inicio</Link>
        </div>
      </main>
    </div>
  )
}
