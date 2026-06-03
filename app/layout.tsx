import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlbumsProvider } from "@/app/components/albums-provider";
import { AuthProvider } from "@/app/components/auth-provider";
import { ChatWidget } from "@/app/components/chat-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "Album Atlas",
  description: "Discover, rate, and catalog music albums.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-100 text-zinc-700 antialiased">
        <AuthProvider>
          <AlbumsProvider>{children}</AlbumsProvider>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
