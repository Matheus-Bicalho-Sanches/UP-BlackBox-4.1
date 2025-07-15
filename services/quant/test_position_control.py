"""
Teste da Estratégia Mais Agressiva - Voltaamedia Bollinger
==========================================================
Demonstra a nova lógica: compra abaixo da banda inferior, vende apenas na média BB.
"""

# Simulação do comportamento da estratégia com diferentes cenários
def simulate_position_control():
    print("TESTE: Estrategia Mais Agressiva - Venda na Media BB")
    print("=" * 60)
    
    # Cenários de teste
    scenarios = [
        {
            "name": "Cenário 1: Preço abaixo da banda inferior - SEM POSIÇÃO",
            "current_price": 137100,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 0,
            "expected_max": 1,
            "should_buy": True
        },
        {
            "name": "Cenário 2: Preço abaixo da banda inferior - JÁ TEM 1 CONTRATO",
            "current_price": 137100,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 1,
            "expected_max": 1,
            "should_buy": False  # Posição máxima atingida
        },
        {
            "name": "Cenário 3: Preço na banda inferior - COM POSIÇÃO",
            "current_price": 137200,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 1,
            "expected_max": 1,
            "should_buy": False,
            "should_sell": False  # NÃO vende ainda - aguarda média BB
        },
        {
            "name": "Cenário 4: Preço entre banda inferior e média - COM POSIÇÃO", 
            "current_price": 137400,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 1,
            "expected_max": 1,
            "should_buy": False,
            "should_sell": False  # NÃO vende ainda - aguarda média BB
        },
        {
            "name": "Cenário 5: Preço na média BB - COM POSIÇÃO",
            "current_price": 137600,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 1,
            "expected_max": 0,
            "should_buy": False,
            "should_sell": True  # VENDE quando preço >= média BB
        },
        {
            "name": "Cenário 6: Preço acima da média BB - COM POSIÇÃO",
            "current_price": 137800,
            "bb_lower": 137200,
            "bb_middle": 137600,
            "bb_upper": 138000,
            "current_position": 1,
            "expected_max": 0,
            "should_buy": False,
            "should_sell": True  # VENDE quando preço >= média BB
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n{scenario['name']}")
        print("-" * 50)
        
        # Lógica de determinação da posição máxima
        current_price = scenario['current_price']
        bb_lower = scenario['bb_lower']
        bb_middle = scenario['bb_middle']
        bb_upper = scenario['bb_upper']
        current_qty = scenario['current_position']
        
        if current_price < bb_lower:
            max_position = 1
            condition = "< Banda Inferior"
        elif current_price < bb_middle:
            max_position = 1
            condition = "Entre Banda Inferior e Média"
        else:
            max_position = 0
            condition = ">= Média BB"
        
        # Status
        print(f"Status: Preco: {current_price} | BB: L={bb_lower} M={bb_middle} U={bb_upper}")
        print(f"Status: Posicao Atual: {current_qty} | Max Permitida: {max_position} ({condition})")
        
        # Decisões
        if current_price >= bb_middle and current_qty > 0:
            print(f"VENDA: Fechar {current_qty} contrato(s) - Preco >= media BB")
        elif current_qty < max_position:
            quantity_to_buy = max_position - current_qty
            print(f"COMPRA: {quantity_to_buy} contrato(s) - Total sera: {max_position}")
        else:
            if max_position > 0:
                print(f"AGUARDAR: Posicao maxima atingida ({current_qty}/{max_position})")
            else:
                print(f"SEM ACAO: Aguardando condicoes de compra")
        
        # Verificação
        expected = scenario['expected_max']
        if max_position == expected:
            print(f"CORRETO: Posicao maxima calculada corretamente ({max_position})")
        else:
            print(f"ERRO: Esperado {expected}, calculado {max_position}")
    
    print(f"\n{'=' * 60}")
    print("RESUMO DAS REGRAS (ESTRATEGIA MAIS AGRESSIVA):")
    print("- Preco < Banda Inferior -> Compra 1 contrato")
    print("- Preco >= Media BB -> Vende toda posicao")
    print("- Entre banda inferior e media -> Mantem posicao")
    print("- Maximo 1 contrato por vez")
    print("- Sistema evita compras repetidas quando posicao maxima atingida")
    print("=" * 60)

if __name__ == "__main__":
    simulate_position_control() 