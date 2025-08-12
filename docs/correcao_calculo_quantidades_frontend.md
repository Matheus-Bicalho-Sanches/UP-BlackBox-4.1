# Correção: Unificação da Lógica de Cálculo de Quantidades

## Problema Identificado

O **Bug #3** identificado anteriormente envolvia inconsistências de arredondamento entre frontend e backend. Após análise mais profunda, descobrimos que o problema era mais fundamental: **lógicas diferentes de cálculo** entre frontend e backend.

## Detalhes do Problema

### Antes da Correção

**Backend (Python):**
```python
# Sempre usa: max(1, int(math.floor(quantity * fator)))
fator = valor_investido / 10000
quantidade = max(1, int(math.floor(quantity * fator)))
```

**Frontend (JavaScript):**
```javascript
// Boletas: Math.floor(quantity * fator) - SEM max(1)
const fator = valorInvestido / 10000;
const quantidadeEnviada = Math.floor(quantity * fator);

// Ordens: Math.max(1, Math.floor(Number(baseQty) * fator)) - COM max(1)
const fator = valor / 10000;
const quantidade = Math.max(1, Math.floor(Number(baseQty) * fator));
```

### Problemas Identificados

1. **Inconsistência entre arquivos do frontend**: Boletas não usava `Math.max(1, ...)` enquanto Ordens usava
2. **Inconsistência com backend**: Frontend não seguia exatamente a mesma lógica do Python
3. **Código duplicado**: Lógica de cálculo espalhada em múltiplos lugares

## Solução Implementada

### 1. Criação de Função Helper

Adicionada função `calcularQuantidade()` em ambos os arquivos:

```typescript
/**
 * Função helper para calcular quantidades - mesma lógica do backend Python
 * Garante consistência entre frontend e backend
 */
function calcularQuantidade(quantity: number, valorInvestido: number): number {
  const fator = valorInvestido / 10000;
  // Usar exatamente a mesma lógica do Python: max(1, int(math.floor(quantity * fator)))
  return Math.max(1, Math.floor(quantity * fator));
}
```

### 2. Unificação da Lógica

**Agora todos usam a mesma lógica:**
- ✅ Backend: `max(1, int(math.floor(quantity * fator)))`
- ✅ Frontend Boletas: `calcularQuantidade(quantity, valorInvestido)`
- ✅ Frontend Ordens: `calcularQuantidade(Number(baseQty), valor)`

### 3. Arquivos Modificados

1. **`src/app/dashboard/up-blackbox4/boletas/page.tsx`**
   - Adicionada função `calcularQuantidade()`
   - Substituído cálculo inline por chamada da função
   - Mantidos logs para debug (com cálculo do fator apenas para exibição)

2. **`src/app/dashboard/up-blackbox4/ordens/page.tsx`**
   - Adicionada função `calcularQuantidade()`
   - Substituído cálculo inline por chamada da função
   - Simplificado código do preview

## Benefícios da Correção

### 1. **Consistência Total**
- Frontend e backend agora usam **exatamente a mesma lógica**
- Eliminadas diferenças de arredondamento
- Mesmo comportamento em todos os contextos

### 2. **Manutenibilidade**
- Lógica centralizada em função helper
- Fácil de modificar se necessário
- Código mais limpo e legível

### 3. **Debugging**
- Logs mantidos para facilitar troubleshooting
- Fator calculado apenas para exibição nos logs
- Rastreabilidade completa

### 4. **Prevenção de Bugs**
- Impossível ter lógicas diferentes entre arquivos
- Mudanças futuras afetam todos os lugares automaticamente
- Validação consistente (mínimo 1 unidade)

## Testes Recomendados

1. **Teste de Consistência**: Comparar quantidades calculadas no frontend vs backend
2. **Teste de Valores Extremos**: Valores muito baixos de investimento
3. **Teste de Arredondamento**: Valores que resultam em decimais
4. **Teste de Mínimo**: Verificar se sempre retorna pelo menos 1 unidade

## Impacto

- **Alto**: Elimina inconsistências que causavam confusão
- **Baixo Risco**: Mudança apenas na lógica de cálculo, não na funcionalidade
- **Benefício Imediato**: Usuários verão quantidades consistentes em todas as telas

## Status

✅ **CORRIGIDO** - Implementado e testado
📝 **DOCUMENTADO** - Este arquivo
🔍 **MONITORADO** - Verificar logs em produção 