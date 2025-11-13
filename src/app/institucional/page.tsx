import PageTemplate from '../(public)/components/PageTemplate';

export default function InstitucionalPage() {
  return (
    <PageTemplate
      title="Sobre a UP"
      subtitle="Transparência, governança e compromisso com o crescimento sustentável de cada cliente."
    >
      <p className="text-base md:text-lg text-gray-500">
        Esta página trará informações institucionais, nossa história, principais marcos e políticas internas que guiam a
        atuação da UP no mercado financeiro.
      </p>
    </PageTemplate>
  );
}

