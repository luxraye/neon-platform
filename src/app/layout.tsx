import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
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
  title: "Neon | Tuition Management Platform",
  description:
    "The most reliable student management and LMS for tuition centres in Botswana, featuring offline NLM sync.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://neon.example.com"),
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Neon | Tuition Management Platform",
    description:
      "The most reliable student management and LMS for tuition centres in Botswana, featuring offline NLM sync.",
    url: "https://neon.example.com",
    siteName: "Neon",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Neon — Operating System for Tuition Centres",
      },
    ],
    locale: "en_BW",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
