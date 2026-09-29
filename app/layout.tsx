'use client';

import Nav from "./components/Nav";
import "./globals.css";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function RootLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [canRender, setCanRender] = useState(false);

  const isPublicRoute = pathname === '/leads-form' || pathname === '/login';

  useEffect(() => {
    if (!isAuthenticated && !isPublicRoute) {
      router.push(`/login?from=${pathname}`);
    } else {
      setCanRender(true);
    }
  }, [isAuthenticated, pathname, isPublicRoute, router]);

  if (!canRender && !isPublicRoute) {
    return null;
  }

  const hideNav = pathname === '/leads-form' || pathname === '/login';

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {!hideNav && <Nav />}
        {children}
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <RootLayoutContent>{children}</RootLayoutContent>
    </AuthProvider>
  );
}





