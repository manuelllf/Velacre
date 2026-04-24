import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE = "Velacre · Responde tus reseñas de Google con IA";
const DESCRIPTION =
  "SaaS español que contesta las reseñas de Google de tu restaurante, bar u hotel con IA en tu propio tono. Te avisa de lo que está fallando antes de que lo noten tus clientes. Prueba gratis, sin tarjeta.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/es",
    languages: {
      "es-ES": "/es",
      "gl-ES": "/gal",
      "en-US": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: "/es",
    siteName: "Velacre",
    title: TITLE,
    description: DESCRIPTION,
    locale: "es_ES",
    alternateLocale: ["gl_ES", "en_US"],
    images: [{ url: "/icons/og-image-1200x630.png", width: 1200, height: 630, alt: "Velacre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icons/og-image-1200x630.png"],
  },
};

export default function EsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
