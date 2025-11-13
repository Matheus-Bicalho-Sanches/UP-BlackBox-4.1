'use client';

import Image from 'next/image';

type OfficeCardProps = {
  city: string;
  address: string;
  info: string;
  mapImage: string;
  schedule: string;
};

export const OfficeCard = ({ city, address, info, mapImage, schedule }: OfficeCardProps) => {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow">
      <div className="relative h-52 w-full">
        <Image
          src={mapImage}
          alt={`Mapa do escritório em ${city}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-4 py-1 text-sm font-semibold text-gray-900 shadow">
          {city}
        </div>
      </div>
      <div className="space-y-4 p-6">
        <p className="text-sm font-semibold text-gray-900">{address}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{info}</p>
        <p className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {schedule}
        </p>
      </div>
    </article>
  );
};

export default OfficeCard;

