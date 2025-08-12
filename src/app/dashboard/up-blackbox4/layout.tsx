"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * UP BlackBox 4.0 - Sistema de Gestão de Carteiras
 * 
 * ARQUITETURA:
 * - A gestora trabalha com gestão "manual" de carteiras e estratégias automatizadas
 * - Carteiras atuais: UP BlackBox FIIs (manual) e UP BlackBox Multi (manual → automatizada)
 * - "MASTER" é uma abstração para consolidar dados de clientes por estratégia
 * - Não há contas Master reais, apenas consolidação de dados
 * 
 * SEGURANÇA:
 * - Autenticação via /login (apenas colaboradores da empresa)
 * - Todos os usuários têm o mesmo nível de permissão
 * - Sistema já em produção - não usar fallbacks fictícios
 */

const tabs = [
  { name: "Login", href: "/dashboard/up-blackbox4/login" },
  { name: "Posições", href: "/dashboard/up-blackbox4/posicoes" },
  { name: "Ordens", href: "/dashboard/up-blackbox4/ordens" },
  { name: "Boletas", href: "/dashboard/up-blackbox4/boletas" },
  { name: "Sync", href: "/dashboard/up-blackbox4/sync" },
  { name: "Saldo", href: "/dashboard/up-blackbox4/saldo" },
  { name: "Estratégias", href: "/dashboard/up-blackbox4/estrategias" },
  { name: "Contas", href: "/dashboard/up-blackbox4/contas" },
  { name: "Logs", href: "/dashboard/up-blackbox4/logs" },
];

export default function UpBlackbox4Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8">
      <nav className="mb-8 border-b border-gray-700">
        <ul className="flex space-x-8">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`pb-3 px-1 border-b-2 text-lg font-medium transition-colors duration-200 ${
                  pathname === tab.href
                    ? "border-cyan-500 text-cyan-500"
                    : "border-transparent text-gray-300 hover:text-white hover:border-gray-400"
                }`}
              >
                {tab.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
} 