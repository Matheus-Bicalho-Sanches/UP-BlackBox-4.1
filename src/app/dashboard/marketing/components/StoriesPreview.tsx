'use client';

import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DadosGrafico } from '../types/arte.types';

// Mapeamento de meses
const monthMap: { [key: string]: string } = {
  jan: 'Jan', feb: 'Fev', mar: 'Mar', apr: 'Abr', may: 'Mai', jun: 'Jun',
  jul: 'Jul', aug: 'Ago', sep: 'Set', oct: 'Out', nov: 'Nov', dec: 'Dez'
};

// Função para formatar labels de data
function formatDateLabel(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.toLowerCase().split('-');
  if (parts.length === 2) {
    const day = parts[0];
    const monthKey = parts[1];
    const monthName = monthMap[monthKey] || monthKey;
    return `${day} ${monthName}`;
  }
  return dateStr;
}

// Função para formatar ticks do eixo Y
function formatPercentTick(value: number) {
  return `${value.toFixed(0)}%`;
}

// Componente Tooltip customizado
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid #06b6d4',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '11px'
    }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>
        {formatDateLabel(data.date)}
      </div>
      {payload.map((entry: any, index: number) => {
        if (entry.dataKey === 'tatica' && entry.name === 'BlackBox FIIs') {
          return (
            <div key={index} style={{ color: entry.color, fontSize: '10px' }}>
              {entry.name}: {entry.value?.toFixed(2)}%
            </div>
          );
        }
        if (entry.dataKey === 'ifix' || entry.dataKey === 'cdi') {
          return (
            <div key={index} style={{ color: entry.color, fontSize: '10px' }}>
              {entry.name}: {entry.value?.toFixed(2)}%
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// Componente Legend customizado (igual à home)
function CustomLegend({ payload }: { payload?: any[] }) {
  if (!payload) return null;
  
  // Filtra para remover entradas indesejadas e manter apenas BlackBox FIIs, IFIX e CDI
  const filteredPayload = payload.filter(entry => {
    // Remove qualquer entrada que seja 'tatica' mas não tenha o nome correto
    if (entry.dataKey === 'tatica' && entry.value !== 'BlackBox FIIs') {
      return false;
    }
    return true;
  });
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '9px', marginTop: '4px' }}>
      {filteredPayload.map((entry: any, index: number) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '12px',
            height: '2px',
            background: entry.color,
            borderRadius: '1px'
          }} />
          <span style={{ color: '#fff' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

interface StoriesPreviewProps {
  carteira: string;
  periodo: string;
  dados: DadosGrafico[];
  retornoTotal: number;
  vsIfix: number;
  vsCdi: number;
  titulo?: string;
  textoCTA?: string;
}

export default function StoriesPreview({ 
  carteira, 
  periodo, 
  dados, 
  retornoTotal, 
  vsIfix, 
  vsCdi,
  titulo,
  textoCTA = "Invista com UP"
}: StoriesPreviewProps) {
  const tituloFinal = titulo || "Aumente o retorno da sua carteira com a UP Gestão de recursos";
  
  return (
    <div 
      id="stories-preview"
      className="w-[270px] h-[480px] bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 relative overflow-hidden"
      style={{ aspectRatio: '9/16' }}
    >
      {/* Logo no topo */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div 
          style={{ 
            width: '96px', 
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src="/images/up-logo-white.png"
            alt="UP Carteiras Administradas"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>
      </div>

      {/* Título */}
      <div className="absolute top-16 left-4 right-4 z-10">
        <h1 className="text-white text-sm font-bold text-center leading-tight">{tituloFinal}</h1>
      </div>

      {/* Gráfico */}
      <div className="absolute top-32 left-0 right-4 bottom-48 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf33" />
            <XAxis
              dataKey="date"
              stroke="#fff"
              tick={{ fill: '#fff', fontSize: 8 }}
              tickFormatter={formatDateLabel}
            />
            <YAxis 
              stroke="#fff" 
              tick={{ fill: '#fff', fontSize: 8 }} 
              tickFormatter={formatPercentTick} 
              domain={['dataMin', 'dataMax + 5']} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={24} content={CustomLegend} />
            <defs>
              <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="tatica"
              stroke={undefined}
              fill="url(#colorRet)"
              isAnimationActive
              animationDuration={3500}
              legendType="none"
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="tatica"
              name="BlackBox FIIs"
              stroke="#06b6d4"
              strokeWidth={2.2}
              dot={false}
              connectNulls
              legendType="line"
              isAnimationActive
              animationDuration={3500}
            />
            {carteira === 'BlackBox FIIs' && (
              <Line
                type="monotone"
                dataKey="ifix"
                name="IFIX"
                stroke="#2dd4bf"
                strokeWidth={2.2}
                dot={false}
                strokeDasharray="5 5"
                connectNulls
                legendType="line"
                isAnimationActive
                animationDuration={3500}
              />
            )}
            <Line
              type="monotone"
              dataKey="cdi"
              name="CDI"
              stroke="#ffffff"
              strokeWidth={2.2}
              dot={false}
              strokeDasharray="3 3"
              connectNulls
              legendType="line"
              isAnimationActive
              animationDuration={3500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Copy persuasivo */}
      <div className="absolute bottom-28 left-4 right-4 z-10">
        <div className="bg-gray-800/80 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-cyan-400 text-xs font-bold" style={{ fontSize: '10px' }}>+{retornoTotal.toFixed(1)}% de Retorno nos últimos 12 meses</div>
            <div className="text-gray-300 text-xs" style={{ fontSize: '9px' }}>Carteira de Fundos imobiliários, Fundos de Infraestrutura e Fundos do Agronegócio.</div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          {textoCTA}
        </div>
      </div>
    </div>
  );
}

