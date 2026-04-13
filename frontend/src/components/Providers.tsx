'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '@/lib/i18n'
import PWAInstall from '@/components/PWAInstall'
import LangSwitcher from '@/components/LangSwitcher'
import ErrorBoundary from '@/components/ErrorBoundary'

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
          {children}
          <PWAInstall />
          <LangSwitcher />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
