import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Forum",
  description:
    "Join the RedRoomDigital community forum. Discuss characters, share stories, get help with world building, and connect with fellow roleplayers and storytellers.",
  alternates: {
    canonical: "https://redroomdigital.com/forum",
  },
  openGraph: {
    title: "Community Forum | RedRoomDigital",
    description:
      "Join the RedRoomDigital community forum. Discuss characters, share stories, and connect with fellow roleplayers.",
    url: "https://redroomdigital.com/forum",
  },
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
