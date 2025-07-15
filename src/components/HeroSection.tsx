import Image from 'next/image';

const HeroSection = () => {
  return (
    <div className="relative min-h-screen">
      {/* Background Video/Image Container */}
      <div className="absolute inset-0 z-0">
        {/* Imagem de Fundo */}
        <Image
          src="/images/hero-background.jpg"
          alt="Background"
          fill
          priority
          className="object-cover"
          sizes="100vw"
          quality={85}
        />

        {/* Gradiente sobre a imagem para melhorar contraste */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 to-gray-800/80" />
      </div>

      {/* Overlay com gradiente para melhorar legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 z-10"></div>

      {/* Container principal */}
      <div className="relative z-20 container mx-auto px-4 py-20 sm:py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-0.5 flex justify-center">
            <div className="relative w-[250px] h-[250px]">
              <Image
                src="/images/up-logo-white.png"
                alt="UP Carteiras Administradas"
                fill
                className="object-contain"
                priority
                sizes="(max-width: 768px) 200px, 300px"
                quality={90}
              />
            </div>
          </div>

          {/* Título principal */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Carteiras Administradas
          </h1>

          {/* Subtítulo */}
          <p className="text-lg sm:text-xl md:text-xl text-gray-300 mb-8 leading-relaxed">
            Gestão profissional de investimentos. Invista com segurança e comodidade.
          </p>

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5543991811304"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition duration-300 transform hover:scale-105"
            >
              Entre em contato conosco
            </a>
            <a
              href="https://www.instagram.com/up_carteiras_administradas/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-transparent border-2 border-white text-white hover:bg-white/10 rounded-lg font-semibold transition duration-300 transform hover:scale-105"
            >
              Conheça nosso Instagram
            </a>
          </div>

          {/* Indicadores de credibilidade */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">+20</div>
              <div className="text-gray-400">Famílias Atendidas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">R$ 20M+</div>
              <div className="text-gray-400">Sob Gestão</div>
            </div>
            <div className="text-center md:col-span-1 col-span-2">
              <div className="text-3xl font-bold text-white">10 Anos</div>
              <div className="text-gray-400">de Experiência</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection; 