#!/usr/bin/env python3
"""
Teste de Instalação - Verifica se todas as dependências foram instaladas corretamente
"""

def test_imports():
    """Testa se todos os módulos necessários podem ser importados"""
    print("🧪 Testando importações...")
    
    try:
        import firebase_admin
        print("✅ firebase-admin: OK")
    except ImportError as e:
        print(f"❌ firebase-admin: ERRO - {e}")
        return False
    
    try:
        import numpy as np
        print(f"✅ numpy {np.__version__}: OK")
    except ImportError as e:
        print(f"❌ numpy: ERRO - {e}")
        return False
    
    try:
        import pandas as pd
        print(f"✅ pandas {pd.__version__}: OK")
    except ImportError as e:
        print(f"❌ pandas: ERRO - {e}")
        return False
    
    try:
        import aiohttp
        print(f"✅ aiohttp {aiohttp.__version__}: OK")
    except ImportError as e:
        print(f"❌ aiohttp: ERRO - {e}")
        return False
    
    try:
        import matplotlib
        print(f"✅ matplotlib {matplotlib.__version__}: OK")
    except ImportError as e:
        print(f"❌ matplotlib: ERRO - {e}")
        return False
    
    return True

def test_config():
    """Testa se o arquivo de configuração pode ser carregado"""
    print("\n📋 Testando configuração...")
    
    try:
        import json
        from pathlib import Path
        
        config_path = Path(__file__).parent / "config.json"
        
        if not config_path.exists():
            print("❌ config.json não encontrado!")
            return False
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        print("✅ config.json carregado com sucesso!")
        
        # Verificar configurações principais
        paper_trading = config.get("safety", {}).get("paper_trading_mode", True)
        print(f"📝 Paper Trading Mode: {'ATIVO' if paper_trading else 'DESATIVO'}")
        
        blackbox_url = config.get("system", {}).get("blackbox_api_url", "N/A")
        print(f"🔗 BlackBox API: {blackbox_url}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao carregar config.json: {e}")
        return False

def main():
    """Função principal do teste"""
    print("=" * 50)
    print("  TESTE DE INSTALAÇÃO - UP GESTORA QUANT ENGINE")
    print("=" * 50)
    
    # Testar importações
    imports_ok = test_imports()
    
    # Testar configuração
    config_ok = test_config()
    
    # Resultado final
    print("\n" + "=" * 50)
    if imports_ok and config_ok:
        print("🎉 INSTALAÇÃO OK! Todas as dependências estão funcionando.")
        print("\n📋 Próximos passos:")
        print("1. Configure as APIs (UP BlackBox na porta 8000)")
        print("2. Configure o Profit Feed (porta 8001)")
        print("3. Crie estratégias no frontend")
        print("4. Execute: start_quant_engine.bat")
    else:
        print("❌ INSTALAÇÃO COM PROBLEMAS!")
        print("\n💡 Tente:")
        print("1. Executar novamente install.bat como administrador")
        print("2. Verificar conexão com internet")
        print("3. Atualizar o Python para versão mais recente")
    
    print("=" * 50)

if __name__ == "__main__":
    main() 