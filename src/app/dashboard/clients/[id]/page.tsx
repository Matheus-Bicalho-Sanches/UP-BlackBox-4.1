import { Metadata } from 'next';
import { Suspense } from 'react';
import ClientProfilePageClient from './ClientProfile';

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Perfil do Cliente - UP Carteiras Administradas',
  };
}

export default function ClientProfilePage({
  params,
}: Props) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    }>
      <ClientProfilePageClient id={params.id} />
    </Suspense>
  );
} 