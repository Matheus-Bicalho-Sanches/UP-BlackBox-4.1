# 📖 Guia Prático: Como Usar a Aba Sync

## 🎯 Objetivo
Este guia mostra como criar e gerenciar carteiras de referência para sincronização de posições dos clientes.

## 🚀 Passo a Passo

### 1. **Acessar a Aba Sync**
```
URL: http://localhost:3000/dashboard/up-blackbox4/sync
```

### 2. **Selecionar uma Estratégia**
1. No dropdown "Seletor de Estratégia", escolha uma estratégia
2. Exemplos de estratégias:
   - `bb-fiis` (UP BlackBox FIIs)
   - `bb-multi` (UP BlackBox Multi)
   - `bb-acoes` (UP BlackBox Ações)

### 3. **Criar Primeira Posição de Referência**

#### Exemplo 1: FII HGLG11
```
Ticker: HGLG11
Preço: 145.50
Quantidade: 1000
Percentual: 25.5
```

#### Exemplo 2: FII XPML11
```
Ticker: XPML11
Preço: 89.30
Quantidade: 1500
Percentual: 35.2
```

#### Exemplo 3: FII VISC11
```
Ticker: VISC11
Preço: 112.75
Quantidade: 800
Percentual: 18.8
```

### 4. **Verificar Resultado**
Após salvar, você verá:
- ✅ Posição aparecer na tabela "Carteira de referência"
- ✅ Dados organizados: Ticker, Preço, Quantidade, %
- ✅ Botão "Excluir" disponível

## 📊 Exemplo Completo: Carteira FIIs

### Estratégia: `bb-fiis`
| Ticker | Preço | Quantidade | % da Posição |
|--------|-------|------------|--------------|
| HGLG11 | 145.50 | 1000 | 25.5% |
| XPML11 | 89.30 | 1500 | 35.2% |
| VISC11 | 112.75 | 800 | 18.8% |
| **Total** | - | **3300** | **79.5%** |

## 🔧 Funcionalidades Disponíveis

### ✅ **Criar Posição**
- Clique em "Nova Posição" (ícone +)
- Preencha os campos
- Clique em "Salvar"

### ✅ **Excluir Posição**
- Clique no botão "Excluir" da posição
- Confirme a exclusão
- Posição será removida

### ✅ **Visualizar Posições**
- Tabela organizada por estratégia
- Dados em tempo real do Firebase
- Responsivo para diferentes telas

## 🎨 Interface

### Modal Nova Posição
```
┌─────────────────────────────────┐
│ Nova Posição              [X]  │
├─────────────────────────────────┤
│ Ticker: [PETR4        ]         │
│ Preço:  [32.50        ]         │
│ Quantidade: [500       ]        │
│ Percentual (%): [15.2   ]       │
│                                 │
│        [Cancelar] [Salvar]      │
└─────────────────────────────────┘
```

### Tabela de Posições
```
┌─────────┬─────────┬─────────────┬─────────────┬─────────┐
│Posições │ Preços  │ Quantidades │ Tam. Pos. % │ Ações   │
├─────────┼─────────┼─────────────┼─────────────┼─────────┤
│ HGLG11  │ R$145,50│ 1.000       │ 25.5%       │[Excluir]│
│ XPML11  │ R$89,30 │ 1.500       │ 35.2%       │[Excluir]│
│ VISC11  │ R$112,75│ 800         │ 18.8%       │[Excluir]│
└─────────┴─────────┴─────────────┴─────────────┴─────────┘
```

## 🔍 Verificação no Firebase

### Coleção: `CarteirasDeRefDLL`
```json
{
  "id": "auto-generated-id",
  "strategy_id": "bb-fiis",
  "ticker": "HGLG11",
  "price": 145.50,
  "quantity": 1000,
  "percentage": 25.5,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## ⚠️ Validações

### Campos Obrigatórios
- ✅ **Ticker**: Não pode estar vazio
- ✅ **Preço**: Deve ser maior que 0
- ✅ **Quantidade**: Deve ser maior que 0
- ✅ **Percentual**: Opcional (pode ser 0)

### Comportamentos
- ✅ **Ticker**: Convertido para maiúsculas automaticamente
- ✅ **Confirmação**: Exclusão requer confirmação
- ✅ **Recarregamento**: Lista atualiza automaticamente após mudanças

## 🚨 Troubleshooting

### Problema: "Nenhuma posição encontrada"
**Solução**: 
1. Verifique se selecionou uma estratégia
2. Clique em "Nova Posição" para criar a primeira posição

### Problema: "Erro ao salvar posição"
**Solução**:
1. Verifique se todos os campos obrigatórios estão preenchidos
2. Verifique a conexão com o Firebase
3. Recarregue a página e tente novamente

### Problema: "Erro ao excluir posição"
**Solução**:
1. Verifique a conexão com o Firebase
2. Recarregue a página e tente novamente
3. Verifique se a posição ainda existe

## 📈 Próximos Passos

### Funcionalidades Futuras
1. **Edição**: Modificar posições existentes
2. **Sincronização**: Comparar com posições reais dos clientes
3. **Importação**: CSV/Excel para múltiplas posições
4. **Relatórios**: Exportar dados de sincronização

### Melhorias Planejadas
1. **Indicadores**: Status de sincronização visual
2. **Filtros**: Buscar por ticker específico
3. **Ordenação**: Ordenar por diferentes critérios
4. **Histórico**: Versões anteriores das carteiras 