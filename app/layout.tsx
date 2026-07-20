import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Blockline — Professional Tetris";
const description = "A polished, responsive Tetris experience with seven-bag pieces, hold, ghost placement, combos, and tournament-grade controls.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const requestedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = /^[a-z0-9.:-]+$/i.test(requestedHost) ? requestedHost : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.startsWith("localhost")
      ? "http"
      : "https";
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title,
    description,
    applicationName: "Blockline",
    keywords: ["Tetris", "block game", "arcade", "puzzle game"],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: "Blockline",
      title,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Blockline tournament-grade falling-block game" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#070a0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
