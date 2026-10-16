import type { Metadata } from "next";
import { Geist, Geist_Mono, Lato, Merriweather } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner"
import { CompanyProvider } from "@/contexts/company-context"
import { PermissionProvider } from "@/contexts/permission-context"
import { LanguageProvider } from "@/contexts/language-context"
import { QueryProvider } from "@/components/providers/query-provider"

// All fonts self-hosted at build time via next/font — zero render-blocking
// requests, zero layout shift (automatic size-adjust fallbacks).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Document/Invoice typography (replaces the old render-blocking CSS @import)
const documentSans = Lato({
  variable: "--font-document",
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
});

const documentSerif = Merriweather({
  variable: "--font-document-serif",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  metadataBase: new URL("https://balanceio.id"),
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/images/favicon.ico", sizes: "any" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/images/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://balanceio.id",
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/android-chrome-512x512.png", // Fallback to large icon
        width: 512,
        height: 512,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/images/android-chrome-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable,
          documentSans.variable,
          documentSerif.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <CompanyProvider>
              <PermissionProvider>
                <LanguageProvider>
                  {children}
                  <Toaster />
                </LanguageProvider>
              </PermissionProvider>
            </CompanyProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
