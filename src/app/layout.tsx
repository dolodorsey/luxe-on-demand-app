import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./luxe-marketplace.css";

export const metadata: Metadata = {
  title: "LUXE On Demand — White-Glove Beauty Marketplace",
  description:
    "Request hair, makeup, nails, lashes, skincare, bridal and beauty concierge services from vetted mobile and studio talent.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "LUXE On Demand",
    description: "Beauty, delivered beautifully. Mobile or studio appointments matched with vetted talent.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#100b0d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell pb-safe luxe-premium" data-app="luxe-on-demand">{children}</div>
      </body>
    </html>
  );
}
