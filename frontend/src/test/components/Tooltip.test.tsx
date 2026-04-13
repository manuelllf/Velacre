import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Tooltip from '@/components/Tooltip'

describe('Tooltip', () => {
  it('renders the question mark button', () => {
    render(<Tooltip text="Información de ayuda" />)

    expect(screen.getByRole('button', { name: 'Más información' })).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('shows tooltip text on hover', async () => {
    render(<Tooltip text="Este es el tooltip" />)

    const button = screen.getByRole('button', { name: 'Más información' })

    // Tooltip not visible initially
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    // Hover to show
    fireEvent.mouseEnter(button.parentElement!)

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Este es el tooltip')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', async () => {
    render(<Tooltip text="Tooltip temporal" />)

    const wrapper = screen.getByRole('button', { name: 'Más información' }).parentElement!

    fireEvent.mouseEnter(wrapper)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(wrapper)

    // Wait for the 120ms timeout to hide
    await waitFor(
      () => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
      { timeout: 500 },
    )
  })

  it('shows tooltip on focus', () => {
    render(<Tooltip text="Focus tooltip" />)

    const wrapper = screen.getByRole('button', { name: 'Más información' }).parentElement!

    fireEvent.focus(wrapper)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
