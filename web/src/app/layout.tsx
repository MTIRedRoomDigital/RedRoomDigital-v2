import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ChatTabs } from "@/components/ChatTabs";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://redroomdigital.com"),
  title: {
    default: "RedRoomDigital — AI Roleplay Platform for Character Creation & World Building",
    template: "%s | RedRoomDigital",
  },
  description:
    "The AI roleplay platform where characters remember everything. Create deep characters, build immersive worlds, and collaborate on epic stories with persistent AI memory.",
  openGraph: {
    type: "website",
    siteName: "RedRoomDigital",
    url: "https://redroomdigital.com",
    title: "RedRoomDigital — AI Roleplay Platform",
    description:
      "Create characters, build worlds, and roleplay with AI that actually remembers. Persistent memory. Deep canon. Stay in kayfabe.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "RedRoomDigital — AI Roleplay Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RedRoomDigital — AI Roleplay Platform",
    description:
      "Create characters, build worlds, and roleplay with AI that actually remembers.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  other: {
    "facebook-domain-verification": "3jcxim011wofyc80ixl6z21o8i73q6",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "RedRoomDigital",
  url: "https://redroomdigital.com",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://redroomdigital.com/explore?search={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RedRoomDigital",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  url: "https://redroomdigital.com",
  description:
    "AI-powered roleplaying platform for character creation, world building, and collaborative storytelling with persistent AI memory.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "19.99",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <ChatTabs />
        </AuthProvider>
      </body>
    </html>
  );
}
