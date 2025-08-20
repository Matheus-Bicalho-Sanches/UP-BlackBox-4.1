#!/usr/bin/env python3
"""
Script para criar uma nova estratégia no Firebase.
Execute este script para adicionar a estratégia 'precoCruzaMedia' ao sistema.
"""

import firebase_admin
from firebase_admin import firestore
import os

def criar_estrategia():
    """Cria a estratégia 'precoCruzaMedia' no Firebase."""
    
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
        return True
    
    # Conectar ao Firestore
    try:
        db = firestore.client()
    except Exception as e:
        print(f"❌ Erro ao conectar ao Firestore: {e}")
        return False
    
    # Dados da estratégia
    estrategia_data = {
        'nome': 'precoCruzaMedia',
        'descricao': 'Estratégia que compra quando o preço cruza acima da média móvel. Identifica momentos de reversão de tendência quando o preço rompe a resistência da média móvel.',
        'variaveis': 'param1: Período da média móvel (padrão: 3)\nparam2: Número de períodos para saída (padrão: 5)\nstop_loss: Stop loss percentual (padrão: -5%)\ntake_profit: Take profit percentual (padrão: +8%)',
        'resultados': 'Estratégia de momentum que aproveita movimentos de alta após cruzamento da média móvel. Funciona melhor em mercados com tendência definida.',
        'observacoes': 'Estratégia recomendada para ativos líquidos com tendência de alta. Evitar uso em mercados laterais ou de alta volatilidade. Pode ser combinada com filtros de volume para melhorar a qualidade dos sinais.'
    }
    
    try:
        # Verificar se a estratégia já existe
        estrategias_ref = db.collection('estrategias')
        docs = estrategias_ref.where('nome', '==', 'precoCruzaMedia').get()
        
        if docs:
            print("⚠️  A estratégia 'precoCruzaMedia' já existe no Firebase.")
            print("   Para atualizar, delete a existente primeiro ou modifique este script.")
            return False
        
        # Criar a estratégia
        doc_ref = estrategias_ref.document()
        doc_ref.set(estrategia_data)
        
        print("✅ Estratégia 'precoCruzaMedia' criada com sucesso no Firebase!")
        print(f"   ID: {doc_ref.id}")
        print("   Nome: precoCruzaMedia")
        print("   Descrição: Estratégia de cruzamento de média móvel")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar estratégia: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Criando estratégia 'precoCruzaMedia' no Firebase...")
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
