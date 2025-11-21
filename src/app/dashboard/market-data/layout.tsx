"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Acomp. Ativos", href: "/dashboard/market-data/acompativos" },
  { name: "Estratégias Quant", href: "/dashboard/market-data/teste-2" },
  { name: "Monitor de Sinais", href: "/dashboard/market-data/teste-3" },
  { name: "Requisitar Ticks", href: "/dashboard/market-data/requisitar-ticks" },
];

export default function MarketDataLayout({
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
