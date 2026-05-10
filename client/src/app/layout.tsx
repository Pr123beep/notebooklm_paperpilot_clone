import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperPilot — Navigate your documents with AI",
  description:
    "PaperPilot is an AI research notebook. Upload PDFs and notes, then ask grounded questions answered only from your sources.",
  applicationName: "PaperPilot",
  authors: [{ name: "PaperPilot" }],
  keywords: [
    "PaperPilot",
    "RAG",
    "PDF chat",
    "AI notebook",
    "document Q&A",
    "research assistant",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
