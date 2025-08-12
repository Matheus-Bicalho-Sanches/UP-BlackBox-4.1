# Implementação: Consolidação de Dados nas Linhas Master

## Objetivo

Implementar consolidação de dados nas linhas Master da tabela de ordens, substituindo os dados da última ordem individual pelos valores consolidados de todas as ordens do batch.

## Problema Anterior

As linhas Master mostravam apenas os dados da **última ordem enviada/executada** do batch, não refletindo o panorama real de todas as ordens consolidadas.

### Exemplo Anterior:
```
Master Batch ABC123:
├── Ordem 1: 1000 ações, 800 executadas, R$ 50,00
├── Ordem 2: 1500 ações, 1200 executadas, R$ 52,00  
└── Ordem 3: 500 ações, 300 executadas, R$ 48,00

Linha Master mostrava: 500 ações, 300 executadas, R$ 48,00 ❌
```

## Solução Implementada

### **Consolidação Inteligente**

A linha Master agora mostra valores consolidados calculados a partir de todas as ordens do batch:

#### **1. Somas Simples**
- **Quantidade**: Soma de todas as quantidades solicitadas
- **Executada**: Soma de todas as quantidades executadas
- **Pendente**: Soma de todas as quantidades pendentes

#### **2. Média Ponderada**
- **Preço Médio**: Média ponderada pelo volume executado de cada ordem

### **Fórmulas Implementadas**

```typescript
// Somas simples
totalQuantity = Σ(quantity[i])
totalTradedQuantity = Σ(TradedQuantity[i])  
totalLeavesQuantity = Σ(LeavesQuantity[i])

// Média ponderada para preço médio
totalPriceWeighted = Σ(TradedQuantity[i] × AveragePrice[i])
totalTradedForAverage = Σ(TradedQuantity[i])
precoMedioConsolidado = totalPriceWeighted / totalTradedForAverage
```

### **Exemplo Atualizado:**
```
Master Batch ABC123:
├── Ordem 1: 1000 ações, 800 executadas, R$ 50,00
├── Ordem 2: 1500 ações, 1200 executadas, R$ 52,00  
└── Ordem 3: 500 ações, 300 executadas, R$ 48,00

Linha Master mostra: 3000 ações, 2300 executadas, R$ 50,78 ✅
```

## Implementação Técnica

### **Arquivo Modificado**
`src/app/dashboard/up-blackbox4/ordens/page.tsx`

### **Função Principal**
```typescript
const calcularValoresConsolidados = (group: any[]) => {
  let totalQuantity = 0;
  let totalTradedQuantity = 0;
  let totalLeavesQuantity = 0;
  let totalPriceWeighted = 0;
  let totalTradedForAverage = 0;
  
  group.forEach(order => {
    // Somas simples
    totalQuantity += Number(order.quantity || 0);
    totalTradedQuantity += Number(order.TradedQuantity || 0);
    totalLeavesQuantity += Number(order.LeavesQuantity || 0);
    
    // Para preço médio ponderado
    const tradedQty = Number(order.TradedQuantity || 0);
    const avgPrice = Number(order.preco_medio_executado || order.AveragePrice || 0);
    
    if (tradedQty > 0 && avgPrice > 0) {
      totalPriceWeighted += tradedQty * avgPrice;
      totalTradedForAverage += tradedQty;
    }
  });
  
  // Calcular preço médio ponderado
  const precoMedioConsolidado = totalTradedForAverage > 0 ? totalPriceWeighted / totalTradedForAverage : 0;
  
  return {
    totalQuantity,
    totalTradedQuantity,
    totalLeavesQuantity,
    precoMedioConsolidado
  };
};
```

### **Integração na Interface**

1. **Cálculo**: Chamada da função para cada batch
2. **Exibição**: Valores consolidados na linha Master
3. **Visual**: Cor verde (#10b981) para destacar valores consolidados
4. **Tooltips**: Explicações detalhadas ao passar o mouse
5. **Indicador**: 📊 N mostrando número de ordens consolidadas

## Benefícios

### **1. Visão Realista**
- Mostra o panorama real de todas as ordens do batch
- Elimina confusão sobre qual ordem representa o Master
- Dados consistentes com a realidade operacional

### **2. Tomada de Decisão**
- Preço médio real para análise de performance
- Quantidades totais para gestão de risco
- Visão consolidada para relatórios

### **3. Experiência do Usuário**
- Dados mais úteis e relevantes
- Interface mais informativa
- Tooltips explicativos para clareza

### **4. Consistência**
- Alinhamento com conceito de "Master" (consolidação)
- Dados que fazem sentido para gestão de carteira
- Base sólida para análises futuras

## Detalhes Visuais

### **Cores e Estilos**
- **Verde (#10b981)**: Valores consolidados
- **Azul (#0ea5e9)**: Conta e batch ID
- **Ícone 📊**: Indicador de consolidação

### **Tooltips Informativos**
- **Quantidade**: "Consolidado: X ações (N ordens)"
- **Executada**: "Consolidado: X ações executadas (N ordens)"
- **Pendente**: "Consolidado: X ações pendentes (N ordens)"
- **Preço Médio**: "Preço médio ponderado consolidado: R$ X,XX (N ordens)"

### **Indicador de Consolidação**
- **📊 N**: Mostra número de ordens consolidadas
- **Posição**: Ao lado do nome da conta
- **Cor**: Verde para destacar

## Casos Especiais

### **Ordens sem Execução**
- Preço médio = 0 se nenhuma ordem foi executada
- Quantidades pendentes = totais se nada foi executado

### **Ordens Parcialmente Executadas**
- Preço médio considera apenas ordens com execução
- Somas incluem todas as ordens (executadas ou não)

### **Dados Inconsistentes**
- Tratamento robusto de valores nulos/undefined
- Fallback para valores padrão quando necessário

## Testes Recomendados

### **1. Teste de Consolidação Básica**
- Criar batch com múltiplas ordens
- Verificar se somas estão corretas
- Confirmar preço médio ponderado

### **2. Teste de Preço Médio**
- Ordens com preços diferentes
- Ordens com execuções parciais
- Verificar cálculo da média ponderada

### **3. Teste de Interface**
- Tooltips funcionando
- Cores aplicadas corretamente
- Indicador de consolidação visível

### **4. Teste de Performance**
- Batchs com muitas ordens
- Verificar se cálculo não impacta performance
- Testar com dados reais

## Impacto

- **Alto**: Melhora significativa na qualidade da informação
- **Baixo Risco**: Adição de funcionalidade sem quebrar existente
- **Benefício Imediato**: Usuários veem dados consolidados reais

## Status

✅ **IMPLEMENTADO** - Funcionalidade completa  
📝 **DOCUMENTADO** - Este arquivo  
🎯 **TESTADO** - Validação básica realizada  
🚀 **PRONTO** - Disponível para uso em produção 