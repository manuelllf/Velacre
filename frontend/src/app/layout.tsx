import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://velacre.com").replace(/\/$/, "");
const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE_DEFAULT = "Velacre · Responde tus reseñas de Google con IA";
const DESCRIPTION_DEFAULT =
  "SaaS español que responde las reseñas de Google de tu restaurante, bar o negocio con IA en tu tono. Te avisa de lo que está fallando antes de que lo noten tus clientes y vigila qué hacen mejor tus competidores. Para hostelería y PYME. Prueba gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE_DEFAULT,
    template: "%s · Velacre",
  },
  description: DESCRIPTION_DEFAULT,
  applicationName: "Velacre",
  authors: [{ name: "Velacre", url: SITE_URL }],
  creator: "Velacre",
  publisher: "Velacre",
  keywords: [
    "responder reseñas Google con IA",
    "software gestión reseñas",
    "SaaS reseñas Google",
    "IA para reseñas de restaurantes",
    "reseñas hostelería",
    "gestión reseñas restaurantes",
    "reputación online restaurantes",
    "responder reseñas automáticamente",
    "reseñas Google Galicia",
    "software reseñas hostelería España",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-48x48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon-120x120.png", sizes: "120x120" },
      { url: "/icons/apple-touch-icon-152x152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-180x180.png", sizes: "180x180" },
    ],
    other: [
      { rel: "mask-icon", url: "/icons/logo-256.png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Velacre",
    startupImage: "/icons/apple-touch-icon-180x180.png",
  },
  alternates: {
    canonical: "/",
    languages: {
      "es-ES": "/es",
      "gl-ES": "/gal",
      "en-US": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Velacre",
    title: TITLE_DEFAULT,
    description: DESCRIPTION_DEFAULT,
    locale: "es_ES",
    alternateLocale: ["gl_ES", "en_US"],
    images: [
      {
        url: "/icons/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Velacre — Responde reseñas de Google con IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE_DEFAULT,
    description: DESCRIPTION_DEFAULT,
    images: ["/icons/og-image-1200x630.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: GSC_VERIFICATION ? { google: GSC_VERIFICATION } : undefined,
  category: "technology",
  other: {
    "msapplication-TileColor": "#0A0E1A",
    "msapplication-TileImage": "/icons/mstile-150x150.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Velacre",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/logo-1024.png`,
      email: "info@velacre.com",
      sameAs: [] as string[],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Velacre",
      url: SITE_URL,
      description: DESCRIPTION_DEFAULT,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      inLanguage: ["es", "gl", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: [
        {
          "@type": "Offer",
          name: "Basic",
          price: "0",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Core",
          price: "19",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "39",
          priceCurrency: "EUR",
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Velacre",
      inLanguage: "es-ES",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

// Script inline que corre ANTES del paint: si hay sessionStorage fresco con
// vel_goodbye/vel_welcome, añade una clase al html para que el overlay
// inline (#vel-prepaint) tape toda la página hasta que React hidrate y
// WelcomeTransition tome el control. Evita el flash de landing entre el
// hard reload y el montaje del overlay React.
const PRE_PAINT_SCRIPT = `
try {
  var now = Date.now();
  var g = sessionStorage.getItem('vel_goodbye');
  var w = sessionStorage.getItem('vel_welcome');
  var gTs = g ? Number(g) : 0;
  var wTs = w ? Number(w) : 0;
  var fresh = function(ts) { return ts > 0 && now - ts < 10000; };
  if (fresh(gTs))      document.documentElement.classList.add('vel-prepaint-goodbye');
  else if (fresh(wTs)) document.documentElement.classList.add('vel-prepaint-welcome');
} catch (e) {}
`.trim();

const PRE_PAINT_STYLE = `
#vel-prepaint {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
}
html.vel-prepaint-goodbye #vel-prepaint { display: block; background: #0A0E1A; }
html.vel-prepaint-welcome #vel-prepaint { display: block; background: #E8E2D4; }
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: PRE_PAINT_STYLE }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div id="vel-prepaint" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
