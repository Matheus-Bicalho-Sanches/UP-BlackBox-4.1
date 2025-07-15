import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import ClientLayout from '@/components/ClientLayout'

/**
 * Root Layout Component
 * 
 * This is the main layout component for the entire application.
 * It sets up:
 * - Font configuration
 * - Authentication context
 * - Client-side layout wrapper
 * - Global metadata for SEO
 */

// Load the Inter font from Google Fonts with Latin character subset
const inter = Inter({ subsets: ['latin'] })

/**
 * Application Metadata
 * 
 * Defines global metadata for the application, including:
 * - Basic page metadata (title, description)
 * - Open Graph metadata for social media sharing
 * - Twitter card metadata
 * - Favicon and icons
 * - SEO settings including robots configuration
 * - Site verification codes
 */
export const metadata: Metadata = {
  title: 'UP Carteiras Administradas',
  description: 'Obtenha retornos acima da média com tecnologia e Inteligência Artificial. Acesse o nosso site e saiba mais',
  metadataBase: new URL('https://www.up-gestora.com.br'),
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.up-gestora.com.br',
    siteName: 'UP Carteiras Administradas',
    title: 'UP Carteiras Administradas',
    description: 'Obtenha retornos acima da média com tecnologia e Inteligência Artificial. Acesse o nosso site e saiba mais',
    images: [
      {
        url: '/images/up-logo-blue.png',
        width: 1200,
        height: 630,
        alt: 'UP Carteiras Administradas Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UP Carteiras Administradas',
    description: 'Obtenha retornos acima da média com tecnologia e Inteligência Artificial. Acesse o nosso site e saiba mais',
    images: ['/images/up-logo-blue.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // You'll need to add your Google Search Console verification code here
  },
}

/**
 * Root Layout Component
 * 
 * The top-level layout component that wraps all pages in the application.
 * Provides authentication context and client-side layout to all child pages.
 * 
 * @param children - The page content to be rendered inside the layout
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  )
} 