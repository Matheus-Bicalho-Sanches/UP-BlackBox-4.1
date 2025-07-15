"""
Teste do Sistema de Ordens Limitadas Sempre Ativas
==================================================
Demonstra como o sistema sempre mantém ordens no mercado conforme a posição e bandas.
"""

def simulate_active_orders_system():
    print("TESTE: Sistema de Ordens Limitadas Sempre Ativas")
    print("=" * 60)
    
    # Simulação de cenários sequenciais
    scenarios = [
        {
            "step": 1,
            "description": "Inicio - Sem posicao, sem ordem",
            "current_position": 0,
            "current_price": 137400,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "current_order": None,
            "expected_action": "Enviar ordem BUY LIMIT @ 137200"
        },
        {
            "step": 2,
            "description": "Ordem de compra ativa aguardando execucao",
            "current_position": 0,
            "current_price": 137350,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "current_order": {"side": "buy", "price": 137200, "id": "ORD001"},
            "expected_action": "Manter ordem (preco inalterado)"
        },
        {
            "step": 3,
            "description": "Bandas mudaram - atualizar ordem de compra",
            "current_position": 0,
            "current_price": 137300,
            "bb_lower": 137100,  # Banda inferior desceu
            "bb_middle": 137500,
            "current_order": {"side": "buy", "price": 137200, "id": "ORD001"},
            "expected_action": "Cancelar ORD001 e enviar nova BUY LIMIT @ 137100"
        },
        {
            "step": 4,
            "description": "Ordem de compra foi executada - agora tem posicao",
            "current_position": 1,  # Posição comprada
            "current_price": 137100,
            "bb_lower": 137100,
            "bb_middle": 137500,
            "current_order": None,  # Ordem foi executada
            "expected_action": "Enviar ordem SELL LIMIT @ 137500"
        },
        {
            "step": 5,
            "description": "Ordem de venda ativa aguardando execucao",
            "current_position": 1,
            "current_price": 137300,
            "bb_lower": 137150,
            "bb_middle": 137550,
            "current_order": {"side": "sell", "price": 137500, "id": "ORD002"},
            "expected_action": "Cancelar ORD002 e enviar nova SELL LIMIT @ 137550"
        },
        {
            "step": 6,
            "description": "Ordem de venda foi executada - zerrou posicao",
            "current_position": 0,  # Posição vendida
            "current_price": 137550,
            "bb_lower": 137150,
            "bb_middle": 137550,
            "current_order": None,  # Ordem foi executada
            "expected_action": "Enviar ordem BUY LIMIT @ 137150"
        }
    ]
    
    for scenario in scenarios:
        print(f"\nETAPA {scenario['step']}: {scenario['description']}")
        print("-" * 50)
        
        # Estado atual
        pos = scenario['current_position']
        price = scenario['current_price']
        bb_lower = scenario['bb_lower']
        bb_middle = scenario['bb_middle']
        current_order = scenario['current_order']
        
        print(f"Estado: Posicao: {pos} | Preco: {price} | BB: L={bb_lower} M={bb_middle}")
        
        if current_order:
            print(f"Ordem Ativa: {current_order['side'].upper()} @ {current_order['price']} | ID: {current_order['id']}")
        else:
            print("Ordem Ativa: Nenhuma")
        
        # Lógica do sistema
        if pos == 0:
            # Sem posição - precisa de ordem de compra
            if current_order and current_order['side'] == 'buy':
                # Verificar se preço mudou
                if abs(current_order['price'] - bb_lower) > 0.5:
                    action = f"Cancelar {current_order['id']} e enviar nova BUY LIMIT @ {bb_lower}"
                else:
                    action = "Manter ordem (preco inalterado)"
            else:
                action = f"Enviar ordem BUY LIMIT @ {bb_lower}"
        else:
            # Com posição - precisa de ordem de venda
            if current_order and current_order['side'] == 'sell':
                # Verificar se preço mudou
                if abs(current_order['price'] - bb_middle) > 0.5:
                    action = f"Cancelar {current_order['id']} e enviar nova SELL LIMIT @ {bb_middle}"
                else:
                    action = "Manter ordem (preco inalterado)"
            else:
                action = f"Enviar ordem SELL LIMIT @ {bb_middle}"
        
        print(f"Acao do Sistema: {action}")
        
        # Verificar se ação está correta
        expected = scenario['expected_action']
        if action == expected:
            print("Status: CORRETO")
        else:
            print(f"Status: ERRO - Esperado: {expected}")
    
    print(f"\n{'=' * 60}")
    print("RESUMO DO SISTEMA:")
    print("- SEM POSICAO: Sempre mantém ordem BUY LIMIT na banda inferior")
    print("- COM POSICAO: Sempre mantém ordem SELL LIMIT na média BB")
    print("- ATUALIZACAO: Cancela e reenvia se preço das bandas mudar > R$ 0,50")
    print("- VANTAGEM: Ordens sempre ativas, não perde oportunidades")
    print("- EXECUCAO: Automática quando preço atingir os níveis das bandas")
    print("=" * 60)

if __name__ == "__main__":
    simulate_active_orders_system() 