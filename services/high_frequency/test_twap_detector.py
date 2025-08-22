#!/usr/bin/env python3
"""
Teste do Detector TWAP
======================
Script para testar a detecção de robôs TWAP
"""

import asyncio
import os
import sys
from pathlib import Path

# Configuração do event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o projeto ao path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv()

from services.high_frequency.robot_detector import TWAPDetector
from services.high_frequency.robot_models import TWAPDetectionConfig

async def test_twap_detection():
    """Testa a detecção TWAP"""
    print("🧪 TESTANDO DETECTOR TWAP")
    print("=" * 50)
    
    try:
        # Cria detector com configuração personalizada para teste
        config = TWAPDetectionConfig(
            min_trades=5,  # Reduzido para teste
            min_total_volume=50000,  # Reduzido para teste
            min_confidence=0.4  # Reduzido para teste
        )
        
        detector = TWAPDetector(config)
        print("✅ Detector TWAP criado com sucesso")
        
        # Testa análise de símbolos específicos
        test_symbols = ['PETR4', 'VALE3', 'ITUB4']
        
        for symbol in test_symbols:
            print(f"\n🔍 Analisando {symbol}...")
            
            try:
                patterns = await detector.analyze_symbol(symbol)
                
                if patterns:
                    print(f"  ✅ Detectados {len(patterns)} padrões TWAP")
                    for i, pattern in enumerate(patterns, 1):
                        print(f"    Padrão {i}:")
                        print(f"      - Agente: {pattern.agent_id}")
                        print(f"      - Confiança: {pattern.confidence_score:.2f}")
                        print(f"      - Trades: {pattern.total_trades}")
                        print(f"      - Volume: {pattern.total_volume:,}")
                        print(f"      - Frequência: {pattern.frequency_minutes:.1f} min")
                        print(f"      - Status: {pattern.status.value}")
                else:
                    print(f"  ⚠️  Nenhum padrão TWAP detectado")
                    
            except Exception as e:
                print(f"  ❌ Erro ao analisar {symbol}: {e}")
        
        # Testa análise de todos os símbolos
        print(f"\n🌐 Analisando todos os símbolos ativos...")
        try:
            all_patterns = await detector.analyze_all_symbols()
            
            total_patterns = sum(len(patterns_list) for patterns_list in all_patterns.values())
            print(f"  ✅ Total de padrões detectados: {total_patterns}")
            print(f"  📊 Símbolos com padrões: {len(all_patterns)}")
            
            for symbol, patterns in all_patterns.items():
                print(f"    {symbol}: {len(patterns)} padrões")
                
        except Exception as e:
            print(f"  ❌ Erro na análise geral: {e}")
        
        # Testa limpeza de dados antigos
        print(f"\n🧹 Testando limpeza de dados antigos...")
        try:
            await detector.cleanup_old_data()
            print("  ✅ Limpeza concluída")
        except Exception as e:
            print(f"  ❌ Erro na limpeza: {e}")
        
        print(f"\n🎯 Teste concluído!")
        
    except Exception as e:
        print(f"❌ Erro geral no teste: {e}")
        import traceback
        traceback.print_exc()

async def test_persistence():
    """Testa a persistência de dados"""
    print("\n💾 TESTANDO PERSISTÊNCIA")
    print("=" * 50)
    
    try:
        from services.high_frequency.robot_persistence import RobotPersistence
        
        persistence = RobotPersistence()
        print("✅ Persistência criada com sucesso")
        
        # Testa busca de símbolos ativos
        print("\n🔍 Buscando símbolos ativos...")
        symbols = []
        try:
            symbols = await persistence.get_active_symbols()
            print(f"  ✅ Símbolos ativos: {len(symbols)}")
            for symbol in symbols[:5]:  # Mostra apenas os primeiros 5
                print(f"    - {symbol}")
            if len(symbols) > 5:
                print(f"    ... e mais {len(symbols) - 5}")
                
        except Exception as e:
            print(f"  ❌ Erro ao buscar símbolos: {e}")
        
        # Testa busca de ticks recentes
        if symbols:
            test_symbol = symbols[0]
            print(f"\n📊 Buscando ticks recentes para {test_symbol}...")
            try:
                ticks = await persistence.get_recent_ticks(test_symbol, 1)  # Última hora
                print(f"  ✅ Ticks encontrados: {len(ticks)}")
                if ticks:
                    print(f"    Primeiro tick: {ticks[0]['timestamp']}")
                    print(f"    Último tick: {ticks[-1]['timestamp']}")
                    
            except Exception as e:
                print(f"  ❌ Erro ao buscar ticks: {e}")
        else:
            print("\n⚠️  Nenhum símbolo ativo encontrado para testar ticks")
        
        print(f"\n💾 Teste de persistência concluído!")
        
    except Exception as e:
        print(f"❌ Erro no teste de persistência: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Função principal"""
    print("🚀 INICIANDO TESTES DO DETECTOR TWAP")
    print("=" * 60)
    
    # Testa persistência primeiro
    await test_persistence()
    
    # Testa detector
    await test_twap_detection()
    
    print("\n" + "=" * 60)
    print("🎉 TODOS OS TESTES CONCLUÍDOS!")

if __name__ == "__main__":
    asyncio.run(main())
