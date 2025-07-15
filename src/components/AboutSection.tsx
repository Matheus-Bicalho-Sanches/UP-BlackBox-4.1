import React from 'react';
import { 
  ChartPieIcon, 
  BuildingLibraryIcon, 
  ShieldCheckIcon, 
  BanknotesIcon 
} from '@heroicons/react/24/outline';

const AboutSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho da Seção */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Excelência em Gestão de Patrimônio
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Nos dedicamos a proteger e fazer crescer o patrimônio de nossos clientes através de uma gestão profissional com custo acessível.
            </p>
          </div>

          {/* Grid de Informações */}
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            {/* Coluna da Esquerda - Texto */}
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Nossa História
                </h3>
                <p className="text-gray-600">
                  Fundada em 2024, a UP Carteiras Administradas nasceu com o propósito 
                  de democratizar o acesso à gestão profissional de investimentos.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Nosso Objetivo
                </h3>
                <p className="text-gray-600">
                  Buscamos ser a principal referência em gestão de patrimônio no Brasil, 
                  oferecendo soluções de investimento que combinam segurança, rentabilidade 
                  e tranquilidade para nossos clientes.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  Perfil dos Nossos Clientes
                </h3>
                <p className="text-gray-600">
                  Atendemos investidores que buscam uma gestão profissional de seus 
                  recursos, com patrimônio a partir de R$ 50 mil. Nosso público inclui 
                  profissionais liberais, empresários e famílias que valorizam uma 
                  abordagem personalizada e de longo prazo.
                </p>
              </div>
            </div>

            {/* Coluna da Direita - Cards com animação */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-white">
                <ChartPieIcon className="w-10 h-10 text-cyan-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Diversificação</h4>
                <p className="text-gray-600">Invista em renda fixa, renda variável, ativos internacionais e cripto.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-white">
                <BuildingLibraryIcon className="w-10 h-10 text-cyan-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Corretoras</h4>
                <p className="text-gray-600">Trabalhamos com XP e BTG, mas podemos te ajudar em outras plataformas também.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-white">
                <ShieldCheckIcon className="w-10 h-10 text-cyan-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Certificações</h4>
                <p className="text-gray-600">Gestor certificado CGA. Gestora em processo de homologação na Anbima e CVM.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-white">
                <BanknotesIcon className="w-10 h-10 text-cyan-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">Cashback</h4>
                <p className="text-gray-600">Receba de volta parte da receita que você gera para a corretora.</p>
              </div>
            </div>
          </div>

          {/* Diferenciais com animação */}
          <div className="bg-gray-50 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
              Nossos Diferenciais
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-white rounded-lg p-6">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">
                  Gestão Ativa
                </h4>
                <p className="text-gray-600">
                  Monitoramento constante do mercado e ajustes táticos para 
                  aproveitar as melhores oportunidades.
                </p>
              </div>

              <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-white rounded-lg p-6">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">
                  ZERO conflito de interesse
                </h4>
                <p className="text-gray-600">
                  Não recebemos um centavo sequer de comissão, seja em seus investimentos, 
                  seguros, câmbio ou outros produtos.
                </p>
              </div>

              <div className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:bg-white rounded-lg p-6">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">
                  Atendimento Exclusivo
                </h4>
                <p className="text-gray-600">
                  Carteira de investimentos personalizada, de acordo com seus objetivos de vida e contexto financeiro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection; 