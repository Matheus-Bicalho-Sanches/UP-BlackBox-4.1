# Correção: Tamanho de Posição da Estratégia

## Problema Identificado

A estratégia Bollinger Bands estava usando quantidade base **hardcoded** de 1 contrato, ignorando a configuração `tamanho_position` da estratégia no Firebase.

**Resultado observado:**
- Ordem original: 8 contratos total (5+2+1)
- Ordem editada: 8 contratos total, mas com quantidade base 1 enviada para edição
- **Problema**: Quantidade não respeitava configuração da estratégia

## Como Funciona o Sistema de Quantidades

### 1. Quantidade Base (Estratégia → API)
- **tamanho_position**: Configuração da estratégia no Firebase
- **Antes**: `quantity=1` (hardcoded)
- **Depois**: `quantity=int(strategy.tamanho_position)`

### 2. Distribuição Proporcional (UP BlackBox)
```python
# Para cada conta:
fator = valor_investido / 10000
qty_calc = max(1, int(quantity_base * fator))
```

**Exemplo com Base=1:**
- Conta A (R$ 50.000): 1 × 5.0 = 5 contratos
- Conta B (R$ 20.000): 1 × 2.0 = 2 contratos  
- Conta C (R$ 10.000): 1 × 1.0 = 1 contrato
- **Total: 8 contratos**

**Exemplo com Base=10:**
- Conta A (R$ 50.000): 10 × 5.0 = 50 contratos
- Conta B (R$ 20.000): 10 × 2.0 = 20 contratos
- Conta C (R$ 10.000): 10 × 1.0 = 10 contratos
- **Total: 80 contratos**

## Correção Implementada

### Código Alterado

**services/quant/quant_engine.py - Linha 745-755:**

```python
# ANTES
if current_qty == 0:
    await self.manage_active_order(
        strategy=strategy,
        ticker=ticker,
        side="buy",
        quantity=1,  # ← HARDCODED!
        target_price=bands['lower'],
        order_type="buy_limit",
        reason=f"Ordem de compra aguardando preço atingir banda inferior"
    )

# DEPOIS  
# Calcular quantidade base da estratégia
base_quantity = int(strategy.tamanho_position) if strategy.tamanho_position > 0 else 1

if current_qty == 0:
    await self.manage_active_order(
        strategy=strategy,
        ticker=ticker,
        side="buy",
        quantity=base_quantity,  # ← USANDO CONFIGURAÇÃO!
        target_price=bands['lower'],
        order_type="buy_limit",
        reason=f"Ordem de compra aguardando preço atingir banda inferior"
    )
```

### Logs Melhorados

**Antes:**
```
📊 Voltaamedia_Bollinger_1min_WINQ25 | WINQ25 | Preço: 136855.00 | BB: L=136821.94 M=136849.29 U=136876.63 | Posição: 0 | Ordem: BUY @ 136817.73
```

**Depois:**
```
📊 Voltaamedia_Bollinger_1min_WINQ25 | WINQ25 | Preço: 136855.00 | BB: L=136821.94 M=136849.29 U=136876.63 | Posição: 0 | Base Qty: 10 | Ordem: BUY @ 136817.73
```

## Configuração da Estratégia

### Firebase - Coleção `quantStrategies`

```json
{
  "nome": "Voltaamedia_Bollinger_1min_WINQ25",
  "status": true,
  "carteiraBlackBox": "master-estrategia",
  "tamanhoPosition": 10.0,  // ← Quantidade base (10 contratos)
  "createdAt": "2025-01-15T...",
  "updatedAt": "2025-01-15T..."
}
```

### Frontend - Interface de Criação

Ao criar/editar estratégia no frontend:
1. **Nome**: `Voltaamedia_Bollinger_1min_WINQ25`
2. **Carteira BlackBox**: Selecionar carteira existente
3. **Tamanho Posição**: `10` (contratos base)
4. **Status**: ✅ Ativo

## Resultado

- ✅ **Quantidade respeitada**: Sistema usa `tamanho_position` da configuração
- ✅ **Distribuição proporcional**: Cada conta recebe quantidade baseada no valor investido
- ✅ **Edição consistente**: Ordens editadas mantêm a mesma base configurada
- ✅ **Logs informativos**: Mostra claramente a quantidade base sendo usada

## Teste

Para verificar se a correção funciona:

1. **Configure a estratégia** com `tamanhoPosition: 5`
2. **Execute o Quant Engine**
3. **Verifique nos logs**: `Base Qty: 5`
4. **Confirme distribuição**:
   - Se conta tem R$ 50.000: recebe 5 × 5 = 25 contratos
   - Se conta tem R$ 10.000: recebe 5 × 1 = 5 contratos

## Compatibilidade

- ✅ **Estratégias existentes**: Funciona com `tamanhoPosition` atual
- ✅ **Fallback seguro**: Se `tamanhoPosition = 0`, usa `quantity = 1`
- ✅ **Edição de ordens**: Mantém consistência com a configuração
- ✅ **Logs detalhados**: Mostra quantidade base nos logs para debug 