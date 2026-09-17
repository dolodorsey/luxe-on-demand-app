import type { Metadata, Viewport } from "next";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import "./globals.css";
import "./luxe-marketplace.css";

export const metadata: Metadata = {
  title: "LUXE On Demand — Premium Mobility",
  description:
    "Request premium black-car, SUV, airport and executive transportation from the verified LUXE driver network.",
  applicationName: "LUXE On Demand",
  appleWebApp: { capable: true, title: "LUXE", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/luxe-app-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/luxe-app-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "LUXE On Demand — Premium Mobility",
    description: "Private rides, airport movement and executive transportation from one verified premium network.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LUXE On Demand — Premium Mobility",
    description: "Your city. Your driver. Your standard.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080b10",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell pb-safe luxe-premium" data-app="luxe-mobility">{children}</div>
        <InstallAppPrompt />
      </body>
    </html>
  );
}
