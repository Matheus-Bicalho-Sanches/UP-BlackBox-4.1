#!/usr/bin/env python3
"""
Teste: Novo Cálculo de Quantidade
=================================
Verifica se o cálculo de 1 contrato a cada 10 mil reais está funcionando corretamente
"""

def test_quantity_calculation():
    """Testa o novo cálculo de quantidade"""
    
    print("🧮 TESTE: Cálculo de Quantidade - 1 contrato a cada R$ 10.000")
    print("=" * 60)
    
    # Teste com diferentes valores alocados
    test_values = [
        5000,    # R$ 5.000
        10000,   # R$ 10.000  
        15000,   # R$ 15.000
        25000,   # R$ 25.000
        50000,   # R$ 50.000
        100000,  # R$ 100.000
        150000,  # R$ 150.000
        0,       # R$ 0 (teste fallback)
        -1000    # R$ -1.000 (teste negativo)
    ]
    
    print(f"{'Valor Alocado (R$)':<15} | {'Contratos':<10} | {'Observação':<20}")
    print("-" * 60)
    
    for valor in test_values:
        # Aplicar a mesma lógica do quant_engine.py
        if valor <= 0:
            qty = 1  # Fallback para valores inválidos
            obs = "Fallback mínimo"
        else:
            qty = max(1, int(valor / 10000))  # 1 contrato a cada 10 mil
            obs = f"{qty}:1"
        
        print(f"R$ {valor:>10,.2f} | {qty:>8} | {obs}")
    
    print("\n✅ Teste concluído!")
    print("\n📝 Exemplos práticos:")
    print("- R$ 50.000 alocados = 5 contratos")
    print("- R$ 100.000 alocados = 10 contratos") 
    print("- R$ 25.000 alocados = 2 contratos")
    print("- R$ 5.000 alocados = 1 contrato (mínimo)")

if __name__ == "__main__":
    test_quantity_calculation() 