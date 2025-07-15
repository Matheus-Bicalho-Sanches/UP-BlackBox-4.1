import React from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const ComparisonSection = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Vantagens da Carteira Administrada
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Carteiras Administradas */}
            <div className="bg-white rounded-lg p-6 shadow-lg border-2 border-cyan-500 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <h3 className="text-xl font-bold text-cyan-600 mb-6">
                Carteiras Administradas
              </h3>
              <ul className="space-y-4">
                {[
                  'ZERO conflito de interesse',
                  'Agilidade na execução das operações',
                  'Decisões técnicas sem influência emocional',
                  'Monitoramento constante do portfólio',
                  'Rebalanceamentos sempre que necessário',
                  'Maior eficiência tributária',
                  'Gestão profissional dedicada e especializada',
                  'Receba as comissões que seu assessor receberia'
                ].map((item, index) => (
                  <li key={index} className="flex items-start group transition-all duration-300 hover:bg-cyan-50/50 p-2 rounded-lg">
                    <CheckCircleIcon className="w-6 h-6 text-cyan-500 flex-shrink-0 mr-2 transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Assessoria de Investimentos */}
            <div className="bg-white rounded-lg p-6 shadow-lg border-2 border-gray-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <h3 className="text-xl font-bold text-gray-600 mb-6">
                Assessoria de Investimentos
              </h3>
              <ul className="space-y-4">
                {[
                  'Recomendações baseadas no que gera mais comissão',
                  'Dependência da aprovação do cliente para cada operação',
                  'Influência emocional nas decisões de investimento',
                  'Acompanhamento não sistemático da carteira',
                  'Rebalanceamentos manuais e não padronizados',
                  'Menor eficiência na gestão tributária',
                  'Processo de investimento não estruturado',
                  'Processo decisório mais lento e burocrático'
                ].map((item, index) => (
                  <li key={index} className="flex items-start group transition-all duration-300 hover:bg-red-50/50 p-2 rounded-lg">
                    <XCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mr-2 transition-transform duration-300 group-hover:scale-110" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection; 