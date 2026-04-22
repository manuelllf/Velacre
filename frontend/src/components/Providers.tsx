'use client'

import { Suspense, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/lib/i18n'
import { NegocioActivoProvider } from '@/lib/negocio-activo'
import PWAInstall from '@/components/PWAInstall'
import LangSwitcher from '@/components/LangSwitcher'
import ErrorBoundary from '@/components/ErrorBoundary'
import WelcomeTransition from '@/components/WelcomeTransition'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Suspense fallback={null}>
            <NegocioActivoProvider>
              {children}
            </NegocioActivoProvider>
          </Suspense>
          <PWAInstall />
          <LangSwitcher />
          <Suspense fallback={null}>
            <WelcomeTransition />
          </Suspense>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
