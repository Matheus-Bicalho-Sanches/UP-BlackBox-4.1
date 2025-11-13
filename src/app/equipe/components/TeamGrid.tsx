'use client';

import { TeamCard, TeamCardProps } from './TeamCard';

type TeamGridProps = {
  members: TeamCardProps[];
  highlightFirst?: boolean;
};

export const TeamGrid = ({ members, highlightFirst = false }: TeamGridProps) => {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {members.map((member, index) => (
        <TeamCard key={member.name} {...member} highlight={highlightFirst && index === 0} />
      ))}
    </div>
  );
};

export default TeamGrid;

