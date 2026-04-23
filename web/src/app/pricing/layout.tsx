import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans",
  description:
    "Free, Premium ($9.99/mo), and Ultimate ($19.99/mo) plans for RedRoomDigital. Unlock unlimited characters, world creation, AI roleplay, and an ad-free experience.",
  alternates: {
    canonical: "https://redroomdigital.com/pricing",
  },
  openGraph: {
    title: "Pricing Plans | RedRoomDigital",
    description:
      "Choose your RedRoomDigital plan. Free forever, or upgrade to Premium or Ultimate for unlimited AI roleplay, world building, and more.",
    url: "https://redroomdigital.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
