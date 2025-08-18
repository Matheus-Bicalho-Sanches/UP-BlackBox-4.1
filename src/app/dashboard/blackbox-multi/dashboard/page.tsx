export default function BlackBoxMultiDashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl text-white font-semibold">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-gray-400">Status</div>
          <div className="text-white text-2xl font-bold">OK</div>
        </div>
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-gray-400">Ativos Assinados</div>
          <div className="text-white text-2xl font-bold">-</div>
        </div>
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="text-gray-400">Ordens Hoje</div>
          <div className="text-white text-2xl font-bold">-</div>
        </div>
      </div>
    </div>
  );
}


