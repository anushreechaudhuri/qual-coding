import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qual Coding",
  description: "Open-source qualitative coding tool for multilingual fieldwork",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Qual Coding",
    description: "Open-source qualitative coding for multilingual fieldwork. Upload interviews, field notes, and documents. Code, memo, and export your analysis. Works offline.",
    images: [{ url: "/og.svg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qual Coding",
    description: "Open-source qualitative coding for multilingual fieldwork",
    images: ["/og.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
