import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Neon | Run your tuition centre from one place",
    template: "%s | Neon",
  },
  description:
    "Student records, attendance, timetables, learning materials, quizzes and fees for tuition centres in Botswana. Works on weak connections.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://neon.example.com"),
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Neon | Run your tuition centre from one place",
    description:
      "Student records, attendance, timetables, learning materials, quizzes and fees for tuition centres in Botswana.",
    siteName: "Neon",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Neon: tuition centre management",
      },
    ],
    locale: "en_BW",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b17" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
