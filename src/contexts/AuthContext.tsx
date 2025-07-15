'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

/**
 * Authentication Context
 * 
 * Provides authentication state management throughout the application.
 * Utilizes Firebase Authentication to handle user sessions.
 */

/**
 * Interface defining the shape of the authentication context.
 * @property user - The current authenticated Firebase user or null if not authenticated
 * @property loading - Boolean indicating whether the authentication state is still being determined
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

/**
 * Create the authentication context with default values
 */
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

/**
 * AuthProvider Component
 * 
 * Wraps the application to provide authentication state to all child components.
 * Listens to Firebase authentication state changes and updates context accordingly.
 * 
 * @param children - Child components that will have access to the auth context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run the auth listener on the client side
    if (typeof window !== 'undefined') {
      // Subscribe to Firebase auth state changes
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });

      // Clean up subscription on unmount
      return unsubscribe;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to easily access the authentication context from any component.
 * 
 * @returns The current authentication context with user and loading state
 * @example const { user, loading } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
} 