import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Velacre",
  description: "Gestiona y responde las reseñas de tu negocio con IA",
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
  openGraph: {
    title: "Velacre",
    description: "Gestiona y responde las reseñas de tu negocio con IA",
    images: ["/icons/og-image-1200x630.png"],
  },
  other: {
    "msapplication-TileColor": "#0A0E1A",
    "msapplication-TileImage": "/icons/mstile-150x150.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
};

// Script inline que corre ANTES del paint para pintar el html en el color
// de arranque del overlay de bienvenida/despedida, evitando un flash entre
// el reload y el montaje de React.
// Welcome arranca en crema, goodbye en navy.
const PRE_PAINT_SCRIPT = `
try {
  var now = Date.now();
  var g = sessionStorage.getItem('vel_goodbye');
  var w = sessionStorage.getItem('vel_welcome');
  var gTs = g ? Number(g) : 0;
  var wTs = w ? Number(w) : 0;
  var fresh = function(ts) { return ts > 0 && now - ts < 10000; };
  if (fresh(gTs))      document.documentElement.style.backgroundColor = '#0A0E1A';
  else if (fresh(wTs)) document.documentElement.style.backgroundColor = '#E8E2D4';
} catch (e) {}
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
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
