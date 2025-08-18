"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Dashboard", href: "/dashboard/blackbox-multi/dashboard" },
  { name: "MarketData", href: "/dashboard/blackbox-multi/marketdata" },
  { name: "Backtests", href: "/dashboard/blackbox-multi/backtests" },
  { name: "Estratégias", href: "/dashboard/blackbox-multi/estrategias" },
  { name: "Ordens", href: "/dashboard/blackbox-multi/ordens" },
  { name: "Posições", href: "/dashboard/blackbox-multi/posicoes" },
  { name: "Contas", href: "/dashboard/blackbox-multi/contas" },
];

export default function BlackBoxMultiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">BlackBox Multi</h1>
        <p className="text-gray-400">Execução quantitativa multi-contas</p>
      </div>
      <nav className="mb-8 border-b border-gray-700">
        <ul className="flex flex-wrap gap-4">
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


