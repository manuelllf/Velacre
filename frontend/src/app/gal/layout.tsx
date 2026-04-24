import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE =
  "Velacre — Responde as recensións de Google con IA | Software para hostalaría en Galicia";
const DESCRIPTION =
  "SaaS galego que contesta as recensións de Google do teu restaurante, bar ou hotel con IA no teu propio ton. Avisache do que está fallando antes de que o noten os teus clientes. Proba grátis, sen tarxeta.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/gal",
    languages: {
      "es-ES": "/es",
      "gl-ES": "/gal",
      "en-US": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: "/gal",
    siteName: "Velacre",
    title: TITLE,
    description: DESCRIPTION,
    locale: "gl_ES",
    alternateLocale: ["es_ES", "en_US"],
    images: [{ url: "/icons/og-image-1200x630.png", width: 1200, height: 630, alt: "Velacre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icons/og-image-1200x630.png"],
  },
};

export default function GalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
