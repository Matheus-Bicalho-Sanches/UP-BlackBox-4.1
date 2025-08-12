# 🔧 Correção: Distribuição de Vendas - Proporcional vs Multiplicativa

## 📅 Data da Correção
16 de Janeiro de 2025

## 🚨 Problema Identificado

### **Sintomas nos Logs:**
```
📤 Enviando nova ordem: sell 515 WINQ25 @ 135785.00
📋 Master Batch enviado: 3 ordens | sell WINQ25 @ 135785.00
  ✅ Conta 103143349: ID 1425071611533484 | Qtd: 2575
  ✅ Conta 103143347: ID 1425071611533485 | Qtd: 1030
  ✅ Conta 103143350: ID 1425071611533486 | Qtd: 875
```

**Problema**: Quantidades das contas (2575+1030+875=4480) muito maiores que a posição (515)

### **Causa Raiz:**

O BlackBox estava usando a **mesma lógica** para compra e venda:
```python
# LÓGICA ANTIGA (ERRADA)
fator = valor_investido / 10000
qty_calc = max(1, int(quantity * fator))
```

**Para COMPRA (quantidade base = 10):**
- Conta 103143349: `10 × 5.0 = 50 contratos` ✅ CORRETO
- Conta 103143347: `10 × 2.0 = 20 contratos` ✅ CORRETO
- Conta 103143350: `10 × 1.7 = 17 contratos` ✅ CORRETO
- **Total: 87 contratos** ✅ CORRETO

**Para VENDA (quantidade total = 515):**
- Conta 103143349: `515 × 5.0 = 2575 contratos` ❌ ERRADO
- Conta 103143347: `515 × 2.0 = 1030 contratos` ❌ ERRADO
- Conta 103143350: `515 × 1.7 = 875 contratos` ❌ ERRADO
- **Total: 4480 contratos** ❌ ERRADO

## 🛠️ Solução Implementada

### **Nova Lógica no BlackBox (`UP BlackBox 4.0/main.py`):**

```python
# LÓGICA NOVA (CORRETA)
if side.lower() == "buy":
    # COMPRA: Multiplicar quantidade base pelos fatores
    fator = valor_inv / 10000
    qty_calc = max(1, int(math.floor(quantity * fator)))
else:
    # VENDA: Distribuir quantidade total proporcionalmente
    proporcao = valor_inv / total_valor_investido
    qty_calc = max(1, int(math.floor(quantity * proporcao)))
```

### **Resultado Esperado:**

**Para COMPRA (quantidade base = 10):**
- Conta 103143349: `10 × 5.0 = 50 contratos` ✅
- Conta 103143347: `10 × 2.0 = 20 contratos` ✅
- Conta 103143350: `10 × 1.7 = 17 contratos` ✅
- **Total: 87 contratos** ✅

**Para VENDA (quantidade total = 515):**
- Conta 103143349: `515 × 0.57 = 295 contratos` ✅
- Conta 103143347: `515 × 0.23 = 118 contratos` ✅
- Conta 103143350: `515 × 0.20 = 100 contratos` ✅
- **Total: 513 contratos** ✅ (≈ 515)

## 📊 **Fluxo Correto Esperado**

### **1. Compra (Posição = 0):**
1. Quant Engine: Envia `quantity = 10` (base)
2. BlackBox: Multiplica pelos fatores:
   - Conta 103143349: `10 × 5.0 = 50 contratos`
   - Conta 103143347: `10 × 2.0 = 20 contratos`
   - Conta 103143350: `10 × 1.7 = 17 contratos`
3. **Total enviado: 87 contratos**
4. **Posição esperada após execução: 87 contratos**

### **2. Venda (Posição = 87):**
1. Quant Engine: Envia `quantity = 87` (posição total)
2. BlackBox: Distribui proporcionalmente:
   - Conta 103143349: `87 × (50/87) = 50 contratos`
   - Conta 103143347: `87 × (20/87) = 20 contratos`
   - Conta 103143350: `87 × (17/87) = 17 contratos`
3. **Total enviado: 87 contratos**
4. **Posição esperada após execução: 0 contratos**

## 🔧 **Arquivos Modificados**

### **1. `UP BlackBox 4.0/main.py` (Linha ~315-330)**
```python
# ANTES
for alloc in allocations:
    valor_inv = float(alloc.get("valor_investido", 0))
    fator = valor_inv / 10000
    qty_calc = max(1, int(math.floor(quantity * fator)))

# DEPOIS
for alloc in allocations:
    valor_inv = float(alloc.get("valor_investido", 0))
    
    if side.lower() == "buy":
        # COMPRA: Multiplicar quantidade base pelos fatores
        fator = valor_inv / 10000
        qty_calc = max(1, int(math.floor(quantity * fator)))
    else:
        # VENDA: Distribuir quantidade total proporcionalmente
        proporcao = valor_inv / total_valor_investido
        qty_calc = max(1, int(math.floor(quantity * proporcao)))
```

## ⚠️ **Próximos Passos**

1. **Reiniciar o BlackBox** para aplicar a correção
2. **Reiniciar o Quant Engine** 
3. **Monitorar logs** para verificar se quantidades estão corretas
4. **Testar ciclo completo**: compra → venda → zeragem

## 📝 **Notas Técnicas**

- **COMPRA**: Usa fatores baseados em R$ 10.000 (como antes)
- **VENDA**: Usa proporção baseada no valor total investido
- **Compatibilidade**: Mantém comportamento anterior para compras
- **Logs**: Agora diferenciam entre COMPRA e VENDA nos logs do BlackBox
- **Segurança**: Mantém mínimo de 1 contrato por conta

## 🎯 **Benefícios**

1. **Quantidades Corretas**: Vendas agora respeitam a posição total
2. **Zeragem Preciso**: Sistema pode zerar posições corretamente
3. **Logs Claros**: Diferenciação entre compra e venda nos logs
4. **Compatibilidade**: Não quebra funcionalidade existente
5. **Escalabilidade**: Funciona com qualquer número de contas 