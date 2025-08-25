import asyncio
import sys
import os

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from robot_persistence import RobotPersistence
from robot_detector import TWAPDetector, TWAPDetectionConfig

async def debug_twap():
    print("🔍 DEBUGANDO DETECTOR TWAP")
    print("=" * 50)
    
    # Configuração mais permissiva para teste
    config = TWAPDetectionConfig(
        min_trades=5,           # Reduzido de 10 para 5
        min_total_volume=10000, # Reduzido de 100000 para 10000
        max_price_variation=10.0, # Aumentado de 5.0 para 10.0
        min_frequency_minutes=0.5, # Reduzido de 1.0 para 0.5
        max_frequency_minutes=60.0, # Aumentado de 30.0 para 60.0
        min_confidence=0.3      # Reduzido de 0.6 para 0.3
    )
    
    # Cria detector com configuração
    persistence = RobotPersistence()
    detector = TWAPDetector(config, persistence)
    
    # Testa com PETR4
    symbol = 'PETR4'
    print(f"\n📊 Analisando {symbol}...")
    
    # Busca ticks
    ticks = await persistence.get_recent_ticks(symbol, 24)
    print(f"✅ Ticks encontrados: {len(ticks)}")
    
    if not ticks:
        print("❌ Nenhum tick encontrado!")
        return
    
    # Mostra primeiros ticks
    print(f"\n📈 Primeiros 3 ticks:")
    for i, tick in enumerate(ticks[:3]):
        print(f"  {i+1}. {tick}")
    
    # Mostra agentes únicos
    buy_agents = set([t['buy_agent'] for t in ticks if t['buy_agent']])
    sell_agents = set([t['sell_agent'] for t in ticks if t['sell_agent']])
    all_agents = buy_agents.union(sell_agents)
    
    print(f"\n🤖 Agentes únicos encontrados:")
    print(f"  Compras: {len(buy_agents)} - {buy_agents}")
    print(f"  Vendas: {len(sell_agents)} - {sell_agents}")
    print(f"  Total: {len(all_agents)}")
    
    # Testa detecção com configuração mais permissiva
    print(f"\n🔍 Testando detecção com configuração permissiva...")
    patterns = await detector.analyze_symbol(symbol)
    
    if patterns:
        print(f"✅ Padrões detectados: {len(patterns)}")
        for pattern in patterns:
            print(f"  - Agente {pattern.agent_id}: {pattern.total_trades} trades, "
                  f"confiança {pattern.confidence_score:.2f}")
    else:
        print("❌ Nenhum padrão detectado mesmo com configuração permissiva")
        
        # Debug mais detalhado
        print(f"\n🔍 Debug detalhado...")
        agent_trades = detector._group_trades_by_agent(ticks)
        
        for agent_id, trades in agent_trades.items():
            print(f"\n  Agente {agent_id}: {len(trades)} trades")
            
            if len(trades) >= config.min_trades:
                print(f"    ✅ Passou no filtro de trades mínimos")
                
                # Calcula métricas básicas
                total_volume = sum(trade.volume for trade in trades)
                print(f"    📊 Volume total: {total_volume:,}")
                
                if total_volume >= config.min_total_volume:
                    print(f"    ✅ Passou no filtro de volume mínimo")
                    
                    # Calcula frequência
                    if len(trades) > 1:
                        frequencies = []
                        for i in range(1, len(trades)):
                            time_diff = trades[i].timestamp - trades[i-1].timestamp
                            freq_minutes = time_diff.total_seconds() / 60
                            frequencies.append(freq_minutes)
                        
                        avg_frequency = sum(frequencies) / len(frequencies)
                        print(f"    ⏰ Frequência média: {avg_frequency:.2f} min")
                        
                        if config.min_frequency_minutes <= avg_frequency <= config.max_frequency_minutes:
                            print(f"    ✅ Passou no filtro de frequência")
                        else:
                            print(f"    ❌ Frequência fora do range: {config.min_frequency_minutes}-{config.max_frequency_minutes}")
                    else:
                        print(f"    ❌ Poucos trades para calcular frequência")
                else:
                    print(f"    ❌ Volume insuficiente: {config.min_total_volume:,} necessário")
            else:
                print(f"    ❌ Poucos trades: {config.min_trades} necessário")

if __name__ == "__main__":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_twap())
