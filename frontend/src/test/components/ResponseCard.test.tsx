import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock i18n hook
vi.mock('@/lib/i18n', () => ({
  useLanguage: () => ({
    locale: 'es',
    t: {
      app: {
        common: { copied: 'Copiado' },
        dashboard: { copyBtn: 'Copiar respuesta' },
      },
    },
  }),
}))

import ResponseCard from '@/components/ResponseCard'

beforeEach(() => {
  // Reset clipboard mock before each test
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('ResponseCard', () => {
  it('renders tone label and text', () => {
    render(<ResponseCard tone="Profesional" text="Gracias por su visita." color="indigo" />)

    expect(screen.getByText('Profesional')).toBeInTheDocument()
    expect(screen.getByText('Gracias por su visita.')).toBeInTheDocument()
  })

  it('renders copy button with correct label', () => {
    render(<ResponseCard tone="Cercano" text="¡Gracias!" color="emerald" />)

    expect(screen.getByRole('button', { name: 'Copiar respuesta' })).toBeInTheDocument()
  })

  it('copies text to clipboard on click', async () => {
    render(<ResponseCard tone="Directo" text="Agradecemos su feedback." color="amber" />)

    const button = screen.getByRole('button', { name: 'Copiar respuesta' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Agradecemos su feedback.')
    })
  })

  it('shows copied state after click', async () => {
    render(<ResponseCard tone="Profesional" text="Gracias." color="indigo" />)

    const button = screen.getByRole('button', { name: 'Copiar respuesta' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Copiado')).toBeInTheDocument()
    })
  })
})
