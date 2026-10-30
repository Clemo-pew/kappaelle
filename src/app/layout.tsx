import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";

export const metadata: Metadata = {
  title: "Kappaelle — Gestionale task",
  description: "Gestionale task del team",
  applicationName: "Kappaelle",
  appleWebApp: {
    capable: true,
    title: "Kappaelle",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
