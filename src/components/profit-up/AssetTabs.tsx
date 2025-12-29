"use client";

import { Asset } from "@/lib/profit-up/mockData";

interface AssetTabsProps {
  assets: Asset[];
  activeAsset: Asset | null;
  onAssetSelect: (asset: Asset) => void;
}

export default function AssetTabs({ assets, activeAsset, onAssetSelect }: AssetTabsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-2 mb-4">
      <div className="flex space-x-2 overflow-x-auto">
        {assets.map((asset, index) => {
          const isActive = activeAsset?.code === asset.code && activeAsset?.period === asset.period;
          const variationColor = asset.variation >= 0 ? "text-green-400" : "text-red-400";
          
          return (
            <button
              key={`${asset.code}-${asset.period}-${index}`}
              onClick={() => onAssetSelect(asset)}
              className={`px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="font-semibold">{asset.code}</span>
                <span className="text-xs opacity-75">{asset.period}</span>
                <span className={`text-xs font-mono ${variationColor}`}>
                  {asset.variation >= 0 ? "+" : ""}
                  {asset.variation.toFixed(2)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

