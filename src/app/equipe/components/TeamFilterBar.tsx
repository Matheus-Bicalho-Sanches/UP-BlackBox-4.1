'use client';

type TeamFilterBarProps = {
  areas: string[];
  selectedArea: string;
  onSelect: (area: string) => void;
};

export const ALL_AREAS_OPTION = 'Todos os times';

export const TeamFilterBar = ({ areas, selectedArea, onSelect }: TeamFilterBarProps) => {
  const options = [ALL_AREAS_OPTION, ...areas];

  return (
    <div className="flex items-center justify-center">
      <div
        role="tablist"
        aria-label="Filtrar integrantes por área"
        className="flex w-full max-w-3xl gap-3 overflow-x-auto rounded-full border border-slate-200 bg-white p-2 shadow-md"
      >
        {options.map((area) => {
          const isSelected = selectedArea === area;
          return (
            <button
              key={area}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelect(area)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition ${
                isSelected
                  ? 'bg-cyan-500 text-white shadow'
                  : 'text-gray-600 hover:bg-slate-100 focus:bg-slate-100'
              }`}
            >
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TeamFilterBar;

