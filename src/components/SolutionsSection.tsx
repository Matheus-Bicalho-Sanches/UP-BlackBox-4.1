import GenerativeCanvas from '@/components/GenerativeCanvas';

export default function SolutionsSection() {
  return (
    <section className="relative py-24 bg-gray-900 overflow-hidden">
      {/* Sketch de fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <GenerativeCanvas className="w-full max-w-none scale-150" />
      </div>

      {/* Conteúdo textual */}
      <div className="relative container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
          Gestão completa de portfólio:<br />
          Renda fixa, ações, FIIs, ativos internacionais e fundos
        </h2>
        <p className="max-w-3xl mx-auto text-base md:text-lg text-gray-300">
          Valores a partir de 30 mil reais. Corretoras XP/BTG. Entre em contato!
        </p>

        {/* Botão CTA */}
        <div className="mt-10 text-center">
          <a
            href="https://wa.me/5543991811304"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-lg transition duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            Agende uma reunião
          </a>
        </div>
      </div>
    </section>
  );
} 