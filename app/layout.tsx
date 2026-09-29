'use client'

import Nav from "./components/Nav";
import BottomTabs from "./components/BottomTabs";
import "./globals.css";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname()
  const isPublic = pathname?.includes('/leads-form')

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {!isPublic && <Nav />}
        {children}
      </body>
    </html>
  );
}





