'use client'

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TasksPage() {
  const router = useRouter();

  // Redirecionar para a primeira subpágina quando esta página for carregada
  useEffect(() => {
    router.push('/dashboard/tasks/naorecorrente');
  }, [router]);

  return null; // Esta página não renderiza conteúdo, apenas redireciona
} 