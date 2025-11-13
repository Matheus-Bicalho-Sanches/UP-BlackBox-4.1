import PageTemplate from '../(public)/components/PageTemplate';

export default function ContatoPage() {
  return (
    <PageTemplate
      title="Fale Conosco"
      subtitle="Estamos prontos para entender seus objetivos e apresentar a melhor solução de investimento."
    >
      <p className="text-base md:text-lg text-gray-500">
        Enquanto finalizamos o novo canal de atendimento, utilize os botões de contato para conversar com nossa equipe e
        receber mais informações.
      </p>
    </PageTemplate>
  );
}

