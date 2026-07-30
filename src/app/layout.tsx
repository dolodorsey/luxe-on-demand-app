import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXE On Demand — Premium Beauty & Cosmetic Services",
  description:
    "Book elite stylists for hair, nails, lashes, makeup, skincare, massage, waxing and barber services — on-demand or scheduled. Mobile or in-studio.",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "LUXE On Demand",
    description: "Premium beauty services at your fingertips.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAF7F4",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell pb-safe">{children}</div>
      </body>
    </html>
  );
}