'use client';

import DocumentCard from '../components/DocumentCard';

type Document = {
  id: string;
  category: string;
  title: string;
  description: string;
  href: string;
};

type DocumentLibraryProps = {
  documents: Document[];
};

const DocumentLibrary = ({ documents }: DocumentLibraryProps) => {
  return (
    <section id="documentos" className="bg-slate-50 py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Documentos & políticas</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Materiais regulatórios e Compliance</h2>
          <p className="text-lg text-gray-600">
            Consulte nossas políticas internas, documentos de governança, controles de risco e formulário de referência. Arquivos
            atualizados e revisados periodicamente.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          {documents.map((document) => (
            <DocumentCard key={document.id} {...document} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default DocumentLibrary;

