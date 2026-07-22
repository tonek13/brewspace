import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider } from "@/features/authentication/session-context";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "BrewSpace — reserve your workspace café spot",
  description:
    "Book a table, desk, or lounge seat at your favourite coffee-shop workspace. See the room in 3D, hold a seat, order at the table.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
