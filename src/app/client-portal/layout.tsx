'use client'

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  HomeIcon, 
  WalletIcon, 
  BanknotesIcon, 
  ChartBarIcon,
  DocumentTextIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Header from './components/Header';

const menuItems = [
  {
    name: 'Início',
    href: '/client-portal/dashboard',
    icon: HomeIcon
  },
  {
    name: 'Carteira',
    href: '/client-portal/dashboard/portfolio',
    icon: WalletIcon
  },
  {
    name: 'Pagamentos',
    href: '/client-portal/dashboard/payments',
    icon: BanknotesIcon
  },
  {
    name: 'Retorno',
    href: '/client-portal/dashboard/performance',
    icon: ChartBarIcon
  },
  {
    name: 'Relatórios',
    href: '/client-portal/dashboard/reports',
    icon: DocumentTextIcon
  },
  {
    name: 'Perfil',
    href: '/client-portal/dashboard/profile',
    icon: UserIcon
  }
];

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-gray-800 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo and toggle button */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-700">
          <div className={collapsed ? 'w-0 opacity-0' : 'relative w-32 h-8'}>
            <Image
              src="/images/up-logo-white.png"
              alt="UP Carteiras Administradas"
              fill
              sizes="(max-width: 768px) 100vw, 128px"
              priority
              className="object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <Bars3Icon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon
                  className={`h-6 w-6 flex-shrink-0 ${
                    isActive ? 'text-cyan-500' : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`ml-3 ${
                    collapsed ? 'hidden' : 'block'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          collapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        {/* Novo Header */}
        <Header />

        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 