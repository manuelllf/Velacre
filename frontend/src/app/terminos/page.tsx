'use client'

import { useLanguage } from '@/lib/i18n'
import { PublicShell } from '@/components/PublicShell'

export default function TerminosPage() {
  const { t } = useLanguage()
  const terms = t.app.legal.terms

  return (
    <PublicShell>
      <article className="wrap prose-legal">
        <h1>{terms.title}</h1>
        <p className="updated">{terms.lastUpdated}</p>

        {terms.sections.map((section, i) => (
          <section key={i}>
            <h2>{section.title}</h2>
            {section.paragraphs[0] && <p>{section.paragraphs[0]}</p>}
            {section.items && (
              <ul>
                {section.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )}
            {section.paragraphs.slice(1).map((para, j) => (
              <p key={j}>{para}</p>
            ))}
          </section>
        ))}
      </article>
    </PublicShell>
  )
}
