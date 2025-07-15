'use client'

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    router.push('/logout');
  };

  return (
    <header className="sticky top-0 z-40 bg-gray-800 border-b border-gray-700">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Nome do usuário */}
        <div className="flex items-center">
          <h2 className="text-xl font-semibold text-white">
            Bem-vindo(a), {user?.email?.split('@')[0]}
          </h2>
        </div>

        {/* Botão de Sair */}
        <button
          onClick={handleLogout}
          className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
        >
          Sair
        </button>
      </div>
    </header>
  );
} 