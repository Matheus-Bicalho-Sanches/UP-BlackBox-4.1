#!/usr/bin/env python3
"""
Verificador de Status dos Serviços - UP Gestora Quant Engine
Verifica se todos os serviços necessários estão rodando
"""

import asyncio
import aiohttp
import sys
from pathlib import Path
import json
import firebase_admin
from firebase_admin import credentials, firestore

async def check_blackbox_api():
    """Verifica se a API do UP BlackBox está rodando"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    print("✅ UP BlackBox API (porta 8000): OK")
                    return True
                else:
                    print(f"❌ UP BlackBox API (porta 8000): Erro {response.status}")
                    return False
    except Exception as e:
        print(f"❌ UP BlackBox API (porta 8000): Não conectou - {e}")
        return False

async def check_profit_feed():
    """Verifica se o Profit Feed está rodando"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8001/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    print("✅ Profit Feed (porta 8001): OK")
                    return True
                else:
                    print(f"❌ Profit Feed (porta 8001): Erro {response.status}")
                    return False
    except Exception as e:
        print(f"❌ Profit Feed (porta 8001): Não conectou - {e}")
        return False

def check_firebase():
    """Verifica conexão com Firebase"""
    try:
        # Verificar se já está inicializado
        if not firebase_admin._apps:
            # Ajustar caminho conforme estrutura do projeto
            BASE_DIR = Path(__file__).resolve().parents[2]
            cred_path = BASE_DIR / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
            
            if not cred_path.exists():
                print(f"❌ Firebase: Credenciais não encontradas em {cred_path}")
                return False
            
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
        
        # Testar conexão
        db = firestore.client()
        
        # Tentar acessar uma coleção
        strategies_ref = db.collection('quantStrategies').limit(1)
        list(strategies_ref.stream())  # Força a execução da query
        
        print("✅ Firebase: Conectado")
        return True
        
    except Exception as e:
        print(f"❌ Firebase: Erro de conexão - {e}")
        return False

def check_market_data():
    """Verifica se há dados de mercado disponíveis"""
    try:
        if not firebase_admin._apps:
            return False
        
        db = firestore.client()
        
        # Verificar se há dados para WINQ25
        candles_ref = db.collection('marketDataDLL').document('WINQ25').collection('candles_1m').limit(1)
        docs = list(candles_ref.stream())
        
        if docs:
            print("✅ Dados de Mercado (WINQ25): Disponíveis")
            return True
        else:
            print("⚠️ Dados de Mercado (WINQ25): Nenhum candle encontrado")
            return False
            
    except Exception as e:
        print(f"❌ Dados de Mercado: Erro ao verificar - {e}")
        return False

def check_quant_strategies():
    """Verifica se há estratégias quant ativas"""
    try:
        if not firebase_admin._apps:
            return False
        
        db = firestore.client()
        
        # Verificar estratégias ativas
        strategies_ref = db.collection('quantStrategies').where('status', '==', True)
        docs = list(strategies_ref.stream())
        
        if docs:
            print(f"✅ Estratégias Quant: {len(docs)} ativa(s)")
            for doc in docs:
                data = doc.to_dict()
                print(f"   - {data.get('nome', 'N/A')}")
            return True
        else:
            print("⚠️ Estratégias Quant: Nenhuma estratégia ativa encontrada")
            return False
            
    except Exception as e:
        print(f"❌ Estratégias Quant: Erro ao verificar - {e}")
        return False

def check_config():
    """Verifica arquivo de configuração"""
    try:
        config_path = Path(__file__).parent / "config.json"
        
        if not config_path.exists():
            print("❌ Configuração: config.json não encontrado")
            return False
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        paper_trading = config.get("safety", {}).get("paper_trading_mode", True)
        print(f"✅ Configuração: OK (Paper Trading: {'ATIVO' if paper_trading else 'DESATIVO'})")
        return True
        
    except Exception as e:
        print(f"❌ Configuração: Erro ao carregar - {e}")
        return False

async def main():
    """Função principal"""
    print("=" * 60)
    print("  VERIFICADOR DE STATUS - UP GESTORA QUANT ENGINE")
    print("=" * 60)
    print()
    
    # Lista de verificações
    checks = [
        ("Configuração", check_config, False),
        ("Firebase", check_firebase, False),
        ("UP BlackBox API", check_blackbox_api, True),
        ("Profit Feed", check_profit_feed, True),
        ("Dados de Mercado", check_market_data, False),
        ("Estratégias Quant", check_quant_strategies, False),
    ]
    
    results = []
    
    for name, check_func, is_async in checks:
        print(f"🔍 Verificando {name}...")
        try:
            if is_async:
                result = await check_func()
            else:
                result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name}: Erro inesperado - {e}")
            results.append((name, False))
        print()
    
    # Resumo
    print("=" * 60)
    print("  RESUMO")
    print("=" * 60)
    
    all_ok = True
    for name, success in results:
        status = "OK" if success else "PROBLEMA"
        icon = "✅" if success else "❌"
        print(f"{icon} {name}: {status}")
        if not success:
            all_ok = False
    
    print()
    if all_ok:
        print("🎉 TODOS OS SERVIÇOS ESTÃO FUNCIONANDO!")
        print("✅ Você pode iniciar o Quant Engine com: start_quant_engine.bat")
    else:
        print("⚠️ ALGUNS SERVIÇOS TÊM PROBLEMAS")
        print("📖 Consulte TROUBLESHOOTING.md para soluções")
        print()
        print("📋 Sequência recomendada:")
        print("1. Inicie UP BlackBox 4.0: cd 'UP BlackBox 4.0' && python main.py")
        print("2. Inicie Profit Feed: cd services\\profit && python dispatcher.py")
        print("3. Aguarde 1-2 minutos para dados de mercado")
        print("4. Execute este verificador novamente")
    
    print("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Verificação cancelada pelo usuário") 