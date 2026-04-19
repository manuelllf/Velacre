'use client'

import { useLanguage } from '@/lib/i18n'
import { PublicShell } from '@/components/PublicShell'

export default function ContactoPage() {
  const { t } = useLanguage()
  const c = t.app.legal.contact

  const card: React.CSSProperties = {
    background: 'var(--paper-2)',
    border: '1px solid var(--line-strong)',
    borderRadius: 4,
    padding: 20,
  }

  const label: React.CSSProperties = {
    color: 'var(--mute)',
    marginBottom: 10,
  }

  const emailLink: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 500,
  }

  return (
    <PublicShell>
      <article className="wrap prose-legal">
        <h1>{c.title}</h1>
        <p className="updated">{c.subtitle}</p>

        <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
          <div style={card}>
            <div className="mono" style={label}>
              {c.generalEmail}
            </div>
            <a href="mailto:info@velacre.com" style={emailLink}>
              info@velacre.com
            </a>
            <p style={{ marginTop: 10, marginBottom: 0 }}>{c.generalEmailDesc}</p>
            <p className="mono-sm" style={{ marginTop: 12, marginBottom: 0 }}>{c.generalEmailNote}</p>
          </div>

          <div style={card}>
            <div className="mono" style={label}>
              {c.privacyEmail}
            </div>
            <a href="mailto:privacidad@velacre.com" style={emailLink}>
              privacidad@velacre.com
            </a>
            <p style={{ marginTop: 10, marginBottom: 0 }}>{c.privacyEmailDesc}</p>
          </div>

          <div style={card}>
            <div className="mono" style={label}>
              {c.locationTitle}
            </div>
            <address style={{ fontStyle: 'normal', lineHeight: 1.6, color: 'var(--ink)' }}>
              <strong>Manuel Llao Freire</strong>
              <br />
              {c.locationAddress}
            </address>
          </div>
        </div>

        <h2>{c.faqTitle}</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {c.faqs.map((item, i) => (
            <div key={i} style={card}>
              <p style={{ color: 'var(--ink)', fontWeight: 500, marginBottom: 6 }}>{item.q}</p>
              <p style={{ margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </article>
    </PublicShell>
  )
}
