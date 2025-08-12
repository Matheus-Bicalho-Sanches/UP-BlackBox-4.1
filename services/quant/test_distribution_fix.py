#!/usr/bin/env python3
"""
Teste: Correção da Distribuição
===============================
Testa a nova lógica de distribuição proporcional para vendas
"""

def test_distribution_logic():
    """Testa a nova lógica de distribuição"""
    
    print("🧮 TESTE: Nova Lógica de Distribuição")
    print("=" * 50)
    
    # Dados das alocações
    allocations = [
        {"account_id": "103143347", "valor_investido": 20000},
        {"account_id": "103143349", "valor_investido": 50000},
        {"account_id": "103143350", "valor_investido": 17000}
    ]
    
    total_valor_investido = sum(alloc["valor_investido"] for alloc in allocations)
    
    print(f"📊 Total Investido: R$ {total_valor_investido:,.2f}")
    print()
    
    # Teste COMPRA (quantidade base = 10)
    print("📈 TESTE COMPRA (quantity = 10):")
    print("-" * 30)
    
    for alloc in allocations:
        valor_inv = alloc["valor_investido"]
        fator = valor_inv / 10000
        qty_calc = max(1, int(10 * fator))
        print(f"Conta {alloc['account_id']}: 10 × {fator:.2f} = {qty_calc} contratos")
    
    print()
    
    # Teste VENDA (quantidade total = 515)
    print("📉 TESTE VENDA (quantity = 515):")
    print("-" * 30)
    
    for alloc in allocations:
        valor_inv = alloc["valor_investido"]
        proporcao = valor_inv / total_valor_investido
        qty_calc = max(1, int(515 * proporcao))
        print(f"Conta {alloc['account_id']}: 515 × {proporcao:.2f} = {qty_calc} contratos")
    
    print()
    print("✅ RESULTADO ESPERADO:")
    print("- COMPRA: 20 + 50 + 17 = 87 contratos")
    print("- VENDA: 118 + 295 + 100 = 513 contratos (≈ 515)")
    print()
    print("📝 A correção deve resolver o problema de quantidades excessivas em vendas!")

if __name__ == "__main__":
    test_distribution_logic() 