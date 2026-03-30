import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Dylan's Roster Manager — Personal Social CRM",
  description:
    "A free, open-source personal CRM for managing relationships. Track conversations, get AI-powered reply drafts, charisma scoring, toxic meter, and relationship analytics. Installable as a PWA on iPhone and Android.",
  keywords: [
    "personal CRM",
    "social CRM",
    "relationship manager",
    "contact manager",
    "free CRM",
    "open source CRM",
    "AI CRM",
    "text tracker",
    "conversation tracker",
    "roster manager",
    "PWA",
    "iPhone app",
  ],
  authors: [{ name: "Dylan Iskander" }],
  openGraph: {
    title: "Dylan's Roster Manager",
    description:
      "Personal social CRM with AI-powered reply drafts, charisma scoring, and relationship analytics. Free and open source.",
    type: "website",
    siteName: "Dylan's Roster Manager",
  },
  twitter: {
    card: "summary",
    title: "Dylan's Roster Manager",
    description:
      "Personal social CRM with AI-powered reply drafts, charisma scoring, and toxic meter.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Roster",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geist.variable} font-sans antialiased bg-rm-bg`}>
        {children}
      </body>
    </html>
  );
}
