'use client'

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * ProtectedRoute Component
 * 
 * A security wrapper component that controls access to protected pages.
 * If a user is not authenticated, they will be redirected to the login page.
 * 
 * Features:
 * - Authentication check using AuthContext
 * - Automatic redirection to login for unauthenticated users
 * - Loading spinner display during authentication check
 * - Allows access to children components only for authenticated users
 * 
 * @param children - The child components to render if the user is authenticated
 * @returns The protected content or a loading indicator
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login if user is not authenticated and not already on the login page
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  // Show loading spinner while checking authentication status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Render children only if authentication check has completed
  return <>{children}</>;
} 