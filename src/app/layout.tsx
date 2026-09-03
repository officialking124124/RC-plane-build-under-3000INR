import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Locus — Agentic Geolocation Intelligence",
  description:
    "Pinpoint where any photo was taken. Multi-agent reasoning, EXIF forensics, and transparent evidence — self-hosted geolocation intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05070d] text-slate-200 antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
