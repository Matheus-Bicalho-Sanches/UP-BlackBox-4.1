#!/usr/bin/env python3
"""
Script para criar uma nova estratégia no Firebase.
Execute este script para adicionar a estratégia 'predictCandle' ao sistema.
"""

import firebase_admin
from firebase_admin import firestore
import os

def criar_estrategia():
    """Cria a estratégia 'predictCandle' no Firebase."""
    
    # Inicializar Firebase Admin usando o mesmo método do projeto
    try:
        # Se já estiver inicializado, não faz nada
        firebase_admin.get_app()
        print("✅ Firebase já estava inicializado")
    except ValueError:
        # Se não estiver inicializado, inicializa usando as variáveis de ambiente
        try:
            from firebase_admin_init import db
            print("✅ Firebase inicializado usando variáveis de ambiente")
        except Exception as e:
            print(f"❌ Erro ao inicializar Firebase: {e}")
            print("   Verifique se o arquivo .env está configurado corretamente")
            return False
    
    # Conectar ao Firestore
    try:
        db = firestore.client()
    except Exception as e:
        print(f"❌ Erro ao conectar ao Firestore: {e}")
        return False
    
    # Dados da estratégia
    estrategia_data = {
        'nome': 'predictCandle',
        'descricao': 'Estratégia que compra na abertura de um candle quando o candle anterior teve variação entre Y% e W% (faixa inclusiva). Mantém a posição por até X candles, verificando stop loss e take profit. Vende no fechamento do X-ésimo candle ou antes se atingir stop/take profit.',
        'variaveis': 'Y: Percentual mínimo de variação no candle anterior para gerar sinal de compra (padrão: 2%). Pode ser negativo.\nW: Percentual máximo de variação no candle anterior para gerar sinal de compra (padrão: 10%). Pode ser negativo.\nX: Número máximo de candles para manter a posição (padrão: 1)\nstop_loss: Stop loss percentual (padrão: -5%)\ntake_profit: Take profit percentual (padrão: +8%)',
        'resultados': 'Estratégia que aproveita variações específicas no candle anterior para prever movimento no candle seguinte. Permite definir faixas de variação (ex: entre 2% e 10%, ou entre -5% e -1% para quedas moderadas). Funciona bem em mercados com padrões de movimento consistentes.',
        'observacoes': 'Quando X = 1, a estratégia opera intradiariamente (compra na abertura e vende no fechamento do mesmo candle). Valores maiores de X permitem manter a posição por mais tempo. Se Y = W, compra apenas quando a variação for exatamente igual a esse valor. Recomendado para ativos com boa liquidez e movimentos previsíveis.'
    }
    
    try:
        # Verificar se a estratégia já existe
        estrategias_ref = db.collection('estrategias')
        docs = estrategias_ref.where('nome', '==', 'predictCandle').get()
        
        if docs:
            print("⚠️  A estratégia 'predictCandle' já existe no Firebase.")
            print("   Para atualizar, delete a existente primeiro ou modifique este script.")
            return False
        
        # Criar a estratégia
        doc_ref = estrategias_ref.document()
        doc_ref.set(estrategia_data)
        
        print("✅ Estratégia 'predictCandle' criada com sucesso no Firebase!")
        print(f"   ID: {doc_ref.id}")
        print("   Nome: predictCandle")
        print("   Descrição: Estratégia de previsão baseada em alta do candle anterior")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar estratégia: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Criando estratégia 'predictCandle' no Firebase...")
    print("=" * 50)
    
    sucesso = criar_estrategia()
    
    if sucesso:
        print("\n🎉 Estratégia criada com sucesso!")
        print("\n📋 Próximos passos:")
        print("1. Reinicie o backend FastAPI (UP BlackBox 2.0/main.py)")
        print("2. A estratégia aparecerá na lista de estratégias disponíveis")
        print("3. Execute um backtest para testar a estratégia")
    else:
        print("\n❌ Falha ao criar a estratégia.")
        print("   Verifique as credenciais do Firebase e tente novamente.")

