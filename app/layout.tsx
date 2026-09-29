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
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  const isPublicRoute = pathname === '/leads-form' || pathname === '/login';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublicRoute && !hasRedirected) {
      setHasRedirected(true);
      router.replace(`/login?from=${pathname}`);
    }
  }, [isAuthenticated, isLoading, pathname, isPublicRoute, hasRedirected, router]);

  if (isLoading && !isPublicRoute) {
    return (
      <html lang="en">
        <body className="font-sans antialiased" />
      </html>
    );
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





