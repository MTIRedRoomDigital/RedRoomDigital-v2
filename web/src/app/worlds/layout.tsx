import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore AI Roleplay Worlds",
  description:
    "Discover community-built worlds for AI collaborative storytelling. From sprawling fantasy realms to sci-fi universes — find your next adventure on RedRoomDigital.",
  alternates: {
    canonical: "https://redroomdigital.com/worlds",
  },
  openGraph: {
    title: "Explore AI Roleplay Worlds | RedRoomDigital",
    description:
      "Discover community-built worlds for AI collaborative storytelling. From sprawling fantasy realms to sci-fi universes.",
    url: "https://redroomdigital.com/worlds",
  },
};

export default function WorldsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
