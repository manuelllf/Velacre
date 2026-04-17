'use client'

import { useLanguage } from '@/lib/i18n'
import { PublicShell } from '@/components/PublicShell'

export default function ContactoPage() {
  const { t } = useLanguage()
  const c = t.app.legal.contact

  return (
    <PublicShell>
      <article className="wrap prose-legal">
        <h1>{c.title}</h1>
        <p className="updated">{c.subtitle}</p>

        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ background: 'var(--ink-2)' }}>
            <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>
              {c.generalEmail}
            </div>
            <a href="mailto:info@velacre.com" style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 500 }}>
              info@velacre.com
            </a>
            <p style={{ marginTop: 10 }}>{c.generalEmailDesc}</p>
            <p className="mono-sm" style={{ marginTop: 12 }}>{c.generalEmailNote}</p>
          </div>

          <div className="card" style={{ background: 'var(--ink-2)' }}>
            <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>
              {c.privacyEmail}
            </div>
            <a href="mailto:privacidad@velacre.com" style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 500 }}>
              privacidad@velacre.com
            </a>
            <p style={{ marginTop: 10 }}>{c.privacyEmailDesc}</p>
          </div>

          <div className="card" style={{ background: 'var(--ink-2)' }}>
            <div className="mono" style={{ color: 'var(--paper-dim)', marginBottom: 10 }}>
              {c.locationTitle}
            </div>
            <address style={{ fontStyle: 'normal', lineHeight: 1.6 }}>
              <strong>Manuel Llao Freire</strong>
              <br />
              {c.locationAddress}
            </address>
          </div>
        </div>

        <h2>{c.faqTitle}</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {c.faqs.map((item, i) => (
            <div key={i} className="card" style={{ background: 'var(--ink-2)' }}>
              <p style={{ color: 'var(--paper)', fontWeight: 500, marginBottom: 6 }}>{item.q}</p>
              <p style={{ margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </article>
    </PublicShell>
  )
}
