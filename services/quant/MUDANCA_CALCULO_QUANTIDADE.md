# 🔧 Mudança: Cálculo de Quantidade - Valor Alocado vs Quantidade Fixa

## 📅 Data da Mudança
16 de Janeiro de 2025

## 🎯 Objetivo
Alterar o cálculo de quantidade de contratos da estratégia `Voltaamedia_Bollinger_1min_WINQ25` de **quantidade fixa** para **1 contrato a cada R$ 10.000,00 alocados**.

## 📊 Impacto da Mudança

### Antes (Quantidade Fixa)
- **`tamanhoPosition`**: Quantidade direta de contratos (ex: 10 = 10 contratos)
- **Cálculo simples**: `base_quantity = int(strategy.tamanho_position)`
- **Flexibilidade limitada**: Precisa alterar manualmente para diferentes alocações

### Depois (Valor Alocado)
- **`tamanhoPosition`**: Valor em reais alocado na estratégia (ex: 100000 = R$ 100.000)
- **Cálculo dinâmico**: `base_quantity = max(1, int(valor_alocado / 10000))`
- **Flexibilidade total**: Ajusta automaticamente baseado no valor alocado

## 📈 Exemplos de Cálculo

| Valor Alocado (R$) | Contratos Calculados | Observação |
|-------------------|---------------------|------------|
| R$ 5.000          | 1 contrato          | Mínimo garantido |
| R$ 10.000         | 1 contrato          | 1:1 |
| R$ 25.000         | 2 contratos         | Arredondamento para baixo |
| R$ 50.000         | 5 contratos         | 5:1 |
| R$ 100.000        | 10 contratos        | 10:1 |
| R$ 150.000        | 15 contratos        | 15:1 |

## 🔧 Arquivos Modificados

### 1. `quant_engine.py` (Linha ~748)
```python
# ANTES
base_quantity = int(strategy.tamanho_position) if strategy.tamanho_position > 0 else 1

# DEPOIS
valor_alocado = strategy.tamanho_position
base_quantity = max(1, int(valor_alocado / 10000))  # 1 contrato a cada 10 mil reais
```

### 2. Logs Atualizados
```python
# ANTES
f"Posição: {current_qty} | Base Qty: {base_quantity}"

# DEPOIS  
f"Posição: {current_qty} | Valor Alocado: R${valor_alocado:,.2f} | Qty: {base_quantity}"
```

### 3. `project_structure.md`
```json
// ANTES
"tamanhoPosition": 10.0,

// DEPOIS
"tamanhoPosition": 100000.0,  // Valor em reais alocado (R$ 100.000 = 10 contratos)
```

## ⚠️ Ações Necessárias

### 1. Atualizar Estratégias Existentes no Firebase
Para estratégias já configuradas, converter o valor:

```javascript
// Exemplo: Estratégia com 10 contratos fixos
// ANTES
"tamanhoPosition": 10.0

// DEPOIS  
"tamanhoPosition": 100000.0  // R$ 100.000 para manter 10 contratos
```

### 2. Verificar Configurações
- ✅ **Estratégias novas**: Usar valor em reais
- ✅ **Estratégias existentes**: Converter quantidade → valor
- ✅ **Fallback seguro**: Se valor = 0, usa 1 contrato mínimo

## 🎯 Benefícios

1. **Flexibilidade**: Ajusta automaticamente baseado no capital
2. **Escalabilidade**: Fácil aumentar/diminuir alocação
3. **Consistência**: Mesma proporção independente do valor
4. **Segurança**: Mínimo de 1 contrato garantido
5. **Transparência**: Logs mostram valor alocado e quantidade calculada

## 📝 Notas Técnicas

- **Arredondamento**: Sempre para baixo (int) para evitar over-leverage
- **Mínimo**: Garantido 1 contrato mesmo com valores baixos
- **Compatibilidade**: Funciona com estratégias existentes após conversão
- **Logs**: Mostram tanto valor alocado quanto quantidade calculada 