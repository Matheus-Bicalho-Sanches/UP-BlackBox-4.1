#!/usr/bin/env python3
"""
Script para testar diretamente o detector de robôs
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Adiciona o diretório atual ao path para imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from robot_models import TWAPDetectionConfig
    from robot_persistence import RobotPersistence
    from robot_detector import TWAPDetector
except ImportError as e:
    print(f"❌ Erro de import: {e}")
    print("💡 Certifique-se de que todos os arquivos estão no diretório correto")
    sys.exit(1)

async def test_detector_directly():
    """Testa o detector diretamente"""
    print("🧪 Testando detector diretamente...")
    
    try:
        # 1. Cria configuração
        config = TWAPDetectionConfig(
            min_trades=5,
            min_confidence=0.3,
            min_total_volume=1000,
            min_frequency_minutes=0.001,
            max_frequency_minutes=60.0,
            active_recency_minutes=5.0
        )
        print("✅ Configuração criada")
        
        # 2. Cria persistência
        persistence = RobotPersistence()
        print("✅ Persistência criada")
        
        # 3. Cria detector
        detector = TWAPDetector(config, persistence)
        print("✅ Detector criado")
        
        # 4. Testa análise de um símbolo específico
        print("\n🔍 Testando análise de ABEV3...")
        patterns = await detector.analyze_symbol("ABEV3")
        
        print(f"📊 Padrões detectados: {len(patterns)}")
        
        if patterns:
            for i, pattern in enumerate(patterns):
                print(f"\n🤖 Padrão {i+1}:")
                print(f"   Agente: {pattern.agent_id}")
                print(f"   Status: {pattern.status.value}")
                print(f"   Score: {pattern.confidence_score:.3f}")
                print(f"   Trades: {pattern.total_trades}")
                print(f"   Volume: {pattern.total_volume:,}")
                print(f"   Frequência: {pattern.frequency_minutes:.3f} min")
                print(f"   Primeiro trade: {pattern.first_seen}")
                print(f"   Último trade: {pattern.last_seen}")
        else:
            print("❌ Nenhum padrão detectado!")
            
            # Vamos investigar por que
            print("\n🔍 Investigando por que não detectou...")
            
            # Verifica se consegue buscar ticks
            ticks = await persistence.get_recent_ticks("ABEV3", 24)
            print(f"📊 Ticks encontrados: {len(ticks) if ticks else 0}")
            
            if ticks:
                print(f"   Primeiro tick: {ticks[0]['timestamp']}")
                print(f"   Último tick: {ticks[-1]['timestamp']}")
                print(f"   Exemplo de tick: {ticks[0]}")
        
        # 5. Testa análise de todos os símbolos
        print("\n🌐 Testando análise de todos os símbolos...")
        all_patterns = await detector.analyze_all_symbols()
        
        total_patterns = sum(len(patterns) for patterns in all_patterns.values())
        print(f"📊 Total de padrões detectados: {total_patterns}")
        
        if total_patterns > 0:
            print("✅ Sistema funcionando! Padrões detectados.")
        else:
            print("❌ Sistema não detectou nenhum padrão.")
            
    except Exception as e:
        print(f"💥 Erro durante teste: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Função principal"""
    print("=" * 60)
    print("🧪 TESTE DIRETO: Detector de Robôs")
    print("=" * 60)
    
    await test_detector_directly()
    
    print("\n" + "=" * 60)
    print("✅ Teste concluído!")
    print("=" * 60)

if __name__ == "__main__":
    # Configura event loop para Windows
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Executa teste
    asyncio.run(main())
