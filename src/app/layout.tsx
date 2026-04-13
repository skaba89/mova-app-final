import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/mova/theme-provider";
import { TrackingProvider } from "@/components/mova/tracking-provider";
import { SafetyOverlay } from "@/components/mova/safety-overlay";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MOVA — Super-App Mobilité Africaine | Conakry, Guinée",
  description:
    "MOVA est la super-app de mobilité et services à la demande pour Conakry et l'Afrique de l'Ouest. VTC, moto-taxi, livraison, covoiturage, transport entreprise. Cash, mobile money, carte.",
  keywords: [
    "MOVA", "Conakry", "Guinée", "Afrique", "mobilité", "VTC", "moto-taxi",
    "livraison", "covoiturage", "transport entreprise", "mobile money", "super-app",
  ],
  authors: [{ name: "MOVA Technologies" }],
  openGraph: {
    title: "MOVA — L'Afrique, en mouvement",
    description: "La super-app de mobilité et services à la demande pour l'Afrique. VTC, livraison, covoiturage, enterprise.",
    type: "website",
    locale: "fr_GN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="MOVA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MOVA" />
        <meta name="description" content="MOVA — La super-app de mobilité pour Conakry, Guinée" />
        <meta name="theme-color" content="#059669" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta property="og:image" content="/mova-logo.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:alt" content="MOVA - Super-App Mobilite Africaine" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="MOVA — Super-App Mobilite Africaine" />
        <meta name="twitter:description" content="VTC, livraison, paiement mobile et plus — tout dans une seule app a Conakry, Guinee" />
        <meta name="twitter:image" content="/mova-logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TrackingProvider>
            {children}
          </TrackingProvider>
          <SafetyOverlay />
        </ThemeProvider>
        <Toaster position="top-right" richColors />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
