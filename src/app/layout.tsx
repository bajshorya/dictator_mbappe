import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Anton, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://footy.example"),
  title: "Footy — All-Time World Cup XI Builder",
  description:
    "Draft an all-time XI from 1982–2022 World Cup legends, then simulate the tournament and try to win it all.",
  applicationName: "Footy",
  appleWebApp: { capable: true, title: "Footy", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Footy — All-Time World Cup XI Builder",
    description: "Draft an all-time World Cup XI and win the tournament.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Footy — All-Time World Cup XI Builder",
    description: "Draft an all-time World Cup XI and win the tournament.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${anton.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
