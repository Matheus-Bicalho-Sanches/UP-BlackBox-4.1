'use client';

import Image from 'next/image';

export type TeamCardProps = {
  name: string;
  role: string;
  area: string;
  bio: string;
  badges?: string[];
  imageUrl?: string;
  location?: string;
  tenure?: string;
  highlight?: boolean;
};

export const TeamCard = ({
  name,
  role,
  area,
  bio,
  badges = [],
  imageUrl,
  location,
  tenure,
  highlight = false,
}: TeamCardProps) => {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${
        highlight ? 'border-cyan-500 shadow-xl' : 'border-slate-200 shadow-md'
      } bg-white/90 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1`}
    >
      {imageUrl && (
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt={`Retrato de ${name}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            priority={highlight}
          />
        </div>
      )}
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">{area}</p>
          <h3 className="text-xl font-semibold text-gray-900">{name}</h3>
          <p className="text-sm font-medium text-gray-600">{role}</p>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">{bio}</p>
        {(location || tenure) && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {location && (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-gray-600">
                {location}
              </span>
            )}
            {tenure && (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-gray-600">
                {tenure}
              </span>
            )}
          </div>
        )}
        {badges.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <li
                key={`${name}-${badge}`}
                className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700"
              >
                {badge}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
};

export default TeamCard;

