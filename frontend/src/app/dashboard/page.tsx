'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  generateResponses,
  saveManualReview,
  getMyUsuario,
  getAllReviews,
  generateForReview,
  syncReviews,
  setReviewEstado,
  updateReviewResponse,
  getGbpStatus,
  ApiError,
  type ReviewResponses,
  type Negocio,
  type PendingReview,
} from '@/lib/api'
import SectionNav from '@/components/SectionNav'
import PublishGoogleModal from '@/components/PublishGoogleModal'
import { HelpButton } from '@/components/HelpModal'
import ReportErrorModal from '@/components/ReportErrorModal'
import { useLanguage } from '@/lib/i18n'
import { trackLastAction, type ErrorInfoLike } from '@/lib/errorReporter'
import { useNegocioActivo } from '@/lib/negocio-activo'

import DetailPanel from '@/components/dashboard/DetailPanel'
import ReviewList from '@/components/dashboard/ReviewList'
import SyncBar from '@/components/dashboard/SyncBar'
import IaUsageBar from '@/components/dashboard/IaUsageBar'
import ManualReviewModal from '@/components/dashboard/ManualReviewModal'
import UpsellModal from '@/components/dashboard/UpsellModal'
import { AppHeader } from '@/components/AppHeader'
import { AppFooter } from '@/components/AppFooter'

type EstadoFilter = 'pendiente' | 'respondida' | 'ignorada' | 'todas'

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const d = t.app.dashboard

  // Multi-local: leemos el negocio activo del provider. Al cambiar de local desde
  // el dropdown, el segundo useEffect (más abajo) recarga reseñas + negocio.
  const { activo, isLoading: activoLoading } = useNegocioActivo()

  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [userPlan, setUserPlan] = useState<string>('basic')
  const [loadingInit, setLoadingInit] = useState(true)
  const [initError, setInitError] = useState('')
  const [initErrorInfo, setInitErrorInfo] = useState<ErrorInfoLike | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportModalContext, setReportModalContext] = useState<ErrorInfoLike | null>(null)
  const [userEmailForReport, setUserEmailForReport] = useState<string | undefined>(undefined)

  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('pendiente')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [generatedResponses, setGeneratedResponses] = useState<Record<string, string>>({})
  const [contextos, setContextos] = useState<Record<string, { cliente: string; respuesta: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingEstado, setUpdatingEstado] = useState<Set<string>>(new Set())

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState(0)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)
  const [upsellInfo, setUpsellInfo] = useState<{ plan: string; limit: number; used: number } | null>(null)
  const [iaUsed, setIaUsed] = useState<number>(0)
  const [proSoftCapVisible, setProSoftCapVisible] = useState(false)

  // GBP
  const [gbpConnected, setGbpConnected] = useState(false)
  const [publishModal, setPublishModal] = useState<{ id: string; texto: string } | null>(null)

  // Manual section
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [manualResponses, setManualResponses] = useState<ReviewResponses | null>(null)
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualCopied, setManualCopied] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualContexto, setManualContexto] = useState<{ cliente: string; respuesta: string } | null>(null)

  // Carga inicial: solo usuario + gbp (datos no scoped). El negocio y reseñas se
  // cargan en el useEffect de más abajo, keyeado por `activo?.id`.
  useEffect(() => {
    async function init() {
      trackLastAction('dashboard:init')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth/login'); return }
      setUserEmailForReport(session.user?.email ?? undefined)
      try {
        const [u, gbp] = await Promise.all([getMyUsuario(), getGbpStatus().catch(() => null)])
        if (u.isAdmin || u.rol === 'admin') { router.replace('/admin'); return }
        const plan = u.plan ?? 'basic'
        setUserPlan(plan)
        setIaUsed(u.respuestasIaMes ?? 0)
        setGbpConnected(gbp?.connected ?? false)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/auth/login')
        } else {
          setInitError(t.app.errors.serverError)
          setInitErrorInfo({
            source: err instanceof ApiError ? 'api' : 'network',
            message: err instanceof Error ? err.message : String(err),
            statusCode: err instanceof ApiError ? err.status : undefined,
            endpoint: '/dashboard init',
          })
        }
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Carga scoped: negocio activo + reseñas. Se dispara cada vez que el usuario
  // cambia de local desde el dropdown (activo.id cambia) → re-fetchea sus reseñas.
  // userPlan va como dep para resolver la race: el useState arranca en 'basic' y
  // si activo?.id resuelve antes que getMyUsuario(), loadReviews() recortaría la
  // lista a 10 pensando que eres Basic. Al actualizarse userPlan el efecto se
  // re-ejecuta con el plan real. El coste extra (1 fetch) es irrelevante.
  useEffect(() => {
    if (activoLoading) return
    if (!activo) {
      if (!loadingInit) router.replace('/onboarding')
      return
    }
    setNegocio(activo)
    setSelectedId(null)
    loadReviews(userPlan).finally(() => setLoadingInit(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo?.id, activoLoading, userPlan])

  function openReportModal(info: ErrorInfoLike) {
    setReportModalContext(info)
    setReportModalOpen(true)
  }

  async function loadReviews(plan?: string) {
    setLoadingReviews(true)
    try {
      const data = await getAllReviews()
      const effectivePlan = plan ?? userPlan
      const visible = effectivePlan === 'basic' ? data.slice(0, 10) : data
      setReviews(visible)

      const newContextos: Record<string, { cliente: string; respuesta: string }> = {}
      const newGenerated: Record<string, string> = {}
      for (const r of visible) {
        if (r.contextoCliente && r.contextoRespuesta) {
          newContextos[r.id] = { cliente: r.contextoCliente, respuesta: r.contextoRespuesta }
        }
        if (r.tonoGenerado && r.tonoGenerado !== 'google' && r.respuesta) {
          newGenerated[r.id] = r.respuesta
        }
      }
      setContextos(newContextos)
      setGeneratedResponses(prev => ({ ...prev, ...newGenerated }))
    }
    catch { /* silent */ }
    finally { setLoadingReviews(false) }
  }

  async function handleSync() {
    trackLastAction('dashboard:sync_reviews')
    setSyncLoading(true)
    setSyncMessage('')
    setSyncProgress(5)

    const TOTAL_MS = 14000
    const TICK_MS = 200
    const ticks = TOTAL_MS / TICK_MS
    let tick = 0
    syncIntervalRef.current = setInterval(() => {
      tick++
      setSyncProgress(Math.min(92, Math.round(5 + (tick / ticks) * 87)))
    }, TICK_MS)

    try {
      const result = await syncReviews()
      clearInterval(syncIntervalRef.current!)
      setSyncProgress(100)
      await loadReviews()
      setSyncMessage(result.newReviews > 0
        ? d.syncDone.replace('{n}', String(result.newReviews))
        : d.syncNone)
    } catch (err) {
      clearInterval(syncIntervalRef.current!)
      setSyncMessage(err instanceof Error ? err.message : t.app.common.error)
    } finally {
      setSyncLoading(false)
      setTimeout(() => { setSyncProgress(0); setSyncMessage('') }, 5000)
    }
  }

  async function handleGenerate(reviewId: string, force = false) {
    trackLastAction(`dashboard:generate_review:${reviewId}${force ? ':force' : ''}`)
    setGeneratingIds(prev => new Set(prev).add(reviewId))
    try {
      const result = await generateForReview(reviewId, force)

      if (result.retenida) {
        setReviews(prev => prev.map(r => r.id === reviewId
          ? { ...r, retenida: true, motivoRetencion: result.motivoRetencion ?? undefined }
          : r))
        return
      }

      setGeneratedResponses(prev => ({ ...prev, [reviewId]: result.response ?? '' }))
      if (userPlan === 'basic' || userPlan === 'core') setIaUsed(prev => prev + 1)
      if (result.contextoCliente && result.contextoRespuesta) {
        setContextos(prev => ({ ...prev, [reviewId]: { cliente: result.contextoCliente!, respuesta: result.contextoRespuesta! } }))
      }
      if (result.softCapWarning) setProSoftCapVisible(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        setShowUpsell(true)
      } else {
        setGeneratedResponses(prev => ({
          ...prev,
          [reviewId + '_error']: err instanceof Error ? err.message : t.app.common.error,
        }))
      }
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(reviewId); return s })
    }
  }

  async function handleSetEstado(reviewId: string, estado: 'pendiente' | 'respondida' | 'ignorada') {
    setUpdatingEstado(prev => new Set(prev).add(reviewId))
    try {
      await setReviewEstado(reviewId, estado)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, estado } : r))
      if (estadoFilter !== 'todas' && estadoFilter !== estado) setSelectedId(null)
    } catch { /* silent */ }
    finally { setUpdatingEstado(prev => { const s = new Set(prev); s.delete(reviewId); return s }) }
  }

  function closeManualModal() {
    setManualModalOpen(false)
    setManualResponses(null)
    setManualError('')
    setReviewText('')
    setManualCopied(false)
    setManualContexto(null)
  }

  async function handleGenerateManual(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewText.trim()) return
    setManualError('')
    setManualLoading(true)
    setManualResponses(null)
    setManualCopied(false)
    try {
      const result = await generateResponses(reviewText, negocio?.tonopredefinido ?? 'Profesional')
      setManualResponses(result)
      if (result.contextoCliente || result.contextoRespuesta) {
        setManualContexto({ cliente: result.contextoCliente ?? '', respuesta: result.contextoRespuesta ?? '' })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        closeManualModal()
        setShowUpsell(true)
      } else {
        setManualError(err instanceof Error ? err.message : t.app.common.error)
      }
    } finally {
      setManualLoading(false)
    }
  }

  async function handleSaveManual(estado: 'pendiente' | 'respondida') {
    if (!manualResponses) return
    setManualSaving(true)
    try {
      const ctx = manualContexto
      const saved = await saveManualReview({
        reviewText,
        tonoSeleccionado: negocio?.tonopredefinido ?? 'Profesional',
        respuesta: manualResponses.respuesta ?? '',
        estado,
        contextoCliente: manualContexto?.cliente,
        contextoRespuesta: manualContexto?.respuesta,
      })
      setReviews(prev => {
        const effectivePlan = userPlan
        const newList = [saved, ...prev]
        return effectivePlan === 'basic' ? newList.slice(0, 10) : newList
      })
      const resp = manualResponses.respuesta
      if (resp && saved.id) {
        setGeneratedResponses(prev => ({ ...prev, [saved.id]: resp }))
      }
      const contextoToStore = saved.contextoCliente && saved.contextoRespuesta
        ? { cliente: saved.contextoCliente, respuesta: saved.contextoRespuesta }
        : ctx
      if (contextoToStore && saved.id) {
        setContextos(prev => ({ ...prev, [saved.id]: contextoToStore }))
      }
      setEstadoFilter(estado)
      closeManualModal()
      setSelectedId(saved.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const d = err.data as { plan?: string; limit?: number; used?: number } | undefined
        setUpsellInfo(d?.plan ? { plan: d.plan, limit: d.limit ?? 3, used: d.used ?? 0 } : null)
        closeManualModal()
        setShowUpsell(true)
      } else {
        setManualError(err instanceof Error ? err.message : t.app.common.error)
      }
    } finally {
      setManualSaving(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <p className="text-slate-600 dark:text-slate-400">{initError}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              {t.app.errors.reload}
            </button>
            <button
              onClick={() => openReportModal(initErrorInfo ?? { source: 'api', message: initError })}
              className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-700"
            >
              {t.app.errors.reportBtn}
            </button>
          </div>
        </div>
        <ReportErrorModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          errorInfo={reportModalContext ?? { source: 'api', message: initError }}
          userContext={{ email: userEmailForReport, plan: userPlan }}
        />
      </div>
    )
  }

  const filtered = estadoFilter === 'todas'
    ? reviews
    : reviews.filter(r => (r.estado ?? 'pendiente') === estadoFilter)

  const counts: Record<EstadoFilter, number> = {
    pendiente:  reviews.filter(r => (r.estado ?? 'pendiente') === 'pendiente').length,
    respondida: reviews.filter(r => r.estado === 'respondida').length,
    ignorada:   reviews.filter(r => r.estado === 'ignorada').length,
    todas:      reviews.length,
  }

  const selectedReview = selectedId ? filtered.find(r => r.id === selectedId) ?? null : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader negocioNombre={negocio?.nombre} plan={userPlan as 'basic' | 'core' | 'pro'} />

      <SectionNav />

      <main className="max-w-screen-xl mx-auto px-4 py-4 space-y-3">

        {/* Pro soft cap warning */}
        {proSoftCapVisible && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-300">{d.softCap.title}</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                {d.softCap.desc.split('info@velacre.com')[0]}<a href="mailto:info@velacre.com" className="underline font-medium">info@velacre.com</a>{d.softCap.desc.split('info@velacre.com')[1]}
              </p>
            </div>
            <button onClick={() => setProSoftCapVisible(false)} className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 text-lg leading-none shrink-0 cursor-pointer" aria-label={t.app.common.cancel}>×</button>
          </div>
        )}

        {/* Toolbar compacta: IA usage pill (solo Basic/Core con margen) a la izquierda,
            sync/refresh/otra plataforma a la derecha. Misma fila cuando cabe. */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <IaUsageBar userPlan={userPlan} iaUsed={iaUsed} />
          <SyncBar
            syncLoading={syncLoading}
            syncProgress={syncProgress}
            syncMessage={syncMessage}
            loadingReviews={loadingReviews}
            onRefresh={() => loadReviews()}
            onManual={() => setManualModalOpen(true)}
            onSync={handleSync}
          />
        </div>

        {/* Two-column layout: list + detail. Altura fija en desktop → scroll interno
            en la lista y en el detalle, acciones sticky al fondo del detalle siempre visibles. */}
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-13rem)]">

          <ReviewList
            reviews={reviews}
            filtered={filtered}
            estadoFilter={estadoFilter}
            selectedId={selectedId}
            generatedResponses={generatedResponses}
            counts={counts}
            loadingReviews={loadingReviews}
            onFilterChange={setEstadoFilter}
            onSelect={setSelectedId}
          />

          {/* RIGHT: detail panel */}
          <div className={`min-w-0 lg:overflow-y-auto lg:h-full scroll-thin flex-1 ${selectedId ? 'block' : 'hidden lg:block'}`}>
            {selectedReview ? (
              <>
                {/* Botón volver — solo mobile, sticky bajo el header */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden sticky top-14 z-30 flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white bg-slate-950/95 backdrop-blur-md -mx-4 px-4 py-2.5 mb-4 border-b border-slate-800/60 w-[calc(100%+2rem)]"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  {d.backToList}
                </button>
              <DetailPanel
                review={selectedReview}
                generated={generatedResponses[selectedReview.id]}
                generatedError={generatedResponses[selectedReview.id + '_error']}
                contexto={contextos[selectedReview.id]}
                isGenerating={generatingIds.has(selectedReview.id)}
                isUpdating={updatingEstado.has(selectedReview.id)}
                copiedId={copiedId}
                gbpConnected={gbpConnected}
                userPlan={userPlan}
                isOtraPlatforma={selectedReview.plataforma === 'Otra'}
                onGenerate={() => handleGenerate(selectedReview.id)}
                onRegenerateIA={() => handleGenerate(selectedReview.id, true)}
                onSaveResponse={async (texto) => {
                  // Persiste la edición manual y actualiza los campos locales + el cache
                  // de respuestas para que el textarea no se resetee al re-renderizar.
                  await updateReviewResponse(selectedReview.id, texto)
                  setGeneratedResponses(prev => ({ ...prev, [selectedReview.id]: texto }))
                  setReviews(prev => prev.map(r => r.id === selectedReview.id ? { ...r, respuesta: texto } : r))
                }}
                onLoad={() => {
                  if (selectedReview.respuesta) {
                    setGeneratedResponses(prev => ({ ...prev, [selectedReview.id]: selectedReview.respuesta! }))
                  }
                }}
                onSetEstado={(e) => handleSetEstado(selectedReview.id, e)}
                onCopy={(text) => {
                  navigator.clipboard.writeText(text)
                  setCopiedId(selectedReview.id)
                  setTimeout(() => setCopiedId(null), 2000)
                }}
                onPublish={(texto) => setPublishModal({ id: selectedReview.id, texto })}
                onRetry={() => setGeneratedResponses(prev => { const s = { ...prev }; delete s[selectedReview.id + '_error']; return s })}
                commonError={t.app.common.error}
              />
              </>
            ) : (
              <div className="hidden lg:flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-80 items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{d.selectReview}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{d.selectReviewDesc}</p>
                </div>
              </div>
            )}

          </div>
        </div>

      </main>

      <ManualReviewModal
        open={manualModalOpen}
        reviewText={reviewText}
        manualResponses={manualResponses}
        manualLoading={manualLoading}
        manualError={manualError}
        manualSaving={manualSaving}
        manualCopied={manualCopied}
        manualContexto={manualContexto}
        negocio={negocio}
        onClose={closeManualModal}
        onChangeText={setReviewText}
        onSubmit={handleGenerateManual}
        onSave={handleSaveManual}
        onReset={() => { setManualResponses(null); setManualError(''); setManualCopied(false); setManualContexto(null) }}
        onCopy={async () => {
          await navigator.clipboard.writeText(manualResponses?.respuesta ?? '')
          setManualCopied(true)
          setTimeout(() => setManualCopied(false), 2000)
        }}
      />

      <UpsellModal
        show={showUpsell}
        upsellInfo={upsellInfo}
        reviews={reviews}
        onClose={() => setShowUpsell(false)}
      />

      {/* Modal: publicar en Google */}
      {publishModal && (
        <PublishGoogleModal
          reviewId={publishModal.id}
          respuestaGenerada={publishModal.texto}
          onClose={() => setPublishModal(null)}
          onPublished={() => {
            setPublishModal(null)
            setReviews(prev => prev.map(r =>
              r.id === publishModal.id
                ? { ...r, estado: 'respondida', publicadaEnGoogle: true }
                : r
            ))
          }}
        />
      )}

      <HelpButton />

      <AppFooter />
    </div>
  )
}
