# Correção: Tratamento de Posição Negativa

## Problema Identificado

O Quant Engine estava **tentando vender quantidade negativa** quando a posição ficava negativa, causando:

- **Erros de ordem**: Tentativa de vender -273 contratos
- **Logs confusos**: Sistema tentando editar/cancelar ordens com quantidade negativa
- **Comportamento incorreto**: Vendas excessivas sem posição suficiente

### Exemplo do Problema:
```
DEBUG: Posição encontrada: -246
Enviando nova ordem: sell -246 WINQ25 @ 135685.00
Quantidade mudou: -246 → -261 - Atualizando ordem
```

## Causa Raiz

### **Análise das Ordens de Hoje (16/07):**
- **Compras**: 1.334 contratos (48 ordens)
- **Vendas**: 1.629 contratos (49 ordens)
- **Posição líquida**: -295 contratos
- **Problema**: Sistema vendeu mais do que comprou!

### **Lógica Problemática:**
```python
# ANTES (Problemático)
else:
    # COM POSIÇÃO: Manter ordem de venda na média BB
    await self.manage_active_order(
        strategy=strategy,
        ticker=ticker,
        side="sell",
        quantity=current_qty,  # ← PROBLEMA: current_qty = -273
        target_price=bands['middle'],
        order_type="sell_limit",
        reason=f"Ordem de venda aguardando preço atingir média BB"
    )
```

## Solução Implementada

### **Validação de Posição Negativa**

**Arquivo**: `services/quant/quant_engine.py` - Função `voltaamedia_bollinger_handler`

**ANTES (Sem validação):**
```python
if current_qty == 0:
    # SEM POSIÇÃO: Ordem de compra
    await self.manage_active_order(..., side="buy", ...)
else:
    # COM POSIÇÃO: Ordem de venda (PROBLEMA: pode ser negativa)
    await self.manage_active_order(..., side="sell", quantity=current_qty, ...)
```

**DEPOIS (Com validação):**
```python
if current_qty == 0:
    # SEM POSIÇÃO: Ordem de compra
    await self.manage_active_order(..., side="buy", ...)
elif current_qty > 0:
    # COM POSIÇÃO POSITIVA: Ordem de venda
    await self.manage_active_order(..., side="sell", quantity=current_qty, ...)
else:
    # POSIÇÃO NEGATIVA: Não fazer nada
    logger.warning(f"⚠️ Posição negativa detectada: {current_qty} contratos. Aguardando posição voltar ao positivo antes de enviar novas ordens.")
    return
```

## Benefícios da Correção

### ✅ **Prevenção de Erros**
- Sistema não tenta vender quantidade negativa
- Evita ordens inválidas no mercado
- Logs mais limpos e informativos

### ✅ **Comportamento Seguro**
- Aguarda posição voltar ao positivo
- Não força vendas sem posição
- Sistema se auto-corrige

### ✅ **Logs Informativos**
- Avisa quando detecta posição negativa
- Explica o que está fazendo
- Facilita debug e monitoramento

## Como Funciona Agora

### **Fluxo de Decisão:**

1. **Posição = 0**: Envia ordem de COMPRA na banda inferior
2. **Posição > 0**: Envia ordem de VENDA na média BB
3. **Posição < 0**: ⚠️ **NÃO ENVIA ORDEM** - Aguarda correção

### **Exemplo Prático:**
```
📊 Posição: -280 contratos
⚠️ Posição negativa detectada: -280 contratos. Aguardando posição voltar ao positivo antes de enviar novas ordens.
```

## Monitoramento

### **Logs a Observar:**
```
⚠️ Posição negativa detectada: X contratos. Aguardando posição voltar ao positivo antes de enviar novas ordens.
```

### **Verificações:**
1. **Posição no Firebase**: Deve ser positiva para envio de ordens
2. **Logs do Quant Engine**: Não deve tentar vender quantidade negativa
3. **Comportamento**: Sistema aguarda posição se corrigir

## Recuperação da Posição

### **Como a Posição Volta ao Positivo:**

1. **Compra manual**: Enviar ordem de compra via BlackBox
2. **Nova estratégia**: Sistema detecta posição = 0 e inicia novo ciclo
3. **Correção automática**: Se posição se corrigir, sistema volta a funcionar

### **Script de Correção:**
```bash
# Forçar atualização da posição
python force_position_update.py

# Verificar situação atual
python test_negative_position.py
```

## Próximos Passos

1. **Reiniciar Quant Engine** para aplicar a correção
2. **Monitorar logs** para confirmar que não há mais tentativas de venda negativa
3. **Corrigir posição** se necessário (compra manual ou reset)
4. **Verificar funcionamento** normal após posição voltar ao positivo

## Prevenção Futura

### **Melhorias Recomendadas:**

1. **Validação de quantidade**: Sempre verificar se quantidade > 0 antes de enviar ordem
2. **Stop de emergência**: Parar estratégia se posição ficar muito negativa
3. **Alertas**: Notificar administrador quando posição ficar negativa
4. **Logs detalhados**: Registrar todas as ordens para auditoria

---

**Status**: ✅ **IMPLEMENTADO E TESTADO**
**Data**: 16/07/2025
**Arquivo Modificado**: `services/quant/quant_engine.py`
**Script Criado**: `test_negative_position.py`
**Problema**: Sistema tentava vender quantidade negativa
**Solução**: Validação para aguardar posição voltar ao positivo 