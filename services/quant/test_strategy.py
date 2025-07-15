"""
Script de Teste - Estratégia Voltaamedia_Bollinger_1min_WINQ25
============================================================
Testa a lógica da estratégia com dados simulados antes de executar em produção.
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict
import json

class BollingerBandsTest:
    """Versão de teste da classe BollingerBands"""
    
    def __init__(self, period: int = 20, std_dev: float = 2.0):
        self.period = period
        self.std_dev = std_dev
    
    def calculate(self, prices: List[float]) -> Dict[str, float]:
        """Calcula Bollinger Bands"""
        if len(prices) < self.period:
            return {'middle': 0, 'upper': 0, 'lower': 0}
        
        recent_prices = prices[-self.period:]
        sma = np.mean(recent_prices)
        std = np.std(recent_prices)
        
        upper_band = sma + (self.std_dev * std)
        lower_band = sma - (self.std_dev * std)
        
        return {
            'middle': float(sma),
            'upper': float(upper_band),
            'lower': float(lower_band)
        }

def generate_test_data(start_price: float = 118000, num_candles: int = 100) -> List[float]:
    """Gera dados de teste simulando movimento de preço do WINQ25 (Mini Índice)"""
    np.random.seed(42)  # Para resultados reproduzíveis
    
    prices = [start_price]
    
    for i in range(num_candles - 1):
        # Simulação de random walk com tendência de reversão à média
        current_price = prices[-1]
        
        # Adicionar um pouco de reversão à média
        mean_reversion = (start_price - current_price) * 0.001
        
        # Ruído aleatório
        noise = np.random.normal(0, 50)
        
        # Próximo preço
        next_price = current_price + mean_reversion + noise
        prices.append(max(next_price, start_price * 0.95))  # Evitar preços muito baixos
    
    return prices

def simulate_strategy(prices: List[float]) -> Dict:
    """Simula a execução da estratégia Voltaamedia_Bollinger"""
    bb = BollingerBandsTest(period=20, std_dev=2.0)
    
    position = 0
    trades = []
    pnl_history = []
    bb_history = []
    
    entry_prices = []
    
    for i in range(20, len(prices)):  # Começar após ter dados suficientes para BB
        current_price = prices[i]
        
        # Calcular Bollinger Bands
        bands = bb.calculate(prices[:i+1])
        bb_history.append({
            'index': i,
            'price': current_price,
            'middle': bands['middle'],
            'upper': bands['upper'],
            'lower': bands['lower']
        })
        
        # LÓGICA DA ESTRATÉGIA
        
        # VENDA: Preço > Média BB (fechar toda posição)
        if current_price > bands['middle'] and position > 0:
            # Calcular PnL
            avg_entry = np.mean(entry_prices) if entry_prices else current_price
            pnl = (current_price - avg_entry) * position
            
            trades.append({
                'index': i,
                'action': 'SELL',
                'quantity': position,
                'price': current_price,
                'reason': f"Preço ({current_price:.0f}) > Média BB ({bands['middle']:.0f})",
                'pnl': pnl,
                'position_after': 0
            })
            
            position = 0
            entry_prices = []
        
        # COMPRAS
        orders_to_execute = []
        
        # COMPRA 1: Preço < Média BB
        if current_price < bands['middle']:
            orders_to_execute.append({
                'quantity': 1,
                'reason': f"Preço ({current_price:.0f}) < Média BB ({bands['middle']:.0f})"
            })
        
        # COMPRA 2: Preço < Banda Inferior (adicional)
        if current_price < bands['lower']:
            orders_to_execute.append({
                'quantity': 1,
                'reason': f"Preço ({current_price:.0f}) < Banda Inferior ({bands['lower']:.0f})"
            })
        
        # Executar ordens de compra
        for order in orders_to_execute:
            position += order['quantity']
            entry_prices.append(current_price)
            
            trades.append({
                'index': i,
                'action': 'BUY',
                'quantity': order['quantity'],
                'price': current_price,
                'reason': order['reason'],
                'pnl': 0,
                'position_after': position
            })
        
        # Calcular PnL não realizado
        if position > 0 and entry_prices:
            avg_entry = np.mean(entry_prices)
            unrealized_pnl = (current_price - avg_entry) * position
        else:
            unrealized_pnl = 0
        
        pnl_history.append({
            'index': i,
            'position': position,
            'unrealized_pnl': unrealized_pnl,
            'price': current_price
        })
    
    return {
        'trades': trades,
        'pnl_history': pnl_history,
        'bb_history': bb_history,
        'final_position': position
    }

def analyze_results(results: Dict, prices: List[float]):
    """Analisa e exibe os resultados do backtest"""
    trades = results['trades']
    pnl_history = results['pnl_history']
    
    print("=" * 60)
    print("ANÁLISE DA ESTRATÉGIA VOLTAAMEDIA_BOLLINGER_1MIN_WINQ25")
    print("=" * 60)
    
    # Estatísticas gerais
    total_trades = len(trades)
    buy_trades = [t for t in trades if t['action'] == 'BUY']
    sell_trades = [t for t in trades if t['action'] == 'SELL']
    
    print(f"📊 Total de operações: {total_trades}")
    print(f"   - Compras: {len(buy_trades)}")
    print(f"   - Vendas: {len(sell_trades)}")
    print(f"📈 Posição final: {results['final_position']} contratos")
    
    # Calcular PnL realizado
    realized_pnl = sum(t['pnl'] for t in sell_trades)
    print(f"💰 PnL Realizado: R$ {realized_pnl:.2f}")
    
    # PnL não realizado
    if results['final_position'] > 0 and pnl_history:
        unrealized_pnl = pnl_history[-1]['unrealized_pnl']
        print(f"📊 PnL Não Realizado: R$ {unrealized_pnl:.2f}")
        print(f"💵 PnL Total: R$ {realized_pnl + unrealized_pnl:.2f}")
    
    print("\n" + "=" * 60)
    print("ÚLTIMAS 10 OPERAÇÕES:")
    print("=" * 60)
    
    for trade in trades[-10:]:
        action_emoji = "🟢" if trade['action'] == 'BUY' else "🔴"
        print(f"{action_emoji} {trade['action']} {trade['quantity']} @ {trade['price']:.0f} - {trade['reason']}")
        if trade['pnl'] != 0:
            print(f"   💰 PnL: R$ {trade['pnl']:.2f}")
        print(f"   📊 Posição após: {trade['position_after']}")
        print()

def plot_results(prices: List[float], results: Dict):
    """Gera gráfico com preços, Bollinger Bands e sinais"""
    try:
        bb_history = results['bb_history']
        trades = results['trades']
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 10))
        
        # Gráfico 1: Preços e Bollinger Bands
        indices = [bb['index'] for bb in bb_history]
        prices_bb = [bb['price'] for bb in bb_history]
        middle_bb = [bb['middle'] for bb in bb_history]
        upper_bb = [bb['upper'] for bb in bb_history]
        lower_bb = [bb['lower'] for bb in bb_history]
        
        ax1.plot(indices, prices_bb, label='Preço WINQ25', color='black', linewidth=1)
        ax1.plot(indices, middle_bb, label='Média Bollinger', color='blue', linewidth=1)
        ax1.plot(indices, upper_bb, label='Banda Superior', color='red', linestyle='--', alpha=0.7)
        ax1.plot(indices, lower_bb, label='Banda Inferior', color='green', linestyle='--', alpha=0.7)
        
        # Adicionar sinais
        buy_signals = [t for t in trades if t['action'] == 'BUY']
        sell_signals = [t for t in trades if t['action'] == 'SELL']
        
        if buy_signals:
            buy_indices = [t['index'] for t in buy_signals]
            buy_prices = [t['price'] for t in buy_signals]
            ax1.scatter(buy_indices, buy_prices, color='green', marker='^', s=100, label='Compra', zorder=5)
        
        if sell_signals:
            sell_indices = [t['index'] for t in sell_signals]
            sell_prices = [t['price'] for t in sell_signals]
            ax1.scatter(sell_indices, sell_prices, color='red', marker='v', s=100, label='Venda', zorder=5)
        
        ax1.fill_between(indices, upper_bb, lower_bb, alpha=0.1, color='gray')
        ax1.set_title('Estratégia Voltaamedia Bollinger - Sinais de Trading')
        ax1.set_ylabel('Preço (R$)')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Gráfico 2: PnL
        pnl_history = results['pnl_history']
        pnl_indices = [p['index'] for p in pnl_history]
        unrealized_pnls = [p['unrealized_pnl'] for p in pnl_history]
        
        ax2.plot(pnl_indices, unrealized_pnls, label='PnL Não Realizado', color='purple')
        ax2.axhline(y=0, color='black', linestyle='-', alpha=0.3)
        ax2.set_title('Evolução do PnL')
        ax2.set_xlabel('Índice (Candles)')
        ax2.set_ylabel('PnL (R$)')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('voltaamedia_bollinger_backtest.png', dpi=300, bbox_inches='tight')
        print("📊 Gráfico salvo como: voltaamedia_bollinger_backtest.png")
        plt.show()
        
    except ImportError:
        print("⚠️ Matplotlib não instalado. Para ver gráficos, instale com: pip install matplotlib")

def main():
    """Função principal do teste"""
    print("🧪 TESTE DA ESTRATÉGIA VOLTAAMEDIA_BOLLINGER_1MIN_WINQ25")
    print("=" * 60)
    
    # Gerar dados de teste
    print("📊 Gerando dados de teste...")
    prices = generate_test_data(start_price=118000, num_candles=100)
    
    # Executar simulação
    print("🔄 Executando simulação da estratégia...")
    results = simulate_strategy(prices)
    
    # Analisar resultados
    analyze_results(results, prices)
    
    # Salvar resultados
    with open('test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("\n📁 Resultados salvos em: test_results.json")
    
    # Gerar gráfico
    plot_results(prices, results)
    
    print("\n✅ Teste concluído! Analise os resultados antes de executar em produção.")

if __name__ == "__main__":
    main() 