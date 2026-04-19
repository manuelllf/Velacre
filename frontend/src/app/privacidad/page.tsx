'use client'

import { useLanguage } from '@/lib/i18n'
import { PublicShell } from '@/components/PublicShell'

export default function PrivacidadPage() {
  const { t } = useLanguage()
  const p = t.app.legal.privacy

  return (
    <PublicShell>
      <article className="wrap prose-legal">
        <h1>{p.title}</h1>
        <p className="updated">{p.lastUpdated}</p>

        <section>
          <h2>{p.s1Title}</h2>
          <p>{p.s1p1}</p>
          <p>{p.s1p2}</p>
        </section>

        <section>
          <h2>{p.s2Title}</h2>
          <p>{p.s2intro}</p>
          <ul>
            {p.s2items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{p.s2note}</p>
        </section>

        <section>
          <h2>{p.s3Title}</h2>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                border: '1px solid var(--line)',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--paper-2)' }}>
                  <th
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      color: 'var(--ink)',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--line-strong)',
                    }}
                  >
                    {p.s3headers[0]}
                  </th>
                  <th
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      color: 'var(--ink)',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--line-strong)',
                    }}
                  >
                    {p.s3headers[1]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.s3rows.map(([col1, col2], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--muted-strong)' }}>{col1}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--muted-strong)' }}>{col2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>{p.s4Title}</h2>
          <p>{p.s4intro}</p>
          <ul>
            {p.s4items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{p.s4note}</p>
        </section>

        <section>
          <h2>{p.s5Title}</h2>
          <p>{p.s5intro}</p>
          <ul>
            {p.s5items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>

        <section>
          <h2>{p.s6Title}</h2>
          <p>{p.s6intro}</p>
          <ul>
            {p.s6rights.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{p.s6exercise}</p>
          <p>{p.s6complaint}</p>
        </section>

        <section>
          <h2>{p.s7Title}</h2>
          <p>{p.s7text}</p>
        </section>

        <section>
          <h2>{p.s8Title}</h2>
          <p>{p.s8text}</p>
        </section>

        <section>
          <h2>{p.s9Title}</h2>
          <p>{p.s9text}</p>
        </section>
      </article>
    </PublicShell>
  )
}
