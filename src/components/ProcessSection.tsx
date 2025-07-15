'use client'

import { useState } from 'react';

/**
 * Componente ProcessSection
 * 
 * Exibe o processo de trabalho em um fluxo horizontal com cards interativos
 * que mostram informações adicionais no hover.
 */

// Definição dos dados do processo
const processSteps = [
  {
    title: 'Reunião inicial',
    description: 'Conversa sobre seu contexto financeiro atual',
    details: 'Nessa conversa entendemos o seu contexto financeiro atual, objetivos de vida e outros fatores',
    duration: null
  },
  {
    title: 'Diagnóstico',
    description: 'Feedback sobre sua situação atual',
    details: 'Entenda as nossas sugestões para otimizar seu patrimônio',
    duration: null
  },
  {
    title: 'Período de teste',
    description: 'Acompanhamento sem compromisso ou custo',
    details: 'Implementação gradual das mudanças sugeridas no diagnóstico',
    duration: null
  },
  {
    title: 'Feedback',
    description: 'Discussão sobre o período de teste',
    details: 'Feedback do cliente e negociação de valores',
    duration: null
  },
  {
    title: 'Início do serviço',
    description: 'Gestão completa do seu patrimônio',
    details: 'Relatório mensal dos resultados e acompanhamento contínuo',
    duration: null
  },
  {
    title: 'Renovação',
    description: 'Renegociação anual de termos e valores',
    details: 'Evolução do planejamento financeiro realizado e ajustes',
    duration: null
  }
];

const ProcessSection = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-20 bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Título da seção */}
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Conheça o nosso serviço
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16">
            Um processo estruturado para atender suas necessidades
          </p>

          {/* Grid do processo */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {processSteps.map((step, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Card principal */}
                <div
                  className={`h-32 rounded-lg p-4 transition-all duration-300 cursor-pointer
                    ${hoveredIndex === index 
                      ? 'bg-blue-600 transform -translate-y-2' 
                      : 'bg-blue-600/80 hover:bg-blue-600'}`}
                >
                  <h3 className="text-white font-semibold text-lg mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-200 text-sm">
                    {step.description}
                  </p>
                </div>

                {/* Informaç��es adicionais no hover */}
                {hoveredIndex === index && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white rounded-lg shadow-xl z-10">
                    <p className="text-gray-800 text-sm mb-2">
                      {step.details}
                    </p>
                    {step.duration && (
                      <p className="text-blue-600 text-xs font-semibold">
                        {step.duration}
                      </p>
                    )}
                  </div>
                )}

                {/* Linha conectora (exceto no último item) */}
                {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-0.5 bg-blue-400/50 transform -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProcessSection; 