'use client'

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Configuration
 * 
 * This file initializes and exports the Firebase application and authentication instances.
 * Configuration values are loaded from environment variables to keep sensitive data secure.
 */

/**
 * Firebase configuration object containing API keys and project information.
 * All values are loaded from environment variables prefixed with NEXT_PUBLIC_FIREBASE_
 * to make them available on the client side.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

/**
 * Initialize Firebase only if it hasn't been initialized already and we're on the client side.
 * This prevents multiple initializations during server-side rendering and hot reloads.
 */
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * Firebase Authentication instance
 * Used throughout the application for user authentication operations.
 */
export const auth = getAuth(app);

/**
 * Export the Firebase app instance as the default export
 */
export default app;

/**
 * Firebase Storage instance
 * Used for uploading and managing files.
 */
export const storage = getStorage(app);

/**
 * Firebase Firestore instance
 * Used for storing and querying data.
 */
export const db = getFirestore(app); 