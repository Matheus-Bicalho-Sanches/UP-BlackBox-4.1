'use client'

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { auth } from '@/config/firebase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        {/* Sidebar */}
        <div className={`fixed top-0 left-0 h-full bg-gray-800 text-white transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}>
          {/* Logo */}
          <div className="flex justify-center py-6">
            <div className="relative w-40 h-12">
              <Image
                src="/images/up-logo-white.png"
                alt="UP Carteiras Administradas"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-8">
            <Link
              href="/dashboard"
              title="Dashboard"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Dashboard</span>}
            </Link>

            {/* Backtests */}
            <Link
              href="/dashboard/backtests"
              title="Backtests"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">B</text>
              </svg>
              {isSidebarOpen && <span className="ml-3">Backtests</span>}
            </Link>

            {/* UP BlackBox 4.0 */}
            <Link
              href="/dashboard/up-blackbox4"
              title="UP BlackBox 4.0"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">4.0</text>
              </svg>
              {isSidebarOpen && <span className="ml-3">UP BlackBox 4.0</span>}
            </Link>

            {/* Market data */}
            <Link
              href="/dashboard/market-data"
              title="Market data"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              {/* Ícone de gráfico de barras */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17h4v3H4zM10 13h4v7h-4zM16 9h4v11h-4z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Market data</span>}
            </Link>

            {/* BlackBox Multi */}
            <Link
              href="/dashboard/blackbox-multi"
              title="BlackBox Multi"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m4 0V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10" />
              </svg>
              {isSidebarOpen && <span className="ml-3">BlackBox Multi</span>}
            </Link>

            {/* AI Lab */}
            <Link
              href="/dashboard/ai-lab"
              title="AI Lab"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">AI Lab</span>}
            </Link>

            <Link
              href="/dashboard/clients"
              title="Clientes"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Clientes</span>}
            </Link>

            {/* Marketing */}
            <Link
              href="/dashboard/marketing"
              title="Marketing"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Marketing</span>}
            </Link>

            <Link
              href="/dashboard/crm"
              title="CRM"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">CRM</span>}
            </Link>

            <Link
              href="/dashboard/allocation"
              title="Alocação"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Alocação</span>}
            </Link>

            <Link
              href="/dashboard/rebalanceamento"
              title="Rebalanceamento"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8l3 4m0 0l3-4m-3 4V3m6 9a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Rebalanceamento</span>}
            </Link>

            <Link
              href="/dashboard/tasks"
              title="Tarefas"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Tarefas</span>}
            </Link>

            <Link
              href="/dashboard/contracts"
              title="Contratos"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Contratos</span>}
            </Link>

            <Link
              href="/dashboard/payments"
              title="Pagamentos"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Pagamentos</span>}
            </Link>

            <Link
              href="/dashboard/whatsapp"
              title="WhatsApp"
              className="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 448 512" fill="currentColor">
                <path d="M380.9 97.1C339-13 200.1-31.5 112.4 56.3 58 110.8 41.5 193.8 71.3 261l-31 113.2 116.1-30.4c65.7 35.9 146.7 37.3 212.4 1 91.5-50.1 127.7-167.9 86.7-248.7zM293.7 339.9c-36.4 4.2-89.8-8.5-150.7-69.3S74.5 177.1 78.8 140.5c3.2-27.4 39-44.1 53.5-49.3 13.7-4.9 30-6.5 44.2 11.4l19.2 27.8c5.9 8.5 5.2 19.9-1.7 28.2l-14 17.1c-8.1 9.9-9.2 24.2-2.5 35.2 10.2 16.9 33 41.7 55.9 57.8s45.1 27.2 62.2 32.7c11.9 3.8 25 1.1 33.6-7.3l15.5-15.1c8.3-8.1 20.7-9 29.7-1.5l27.1 22.8c15 12.8 17.2 29.6 14 43.3-3.3 13.7-15.6 38.4-52.8 43.9z" />
              </svg>
              {isSidebarOpen && <span className="ml-3">WhatsApp</span>}
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              title="Sair"
              className="w-full flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white mt-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {isSidebarOpen && <span className="ml-3">Sair</span>}
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
          {/* Top Bar */}
          <div className="bg-gray-800 p-4 flex justify-between items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-white hover:text-cyan-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-white">
              {user?.email}
            </div>
          </div>

          {/* Page Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 