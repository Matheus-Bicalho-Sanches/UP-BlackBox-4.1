"use client";
import { useState } from "react";

export default function MotionTrackerPage() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-xl text-white font-semibold">Motion Tracker</h2>
      
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg text-gray-300 mb-4">Rastreador de Movimentos</h3>
        <p className="text-gray-400 mb-6">
          Esta funcionalidade está em desenvolvimento. Em breve você poderá rastrear movimentos de mercado em tempo real.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-700 p-4 rounded border border-gray-600">
            <h4 className="text-cyan-400 font-medium mb-2">Funcionalidades Planejadas</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Detecção de padrões de movimento</li>
              <li>• Alertas de volatilidade</li>
              <li>• Análise de momentum</li>
              <li>• Rastreamento de tendências</li>
            </ul>
          </div>
          
          <div className="bg-gray-700 p-4 rounded border border-gray-600">
            <h4 className="text-cyan-400 font-medium mb-2">Status do Sistema</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-300 text-sm">Em desenvolvimento</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span className="text-gray-300 text-sm">Backend: Pendente</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span className="text-gray-300 text-sm">Frontend: Pendente</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 p-4 rounded border border-gray-600">
            <h4 className="text-cyan-400 font-medium mb-2">Próximos Passos</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Definição de requisitos</li>
              <li>• Desenvolvimento da API</li>
              <li>• Implementação da interface</li>
              <li>• Testes e validação</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
