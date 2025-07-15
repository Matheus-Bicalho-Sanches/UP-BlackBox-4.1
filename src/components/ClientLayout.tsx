'use client'

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';

/**
 * ClientLayout Component
 * 
 * A client-side layout wrapper that conditionally renders the navigation bar
 * based on the current path. The navbar is only shown on public pages and hidden
 * on authentication and dashboard pages.
 * 
 * Features:
 * - Conditional Navbar rendering based on current route
 * - Client-side path detection using Next.js navigation hooks
 * - Preserves child component rendering in all cases
 * 
 * @param children - The child components to be rendered inside this layout
 * @returns The wrapped content with or without the navbar
 */
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current path to determine if we're on an auth page
  const pathname = usePathname();
  
  // Pages that should not display the public navbar
  const isAuthPage = pathname?.startsWith('/dashboard') || pathname === '/login';

  return (
    <>
      {/* Only render the Navbar on public pages */}
      {!isAuthPage && <Navbar />}
      {children}
    </>
  );
} 