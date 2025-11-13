'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';

/**
 * Navbar Component
 * 
 * Renders the main navigation bar for the application. The navbar changes appearance
 * based on scroll position and current page.
 * 
 * Features:
 * - Transparent background when at top of page, white background when scrolled
 * - Different logo colors based on scroll position and current page
 * - Responsive design (hidden on mobile, visible on desktop)
 * - Navigation links with conditional styling
 */
const Navbar = () => {
  // Track if user has scrolled down the page
  const [isScrolled, setIsScrolled] = useState(false);
  // Control mobile menu visibility
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  // Pages that should keep the navbar in light mode even at the top
  const lightRoutes = ['/contato', '/equipe', '/institucional', '/servicos'];
  const isStaticLightPage = lightRoutes.includes(pathname);

  // Helper to know if nav is in "light" mode
  const isLight = isScrolled || isStaticLightPage || menuOpen;

  // Detect page scroll and update state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navBg = isLight
    ? 'bg-white/90 backdrop-blur-sm shadow-md'
    : 'bg-transparent';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${navBg}`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo - changes color based on scroll position and page */}
          <Link href="/" className="flex items-center">
            <div className={`relative w-32 h-12 transition-opacity duration-300 ${
              isLight ? 'opacity-100' : 'opacity-0'
            }`}>
              <Image
                src={isLight ? "/images/up-logo-blue.png" : "/images/up-logo-white.png"}
                alt="UP Carteiras Administradas"
                fill
                className="object-contain"
              />
            </div>
          </Link>

          {/* Navigation Menu - Desktop only (hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Início
            </Link>
            <Link
              href="/equipe"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Equipe
            </Link>
            <Link
              href="/institucional"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Institucional
            </Link>
            <Link
              href="/servicos"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Nossos serviços
            </Link>
            <Link
              href="/contato"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Contato
            </Link>
            <Link
              href="/login"
              className={`transition-colors ${
                isLight ? 'text-gray-900 hover:text-cyan-500' : 'text-white hover:text-gray-200'
              }`}
            >
              Login
            </Link>
            <a
              href="https://wa.me/5543991811304"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-6 py-2 rounded-md transition-colors ${
                isLight ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-white text-gray-900 hover:bg-gray-100'
              }`}
            >
              Entre em contato
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? (
              <XMarkIcon className={`w-6 h-6 ${isLight ? 'text-gray-900' : 'text-white'}`} />
            ) : (
              <Bars3Icon className={`w-6 h-6 ${isLight ? 'text-gray-900' : 'text-white'}`} />
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`md:hidden transition-max-h duration-500 overflow-hidden ${
            menuOpen ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="flex flex-col space-y-4 py-4">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Início
            </Link>
            <Link
              href="/equipe"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Equipe
            </Link>
            <Link
              href="/institucional"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Institucional
            </Link>
            <Link
              href="/servicos"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Nossos serviços
            </Link>
            <Link
              href="/contato"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Contato
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className={`px-4 ${isLight ? 'text-gray-900' : 'text-white'}`}
            >
              Login
            </Link>
            <a
              href="https://wa.me/5543991811304"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-4 px-4 py-2 rounded-md bg-cyan-500 text-white text-center"
            >
              Entre em contato
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 