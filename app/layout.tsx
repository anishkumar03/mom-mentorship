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
  const [isChecking, setIsChecking] = useState(true);

  const isPublicRoute = pathname === '/leads-form' || pathname === '/login';

  useEffect(() => {
    setIsChecking(true);

    if (!isAuthenticated && !isPublicRoute) {
      router.replace(`/login?from=${pathname}`);
      return;
    }

    setIsChecking(false);
  }, [isAuthenticated, pathname, isPublicRoute, router]);

  if (isChecking && !isPublicRoute) {
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





