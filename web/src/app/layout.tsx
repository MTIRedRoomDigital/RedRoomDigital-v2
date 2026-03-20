import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ChatTabs } from "@/components/ChatTabs";

export const metadata: Metadata = {
  title: "RedRoomDigital - Character Creation & Roleplaying Platform",
  description: "Create characters, build worlds, and roleplay with AI-powered storytelling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
