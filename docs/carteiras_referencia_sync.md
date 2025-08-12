# Carteiras de Referência - Sistema de Sincronização

## 📋 Visão Geral

O sistema de **Carteiras de Referência** permite criar e gerenciar posições ideais para cada estratégia, que servem como base para sincronização com as posições reais dos clientes.

## 🎯 Funcionalidades Implementadas

### 1. **Gerenciamento de Posições de Referência**
- ✅ **Criar posições**: Modal para adicionar novas posições à estratégia
- ✅ **Visualizar posições**: Lista todas as posições de referência da estratégia
- ✅ **Remover posições**: Botão para deletar posições existentes
- ✅ **Validações**: Verifica se ticker já existe na estratégia

### 2. **Integração com Firebase**
- ✅ **Coleção `CarteirasDeRefDLL`**: Armazena posições de referência
- ✅ **Estrutura de dados**:
  ```typescript
  {
    strategy_id: string,    // ID da estratégia
    ticker: string,         // Código do ativo (ex: PETR4)
    price: number,          // Preço de referência
    quantity: number,       // Quantidade de referência
    percentage: number,     // Percentual da carteira
    created_at: timestamp,  // Data de criação
    updated_at: timestamp   // Data de atualização
  }
  ```

### 3. **Endpoints da API**
- ✅ `GET /carteiras_referencia` - Lista posições (filtro por estratégia)
- ✅ `POST /carteiras_referencia` - Cria nova posição
- ✅ `PUT /carteiras_referencia/{id}` - Atualiza posição existente
- ✅ `DELETE /carteiras_referencia/{id}` - Remove posição

## 🚀 Como Usar

### **Passo 1: Selecionar Estratégia**
1. Acesse a aba **Sincronização** (`/dashboard/up-blackbox4/sync`)
2. No dropdown "Seletor de Estratégia", escolha a estratégia desejada

### **Passo 2: Criar Posições de Referência**
1. Clique no botão **"Nova Posição"**
2. Preencha os campos:
   - **Ticker**: Código do ativo (ex: PETR4, VALE3)
   - **Preço**: Preço de referência do ativo
   - **Quantidade**: Quantidade de referência
   - **Percentual**: % que este ativo deve representar na carteira
3. Clique em **"Salvar Posição"**

### **Passo 3: Visualizar Carteira de Referência**
- As posições criadas aparecem na tabela "Carteira de referência"
- Cada posição mostra: Ticker, Preço, Quantidade, % da carteira
- Botão de lixeira para remover posições

### **Passo 4: Sincronização (Próximos Passos)**
- O sistema compara posições reais vs. posições de referência
- Identifica diferenças e gera ordens de sincronização
- **Funcionalidade em desenvolvimento**

## 📊 Estrutura de Dados

### **Coleção: CarteirasDeRefDLL**
```javascript
// Exemplo de documento
{
  "id": "auto-generated",
  "strategy_id": "bb-fiis",
  "ticker": "HGLG11",
  "price": 145.50,
  "quantity": 1000,
  "percentage": 25.5,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### **Validações Implementadas**
- ✅ Ticker obrigatório
- ✅ Preço > 0
- ✅ Quantidade > 0
- ✅ Percentual > 0
- ✅ Ticker único por estratégia
- ✅ Conversão automática para maiúsculas

## 🔧 Configuração Técnica

### **Backend (FastAPI)**
- **Arquivo**: `UP BlackBox 4.0/main.py`
- **Endpoints**: Adicionados no final do arquivo
- **Dependências**: Firebase Admin SDK

### **Frontend (Next.js)**
- **Arquivo**: `src/app/dashboard/up-blackbox4/sync/page.tsx`
- **Funcionalidades**:
  - Modal de nova posição
  - Listagem de posições
  - Remoção de posições
  - Integração com API

## 🎯 Próximos Passos

### **1. Sincronização Real**
- [ ] Comparar posições reais vs. posições de referência
- [ ] Calcular diferenças (quantidade a comprar/vender)
- [ ] Gerar ordens automáticas de sincronização

### **2. Melhorias na Interface**
- [ ] Edição de posições existentes
- [ ] Indicadores visuais de status
- [ ] Filtros por ticker
- [ ] Relatórios de sincronização

### **3. Funcionalidades Avançadas**
- [ ] Importação em lote (CSV)
- [ ] Histórico de alterações
- [ ] Notificações de sincronização
- [ ] Agendamento de sincronizações

## 🐛 Troubleshooting

### **Erro: "Já existe posição para o ticker X"**
- **Causa**: Tentativa de criar posição duplicada
- **Solução**: Use outro ticker ou remova a posição existente

### **Erro: "Campo obrigatório ausente"**
- **Causa**: Campos não preenchidos no modal
- **Solução**: Preencha todos os campos obrigatórios

### **Erro: "HTTP 500"**
- **Causa**: Problema no backend
- **Solução**: Verificar logs do servidor e conexão com Firebase

## 📝 Exemplos de Uso

### **Exemplo 1: Carteira de FIIs**
```
Estratégia: UP BlackBox FIIs
Posições:
- HGLG11: 25% (1000 cotas a R$ 145,50)
- XPML11: 35% (1500 cotas a R$ 89,30)
- VISC11: 20% (800 cotas a R$ 112,75)
- Outros: 20% (diversos FIIs)
```

### **Exemplo 2: Carteira Multi**
```
Estratégia: UP BlackBox Multi
Posições:
- PETR4: 15% (500 ações a R$ 32,50)
- VALE3: 12% (300 ações a R$ 68,90)
- ITUB4: 18% (800 ações a R$ 28,75)
- Outros: 55% (diversos ativos)
```

## 🔗 Integração com Sistema Existente

### **Estratégias**
- Usa coleção `strategies` existente
- Cada estratégia pode ter múltiplas posições de referência

### **Contas de Clientes**
- Usa coleção `contasDll` existente
- Usa coleção `strategyAllocations` para alocações

### **Posições Reais**
- Usa coleção `posicoesDLL` para posições reais
- Usa coleção `strategyPositions` para consolidação

---

**Status**: ✅ **Implementado e Funcional**
**Última Atualização**: Janeiro 2024
**Responsável**: Sistema de Sincronização UP BlackBox 4.0 