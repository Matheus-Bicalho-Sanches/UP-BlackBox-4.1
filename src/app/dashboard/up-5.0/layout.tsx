"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Profit UP", href: "/dashboard/up-5.0/profit-up" },
  { name: "Posições", href: "/dashboard/up-5.0/posicoes" },
  { name: "Estratégias", href: "/dashboard/up-5.0/estrategias" },
  { name: "Ordens", href: "/dashboard/up-5.0/ordens" },
  { name: "Caixa", href: "/dashboard/up-5.0/caixa" },
  { name: "Boleta", href: "/dashboard/up-5.0/boleta" },
  { name: "Backtest", href: "/dashboard/up-5.0/backtest" },
  { name: "Acompanhamento", href: "/dashboard/up-5.0/acompanhamento" },
  { name: "Logs", href: "/dashboard/up-5.0/logs" },
];

export default function Up50Layout({
  children,
}: {
  children: React.ReactNode;
}) {
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

