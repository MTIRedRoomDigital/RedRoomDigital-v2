import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore AI Characters",
  description:
    "Browse thousands of AI characters created by the RedRoomDigital community. Find your perfect roleplay partner — from fantasy heroes to sci-fi villains and everything between.",
  alternates: {
    canonical: "https://redroomdigital.com/explore",
  },
  openGraph: {
    title: "Explore AI Characters | RedRoomDigital",
    description:
      "Browse thousands of AI characters created by the RedRoomDigital community. Find your perfect roleplay partner.",
    url: "https://redroomdigital.com/explore",
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
