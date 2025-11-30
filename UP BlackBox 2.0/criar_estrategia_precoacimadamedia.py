#!/usr/bin/env python3
"""
Script para criar a estratégia 'PrecoAcimadaMedia' no Firebase.
Execute este script para adicionar a estratégia ao sistema.
"""

import firebase_admin
from firebase_admin import firestore
import os

def criar_estrategia():
    """Cria a estratégia 'PrecoAcimadaMedia' no Firebase."""
    
    # Inicializar Firebase Admin usando o mesmo método do projeto
    try:
        # Se já estiver inicializado, não faz nada
        firebase_admin.get_app()
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
        'nome': 'PrecoAcimadaMedia',
        'descricao': 'Estratégia que compra quando o preço está acima da média móvel aritmética e mantém a posição enquanto o preço permanecer acima da média. Vende quando o preço cair abaixo da média, atingir stop loss ou take profit. Inclui parâmetro de cooldown para evitar compras/vendas em sequência quando o preço está muito próximo da média.',
        'variaveis': 'x: Períodos da média móvel aritmética (padrão: 20)\nstop_loss: Stop loss percentual (padrão: -5%)\ntake_profit: Take profit percentual (padrão: +8%)\ncooldown: Períodos de espera após uma saída antes de permitir nova entrada (padrão: 0)',
        'resultados': 'Estratégia de tendência que aproveita movimentos de alta mantendo posição enquanto o preço está acima da média. O cooldown ajuda a evitar whipsaws quando o preço oscila em torno da média.',
        'observacoes': 'Estratégia recomendada para ativos com tendência de alta definida. O parâmetro de cooldown é especialmente útil quando o preço está muito próximo da média, evitando múltiplas entradas e saídas em sequência. Funciona melhor em mercados com tendência clara. Evitar uso em mercados laterais ou de alta volatilidade sem ajuste adequado do cooldown.'
    }
    
    try:
        # Verificar se a estratégia já existe
        estrategias_ref = db.collection('estrategias')
        docs = estrategias_ref.where('nome', '==', 'PrecoAcimadaMedia').get()
        
        if docs:
            print("⚠️  A estratégia 'PrecoAcimadaMedia' já existe no Firebase.")
            print("   Para atualizar, delete a existente primeiro ou modifique este script.")
            return False
        
        # Criar a estratégia
        doc_ref = estrategias_ref.document()
        doc_ref.set(estrategia_data)
        
        print("✅ Estratégia 'PrecoAcimadaMedia' criada com sucesso no Firebase!")
        print(f"   ID: {doc_ref.id}")
        print("   Nome: PrecoAcimadaMedia")
        print("   Descrição: Estratégia de preço acima da média móvel com cooldown")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar estratégia: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Criando estratégia 'PrecoAcimadaMedia' no Firebase...")
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

