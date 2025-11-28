'use client';

type ComparisonItem = {
  id: string;
  name: string;
  profile: string;
  horizon: string;
  minimumTicket: string;
  benchmark: string;
  governance: string;
};

type ServiceComparisonTableProps = {
  items: ComparisonItem[];
};

export const ServiceComparisonTable = ({ items }: ServiceComparisonTableProps) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
      <div className="hidden md:block">
        <table className="min-w-full table-fixed divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Serviço
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Perfil indicado
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Horizonte
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ticket mínimo
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Alvo de retorno
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Relacionamento
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="transition hover:bg-slate-50/80">
                <td className="px-6 py-5 text-sm font-semibold text-gray-900">{item.name}</td>
                <td className="px-6 py-5 text-sm text-gray-700">{item.profile}</td>
                <td className="px-6 py-5 text-sm text-gray-700">{item.horizon}</td>
                <td className="px-6 py-5 text-sm text-gray-700">{item.minimumTicket}</td>
                <td className="px-6 py-5 text-sm text-gray-700">{item.benchmark}</td>
                <td className="px-6 py-5 text-sm text-gray-700">{item.governance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <li key={item.id} className="space-y-3 px-4 py-6">
              <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
              <dl className="space-y-2 text-sm text-gray-700">
                <div>
                  <dt className="font-semibold text-slate-500">Perfil indicado</dt>
                  <dd>{item.profile}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Horizonte</dt>
                  <dd>{item.horizon}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Ticket mínimo</dt>
                  <dd>{item.minimumTicket}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Alvo de retorno</dt>
                  <dd>{item.benchmark}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Relacionamento</dt>
                  <dd>{item.governance}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ServiceComparisonTable;

