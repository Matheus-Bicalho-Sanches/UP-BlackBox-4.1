'use client';

import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { motion, useMotionTemplate, useMotionValue, AnimatePresence } from 'framer-motion';

/**
 * StockTicker Component
 * 
 * A visually dynamic stock ticker that displays multiple rows of financial data
 * with interactive effects and animations.
 * 
 * Features:
 * - Multiple rows of stock data that animate in alternating directions
 * - Interactive hover effects with glow and motion tracking
 * - Mouse trail effect that follows cursor movement
 * - Responsive design for various screen sizes
 */

// Dados de exemplo de ações para as linhas do ticker (agora com 11 linhas no total)
const stockRows = [
  // Nova linha -2 (adicional superior) - movimento para direita
  [
    { symbol: 'PETR4', name: 'Petrobras PN', value: 2.87, positive: true },
    { symbol: 'VALE3', name: 'Vale ON', value: 1.42, positive: true },
    { symbol: 'ITUB4', name: 'Itaú Unibanco PN', value: 0.89, positive: true },
    { symbol: 'BBDC4', name: 'Bradesco PN', value: 1.23, positive: true },
    { symbol: 'B3SA3', name: 'B3 ON', value: 0.76, positive: true },
    { symbol: 'ABEV3', name: 'Ambev ON', value: 0.47, positive: false },
    { symbol: 'WEGE3', name: 'WEG ON', value: 1.58, positive: true },
    { symbol: 'RENT3', name: 'Localiza ON', value: 2.35, positive: true },
    { symbol: 'BBAS3', name: 'Banco do Brasil ON', value: 3.21, positive: true },
    { symbol: 'MGLU3', name: 'Magazine Luiza ON', value: 4.58, positive: true },
    { symbol: 'CIEL3', name: 'Cielo ON', value: 2.16, positive: true },
    { symbol: 'PRIO3', name: 'PetroRio ON', value: 1.97, positive: true },
    { symbol: 'RADL3', name: 'Raia Drogasil ON', value: 0.85, positive: true },
  ],
  // Nova linha -1 (adicional superior) - movimento para esquerda
  [
    { symbol: 'BBSE3', name: 'BB Seguridade ON', value: 1.12, positive: true },
    { symbol: 'VIVT3', name: 'Telefônica Brasil ON', value: 0.67, positive: true },
    { symbol: 'SUZB3', name: 'Suzano ON', value: 1.83, positive: true },
    { symbol: 'TOTS3', name: 'Totvs ON', value: 2.73, positive: true },
    { symbol: 'ELET3', name: 'Eletrobras ON', value: 3.45, positive: true },
    { symbol: 'UGPA3', name: 'Ultrapar ON', value: 0.56, positive: false },
    { symbol: 'KLBN11', name: 'Klabin UNT', value: 0.92, positive: false },
    { symbol: 'JBSS3', name: 'JBS ON', value: 1.47, positive: true },
    { symbol: 'SBSP3', name: 'Sabesp ON', value: 2.84, positive: true },
    { symbol: 'EGIE3', name: 'Engie Brasil ON', value: 0.78, positive: true },
    { symbol: 'EQTL3', name: 'Equatorial ON', value: 1.34, positive: true },
    { symbol: 'BRFS3', name: 'BRF ON', value: 3.26, positive: true },
    { symbol: 'CCRO3', name: 'CCR ON', value: 0.94, positive: true },
  ],
  // Linha ZERO - movimento para esquerda (Empresas de TI/Tecnologia brasileiras)
  [
    { symbol: 'LWSA3', name: 'Locaweb ON', value: 3.75, positive: true },
    { symbol: 'TOTS3', name: 'Totvs ON', value: 2.13, positive: true },
    { symbol: 'CASH3', name: 'Méliuz ON', value: 4.67, positive: true },
    { symbol: 'IFCM3', name: 'Infracommerce ON', value: 1.52, positive: false },
    { symbol: 'MOSI3', name: 'Mosaico ON', value: 2.35, positive: true },
    { symbol: 'NINJ3', name: 'GetNinjas ON', value: 3.82, positive: true },
    { symbol: 'MBLY3', name: 'Mobly ON', value: 0.78, positive: false },
    { symbol: 'SQIA3', name: 'Sinqia ON', value: 1.65, positive: true },
    { symbol: 'DESK3', name: 'Desktop ON', value: 2.93, positive: true },
    { symbol: 'WEST3', name: 'Westwing ON', value: 5.21, positive: true },
    { symbol: 'INTB3', name: 'Intelbras ON', value: 1.87, positive: true },
    { symbol: 'NGRD3', name: 'Neogrid ON', value: 0.94, positive: false },
    { symbol: 'TRAD3', name: 'TC ON', value: 2.56, positive: true },
  ],
  // Primeira linha - movimento para direita (Grandes empresas brasileiras)
  [
    { symbol: 'PETR3', name: 'Petrobras ON', value: 1.87, positive: true },
    { symbol: 'VALE5', name: 'Vale PNA', value: 2.32, positive: true },
    { symbol: 'ITSA4', name: 'Itaúsa PN', value: 0.95, positive: true },
    { symbol: 'BBAS3', name: 'Banco do Brasil ON', value: 3.12, positive: true },
    { symbol: 'SANB11', name: 'Santander UNT', value: 1.56, positive: true },
    { symbol: 'LAME4', name: 'Lojas Americanas PN', value: 0.87, positive: false },
    { symbol: 'CIEL3', name: 'Cielo ON', value: 1.93, positive: true },
    { symbol: 'COGN3', name: 'Cogna ON', value: 2.45, positive: true },
    { symbol: 'CRFB3', name: 'Carrefour ON', value: 0.73, positive: false },
    { symbol: 'CSNA3', name: 'CSN ON', value: 3.21, positive: true },
    { symbol: 'GGBR4', name: 'Gerdau PN', value: 1.63, positive: true },
    { symbol: 'GOAU4', name: 'Gerdau Met PN', value: 2.41, positive: true },
    { symbol: 'USIM5', name: 'Usiminas PNA', value: 1.79, positive: true },
  ],
  // Segunda linha - movimento para esquerda (Empresas do varejo)
  [
    { symbol: 'MGLU3', name: 'Magazine Luiza ON', value: 4.29, positive: true },
    { symbol: 'AMER3', name: 'Americanas ON', value: 5.77, positive: true },
    { symbol: 'VIIA3', name: 'Via ON', value: 2.84, positive: true },
    { symbol: 'LJQQ3', name: 'Quero-Quero ON', value: 1.58, positive: true },
    { symbol: 'PETZ3', name: 'Petz ON', value: 3.26, positive: true },
    { symbol: 'NTCO3', name: 'Natura ON', value: 2.11, positive: true },
    { symbol: 'SBFG3', name: 'Grupo SBF ON', value: 1.79, positive: true },
    { symbol: 'ARML3', name: 'Arezzo ON', value: 2.13, positive: true },
    { symbol: 'SOMA3', name: 'Grupo Soma ON', value: 1.52, positive: true },
    { symbol: 'CEAB3', name: 'C&A Brasil ON', value: 3.21, positive: true },
    { symbol: 'GUAR3', name: 'Guararapes ON', value: 1.88, positive: true },
    { symbol: 'AMAR3', name: 'Marisa ON', value: 2.45, positive: true },
    { symbol: 'GRND3', name: 'Grendene ON', value: 1.62, positive: true },
  ],
  // Terceira linha - movimento para direita (Empresas financeiras)
  [
    { symbol: 'ITUB4', name: 'Itaú Unibanco PN', value: 1.94, positive: true },
    { symbol: 'BBDC4', name: 'Bradesco PN', value: 0.87, positive: true },
    { symbol: 'B3SA3', name: 'B3 ON', value: 2.15, positive: true },
    { symbol: 'BPAC11', name: 'BTG Pactual UNT', value: 3.33, positive: true },
    { symbol: 'BBSE3', name: 'BB Seguridade ON', value: 1.51, positive: true },
    { symbol: 'CXSE3', name: 'Caixa Seguridade ON', value: 1.42, positive: true },
    { symbol: 'IRBR3', name: 'IRB Brasil ON', value: 2.15, positive: true },
    { symbol: 'BRSR6', name: 'Banrisul PNB', value: 1.59, positive: true },
    { symbol: 'WIZC3', name: 'Wiz Soluções ON', value: 2.77, positive: true },
    { symbol: 'PSSA3', name: 'Porto Seguro ON', value: 0.65, positive: false },
    { symbol: 'BRBI11', name: 'BR Partners UNT', value: 1.22, positive: true },
    { symbol: 'MODL4', name: 'Banco Modal PN', value: 2.19, positive: true },
    { symbol: 'PINE4', name: 'Banco Pine PN', value: 1.73, positive: true },
  ],
  // Quarta linha - movimento para esquerda (Infraestrutura e energia)
  [
    { symbol: 'SBSP3', name: 'Sabesp ON', value: 2.24, positive: true },
    { symbol: 'ELET3', name: 'Eletrobras ON', value: 1.13, positive: true },
    { symbol: 'ENEV3', name: 'Eneva ON', value: 1.58, positive: true },
    { symbol: 'EGIE3', name: 'Engie Brasil ON', value: 0.94, positive: false },
    { symbol: 'TAEE11', name: 'Taesa UNT', value: 1.53, positive: true },
    { symbol: 'CSMG3', name: 'Copasa ON', value: 0.75, positive: false },
    { symbol: 'TRPL4', name: 'Transmissão Paulista PN', value: 1.09, positive: true },
    { symbol: 'AURE3', name: 'Auren ON', value: 1.73, positive: true },
    { symbol: 'CMIG4', name: 'Cemig PN', value: 2.35, positive: true },
    { symbol: 'CPFE3', name: 'CPFL Energia ON', value: 1.12, positive: true },
    { symbol: 'EQTL3', name: 'Equatorial ON', value: 2.15, positive: true },
    { symbol: 'NEOE3', name: 'Neoenergia ON', value: 0.77, positive: true },
    { symbol: 'CESP6', name: 'Cesp PNB', value: 1.88, positive: true },
  ],
  // Quinta linha - movimento para direita (Consumo e alimentos)
  [
    { symbol: 'ABEV3', name: 'Ambev ON', value: 1.58, positive: true },
    { symbol: 'BEEF3', name: 'Minerva ON', value: 2.59, positive: true },
    { symbol: 'MRFG3', name: 'Marfrig ON', value: 3.77, positive: true },
    { symbol: 'JBSS3', name: 'JBS ON', value: 1.11, positive: false },
    { symbol: 'BRFS3', name: 'BRF ON', value: 2.89, positive: true },
    { symbol: 'MDIA3', name: 'M.Dias Branco ON', value: 1.84, positive: true },
    { symbol: 'CAML3', name: 'Camil ON', value: 1.21, positive: true },
    { symbol: 'SLCE3', name: 'SLC Agrícola ON', value: 3.08, positive: true },
    { symbol: 'AGRO3', name: 'BrasilAgro ON', value: 1.15, positive: true },
    { symbol: 'SMTO3', name: 'São Martinho ON', value: 2.44, positive: true },
    { symbol: 'HYPE3', name: 'Hypera ON', value: 1.92, positive: true },
    { symbol: 'VITT3', name: 'Vittia ON', value: 2.03, positive: true },
    { symbol: 'RAIZ4', name: 'Raízen PN', value: 1.67, positive: true },
  ],
  // Sexta linha - movimento para esquerda (Saúde e educação)
  [
    { symbol: 'FLRY3', name: 'Fleury ON', value: 0.65, positive: true },
    { symbol: 'RDOR3', name: 'Rede D\'Or ON', value: 1.20, positive: true },
    { symbol: 'HAPV3', name: 'Hapvida ON', value: 1.87, positive: true },
    { symbol: 'GNDI3', name: 'NotreDame Intermédica ON', value: 1.53, positive: true },
    { symbol: 'ONCO3', name: 'Oncoclinicas ON', value: 2.37, positive: true },
    { symbol: 'AALR3', name: 'Alliar ON', value: 0.83, positive: false },
    { symbol: 'PARD3', name: 'Instituto Hermes Pardini ON', value: 1.89, positive: true },
    { symbol: 'KRSA3', name: 'Kora Saúde ON', value: 2.43, positive: true },
    { symbol: 'YDUQ3', name: 'Yduqs ON', value: 0.95, positive: true },
    { symbol: 'COGN3', name: 'Cogna ON', value: 1.86, positive: true },
    { symbol: 'SEER3', name: 'Ser Educacional ON', value: 1.55, positive: true },
    { symbol: 'ANIM3', name: 'Ânima ON', value: 1.28, positive: true },
    { symbol: 'VAMO3', name: 'Vamos ON', value: 2.76, positive: true },
  ],
  // Nova linha 7 (adicional inferior) - movimento para direita
  [
    { symbol: 'LREN3', name: 'Lojas Renner ON', value: 1.87, positive: true },
    { symbol: 'ASAI3', name: 'Assaí ON', value: 2.31, positive: true },
    { symbol: 'CSAN3', name: 'Cosan ON', value: 1.45, positive: true },
    { symbol: 'CVCB3', name: 'CVC Brasil ON', value: 3.64, positive: true },
    { symbol: 'NTCO3', name: 'Natura ON', value: 2.19, positive: true },
    { symbol: 'LWSA3', name: 'Locaweb ON', value: 4.23, positive: true },
    { symbol: 'HAPV3', name: 'Hapvida ON', value: 3.48, positive: true },
    { symbol: 'EMBR3', name: 'Embraer ON', value: 5.12, positive: true },
    { symbol: 'BPAC11', name: 'BTG Pactual UNT', value: 1.29, positive: true },
    { symbol: 'VBBR3', name: 'Vibra Energia ON', value: 0.85, positive: false },
    { symbol: 'ALPA4', name: 'Alpargatas PN', value: 1.74, positive: true },
    { symbol: 'PCAR3', name: 'Pão de Açúcar ON', value: 2.21, positive: true },
    { symbol: 'FLRY3', name: 'Fleury ON', value: 0.98, positive: false },
  ],
  // Nova linha 8 (adicional inferior) - movimento para esquerda
  [
    { symbol: 'IBOV', name: 'Ibovespa', value: 1.32, positive: true },
    { symbol: 'IVVB11', name: 'ETF S&P 500', value: 0.87, positive: true },
    { symbol: 'BOVA11', name: 'ETF Ibovespa', value: 1.42, positive: true },
    { symbol: 'SMAL11', name: 'ETF Small Caps', value: 2.15, positive: true },
    { symbol: 'MALL11', name: 'ETF Malls', value: 1.87, positive: true },
    { symbol: 'MATB11', name: 'ETF Materiais', value: 0.68, positive: false },
    { symbol: 'PIBB11', name: 'ETF PIBB', value: 1.35, positive: true },
    { symbol: 'BOVV11', name: 'ETF Valor', value: 0.91, positive: true },
    { symbol: 'HASH11', name: 'ETF Cripto', value: 3.85, positive: true },
    { symbol: 'FNAM11', name: 'FII Naming', value: 0.58, positive: false },
    { symbol: 'KNRI11', name: 'FII Kinea', value: 0.97, positive: true },
    { symbol: 'HGLG11', name: 'FII CSHG', value: 1.23, positive: true },
    { symbol: 'XPLG11', name: 'FII XP Log', value: 1.79, positive: true },
  ],
];

/**
 * Interface for stock item properties
 */
interface StockItemProps {
  stock: {
    symbol: string;
    name: string;
    value: number;
    positive: boolean;
  };
  index: number;
  isOdd: boolean;
  rowIndex: number;
}

/**
 * StockItem Component
 * 
 * Renders an individual stock item with interactive animations and hover effects.
 * 
 * @param stock - The stock data to display
 * @param index - The index of the stock in its row
 * @param isOdd - Whether the stock is in an odd-numbered position
 * @param rowIndex - The index of the row containing this stock
 */
const StockItem = ({ stock, index, isOdd, rowIndex }: StockItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Determina cores de texto e glow baseadas no valor positivo/negativo
  const textColorClass = stock.positive ? 'text-green-400' : 'text-red-400';
  const valueColorClass = stock.positive ? 'text-green-500' : 'text-red-500';
  
  // Alternar entre textos mais claros e mais escuros para criar efeito de "linhas"
  const isDimmed = index % 2 === (isOdd ? 0 : 1);
  const opacityClass = isDimmed ? 'opacity-75' : 'opacity-90';
  
  // Valores de movimento para efeito spotlight
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  /**
   * Handles mouse movement over a stock item
   * Updates the position and glow effect
   */
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    }
  };
  
  return (
    <motion.div
      ref={itemRef}
      className={`inline-flex items-center justify-center px-2 py-1 relative cursor-pointer ${opacityClass} hover:opacity-100 z-10`}
      style={{ width: '140px' }} // Largura fixa para padronizar o espaçamento
      animate={{
        scale: isHovered ? 1.1 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      transition={{
        scale: { duration: 0.15, type: 'spring', stiffness: 300 },
      }}
    >
      {/* Efeito de glow CSS puro para garantir compatibilidade */}
      <div 
        className={`absolute inset-0 rounded-lg z-0 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: stock.positive
            ? 'radial-gradient(circle, rgba(74, 222, 128, 0.6) 0%, rgba(0, 0, 0, 0) 70%)'
            : 'radial-gradient(circle, rgba(248, 113, 113, 0.6) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      
      {/* Efeito de borda brilhante */}
      {isHovered && (
        <div 
          className="absolute -inset-px rounded-lg border z-0"
          style={{
            borderColor: stock.positive ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)',
            boxShadow: stock.positive 
              ? '0 0 10px 1px rgba(74, 222, 128, 0.7), inset 0 0 4px rgba(74, 222, 128, 0.5)' 
              : '0 0 10px 1px rgba(248, 113, 113, 0.7), inset 0 0 4px rgba(248, 113, 113, 0.5)',
          }}
        />
      )}
      
      {/* Conteúdo do ticker - símbolo e variação */}
      <div className="flex items-center font-mono relative z-10">
        <span className={`font-bold ${textColorClass}`}>
          {stock.symbol}
        </span>
        <span 
          className={`ml-1 ${valueColorClass}`}
        >
          {stock.positive ? '+' : '-'}{stock.value}%
        </span>
      </div>
    </motion.div>
  );
};

/**
 * StockTickerRow Component
 * 
 * Renders a row of stock items with alternating animation directions.
 * 
 * @param stocks - Array of stock data to display in this row
 * @param rowIndex - The index of this row in the ticker
 */
const StockTickerRow = ({ stocks, rowIndex }: { stocks: any[]; rowIndex: number }) => {
  const isOdd = rowIndex % 2 === 1;
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [scannerPositions, setScannerPositions] = useState<number[]>([-100, -200, -300]); // Múltiplos scanners
  const rowRef = useRef<HTMLDivElement>(null);
  
  // Efeito de scanner para cada linha com velocidades aleatórias
  useEffect(() => {
    // Gerar uma velocidade aleatória para cada scanner baseada no rowIndex
    // Isso garante que cada linha terá uma velocidade diferente, mas consistente
    const baseSpeed = 0.5;
    const randomFactor = Math.sin(rowIndex * 0.7 + 1) * 0.3 + 0.5; // Gera um valor entre 0.2 e 0.8
    
    // Limitar a velocidade máxima do scanner
    const maxSpeed = 0.3; // Reduzido para ficar mais lento
    const minSpeed = 0.1;
    let scanSpeed = baseSpeed * randomFactor;
    
    // Aplicar limites para evitar scanners muito rápidos ou muito lentos
    scanSpeed = Math.min(maxSpeed, Math.max(minSpeed, scanSpeed));
    
    // Offsets diferentes para cada scanner para começarem em posições diferentes
    const offset1 = (rowIndex * 20) % 100;
    const offset2 = (rowIndex * 50) % 100;
    const offset3 = (rowIndex * 80) % 100;
    setScannerPositions([-100 + offset1, -180 + offset2, -260 + offset3]);
    
    const interval = setInterval(() => {
      setScannerPositions(prev => {
        return prev.map(pos => {
          if (pos > 200) { // Quando passar da tela, retorna para o início
            return -100;
          }
          return pos + scanSpeed;
        });
      });
    }, 20);
    
    return () => clearInterval(interval);
  }, [rowIndex]);
  
  // Todas as linhas com inclinação de 15 graus (paralelas)
  const skewAngle = 15;
  
  // Calculamos a largura total mais precisa para garantir que o loop seja contínuo
  // Aumentamos o valor para evitar sobreposições e cobrir totalmente a tela
  const itemWidth = 145; // Largura média ajustada de cada item em pixels
  const totalWidth = stocks.length * itemWidth * 1.2; // Multiplicamos por 1.2 para garantir cobertura completa
  
  // Motion values para efeito spotlight na linha inteira
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  /**
   * Handles mouse movement over a row
   * Updates the motion effects for the entire row
   */
  const handleRowMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
  
  return (
    <div 
      ref={rowRef}
      className="relative my-3" // Aumentado o espaçamento vertical com my-3
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
      onMouseMove={handleRowMouseMove}
    >
      {/* Linha separadora com gradiente */}
      <div 
        className="absolute w-full h-px opacity-30" 
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(75,85,99,1) 50%, rgba(0,0,0,0) 100%)',
          top: 0,
          transform: `skewY(${skewAngle}deg)`,
        }}
      />
      
      {/* Efeitos de scanner para a linha (agora são múltiplos) */}
      {scannerPositions.map((position, idx) => (
        <div 
          key={idx}
          className="absolute h-full w-20 pointer-events-none z-10 opacity-30"
          style={{
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(255,255,255,0.3) 50%, rgba(0,0,0,0) 100%)',
            transform: `skewY(${skewAngle}deg) translateX(${position}vw)`,
            transition: 'transform 0.1s linear',
          }}
        />
      ))}
      
      {/* Container da linha do ticker com transformação diagonal de 15 graus */}
      <div 
        className={`relative py-4 overflow-hidden`} // Aumentado padding vertical para mais espaçamento
        style={{
          transform: `skewY(${skewAngle}deg)`,
        }}
      >
        {/* Efeito de highlight quando a linha estiver em hover */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: 'rgba(30, 41, 59, 0.3)',
            opacity: isRowHovered ? 1 : 0,
          }}
        />
        
        {/* Esta div cria um loop contínuo deslocando duas cópias do conteúdo */}
        <div className="ticker-container flex whitespace-nowrap relative">
          {/* Primeira cópia - animada */}
          <div
            className={`ticker-item absolute top-0 flex whitespace-nowrap ticker-animate-${isOdd ? 'left' : 'right'}`}
            style={{
              animationDuration: `${50 + (rowIndex * 5)}s`,
              width: `${totalWidth}px`,
              left: isOdd ? '0' : 'auto',
              right: isOdd ? 'auto' : '0',
            }}
          >
            {stocks.map((stock, index) => (
              <StockItem 
                key={`${stock.symbol}-1-${index}`} 
                stock={stock} 
                index={index}
                isOdd={isOdd}
                rowIndex={rowIndex}
              />
            ))}
          </div>
          
          {/* Segunda cópia - animada com offset preciso */}
          <div
            className={`ticker-item absolute top-0 flex whitespace-nowrap ticker-animate-${isOdd ? 'left' : 'right'}`}
            style={{
              animationDuration: `${50 + (rowIndex * 5)}s`,
              width: `${totalWidth}px`,
              left: isOdd ? `${totalWidth}px` : 'auto',
              right: isOdd ? 'auto' : `${totalWidth}px`,
              animationDelay: '0s' // Garantir sincronização
            }}
          >
            {stocks.map((stock, index) => (
              <StockItem 
                key={`${stock.symbol}-2-${index}`} 
                stock={stock} 
                index={index}
                isOdd={isOdd}
                rowIndex={rowIndex}
              />
            ))}
          </div>
          
          {/* Terceira cópia para garantir que não haja espaço em telas maiores */}
          <div
            className={`ticker-item absolute top-0 flex whitespace-nowrap ticker-animate-${isOdd ? 'left' : 'right'}`}
            style={{
              animationDuration: `${50 + (rowIndex * 5)}s`,
              width: `${totalWidth}px`,
              left: isOdd ? `${totalWidth * 2}px` : 'auto',
              right: isOdd ? 'auto' : `${totalWidth * 2}px`,
              animationDelay: '0s' // Garantir sincronização
            }}
          >
            {stocks.map((stock, index) => (
              <StockItem 
                key={`${stock.symbol}-3-${index}`} 
                stock={stock} 
                index={index}
                isOdd={isOdd}
                rowIndex={rowIndex}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Linha separadora com gradiente (inferior) */}
      <div 
        className="absolute w-full h-px opacity-30"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(75,85,99,1) 50%, rgba(0,0,0,0) 100%)',
          bottom: 0,
          transform: `skewY(${skewAngle}deg)`,
        }}
      />
    </div>
  );
};

/**
 * Main StockTicker component
 * 
 * Assembles and renders the complete stock ticker with all interactive elements
 */
export default function StockTicker() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const [glowPosition, setGlowPosition] = useState({ x: 0, y: 0 });
  const [isGlowing, setIsGlowing] = useState(false);
  
  /**
   * Handles mouse movement over the entire ticker
   * Updates the global mouse position tracker
   */
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
    setGlowPosition({ x: e.clientX, y: e.clientY });
    setIsGlowing(true);
    setIsMoving(true);
    
    // Resetar o timer quando o mouse se move
    const moveTimeout = setTimeout(() => {
      setIsMoving(false);
    }, 300);
    
    // Desativar o glow se o mouse ficar parado
    const glowTimeout = setTimeout(() => {
      setIsGlowing(false);
    }, 2000);
    
    return () => {
      clearTimeout(moveTimeout);
      clearTimeout(glowTimeout);
    };
  };
  
  return (
    <div 
      className="absolute inset-0 overflow-hidden opacity-90"
      onMouseMove={handleMouseMove}
    >
      <div className="absolute inset-0 bg-black bg-opacity-95"></div>
      
      {/* Efeito de glow global que segue o mouse */}
      <div 
        className="pointer-events-none absolute z-0 transition-opacity duration-300"
        style={{
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(100, 116, 139, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          transform: `translate(-50%, -50%)`,
          left: glowPosition.x,
          top: glowPosition.y,
          opacity: isGlowing ? 1 : 0,
        }}
      />
      
      {/* Efeito de linhas de grade digital */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(75,85,99,0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(75,85,99,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'skewY(15deg)',
          }}
        />
      </div>
      
      {/* CSS para animações e efeitos de glow */}
      <style jsx global>{`
        @keyframes tickerLeft {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        @keyframes tickerRight {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .ticker-animate-left {
          animation: tickerLeft linear infinite;
        }
        
        .ticker-animate-right {
          animation: tickerRight linear infinite;
        }
        
        .ticker-container {
          height: 40px; /* Aumentado para melhor espaçamento */
          position: relative;
          overflow: hidden;
        }
        
        .ticker-item {
          display: flex;
          justify-content: space-between;
        }
        
        /* Efeito de highlight para os itens em hover */
        .highlight-pulse {
          animation: highlightPulse 2s infinite alternate;
        }
        
        @keyframes highlightPulse {
          0% {
            opacity: 0.3;
          }
          100% {
            opacity: 0.8;
          }
        }
        
        /* Efeito de pulsação para o botão de login */
        @keyframes buttonPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(14, 165, 233, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(14, 165, 233, 0);
          }
        }
        
        .pulse-button {
          animation: buttonPulse 2s infinite;
          position: relative;
          overflow: hidden;
        }
        
        /* Efeito de brilho que atravessa o botão */
        .pulse-button::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: rotate(30deg);
          animation: shimmer 4s infinite;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) rotate(30deg);
          }
          100% {
            transform: translateX(100%) rotate(30deg);
          }
        }
      `}</style>
      
      {/* Grid para linhas diagonais de fundo - agora com ângulo de 15 graus */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              15deg, /* Alterado para combinar com o ângulo das linhas */
              rgba(75,85,99,0.2),
              rgba(75,85,99,0.2) 1px,
              transparent 1px,
              transparent 15px
            )`,
            backgroundSize: '30px 30px',
          }}
        />
        
        {/* Segunda camada de linhas diagonais */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              105deg, /* Perpendicular to 15deg */
              rgba(75,85,99,0.2),
              rgba(75,85,99,0.2) 1px,
              transparent 1px,
              transparent 20px
            )`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>
      
      {/* Ticker content */}
      <div className="relative h-full flex flex-col justify-between py-6"> {/* Aumentado padding vertical */}
        {stockRows.map((stocks, index) => (
          <StockTickerRow 
            key={index} 
            stocks={stocks} 
            rowIndex={index} 
          />
        ))}
      </div>
      
      {/* Efeito de vinheta nas bordas da tela */}
      <div 
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.5) 100%)'
        }}
      />
    </div>
  );
} 