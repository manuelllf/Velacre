import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE = "Velacre · Reply to your Google reviews with AI";
const DESCRIPTION =
  "The Spanish SaaS that answers the Google reviews of your restaurant, bar or hotel with AI in your own tone. Spots what's breaking before your customers notice. Free to try, no credit card.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/en",
    languages: {
      "es-ES": "/es",
      "gl-ES": "/gal",
      "en-US": "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: "/en",
    siteName: "Velacre",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    alternateLocale: ["es_ES", "gl_ES"],
    images: [{ url: "/icons/og-image-1200x630.png", width: 1200, height: 630, alt: "Velacre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/icons/og-image-1200x630.png"],
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
