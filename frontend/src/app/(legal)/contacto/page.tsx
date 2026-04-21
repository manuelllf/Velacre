'use client'

import { useLanguage } from '@/lib/i18n'

// PublicShell lo pone el layout de (legal).

export default function ContactoPage() {
  const { t } = useLanguage()
  const c = t.app.legal.contact

  return (
    <>
      <article className="wrap prose-legal">
        <h1>{c.title}</h1>
        <p className="updated">{c.subtitle}</p>

        <dl className="contact-list">
          <div className="contact-row">
            <p className="ctc-lbl">{c.generalEmail}</p>
            <div>
              <a href="mailto:info@velacre.com" className="ctc-val">info@velacre.com</a>
              <p className="ctc-body">{c.generalEmailDesc}</p>
              <p className="ctc-note">{c.generalEmailNote}</p>
            </div>
          </div>

          <div className="contact-row">
            <p className="ctc-lbl">{c.privacyEmail}</p>
            <div>
              <a href="mailto:privacidad@velacre.com" className="ctc-val">privacidad@velacre.com</a>
              <p className="ctc-body">{c.privacyEmailDesc}</p>
            </div>
          </div>

          <div className="contact-row">
            <p className="ctc-lbl">{c.locationTitle}</p>
            <div>
              <p className="ctc-val">Manuel Llao Freire</p>
              <p className="ctc-body">{c.locationAddress}</p>
            </div>
          </div>
        </dl>

        <h2>{c.faqTitle}</h2>
        <div>
          {c.faqs.map((item, i) => (
            <div key={i} className="ctc-faq">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
