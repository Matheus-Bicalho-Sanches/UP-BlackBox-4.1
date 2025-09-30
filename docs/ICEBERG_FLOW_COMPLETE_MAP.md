# 🗺️ Mapa Completo do Fluxo de Ordens Iceberg

## 📊 TODAS AS REQUISIÇÕES, CONSULTAS E CÁLCULOS

### **Cenário: Ordem Iceberg de 100 ações (10 lotes de 10 ações cada)**

---

## 🎬 FASE 1: PREPARAÇÃO (Frontend)

### **1.1. Usuário clica em "Sincronizar Todos"**

**Requisições Firestore (Frontend):**
```typescript
// Já foram feitas no carregamento da página:
✅ strategies (cache)
✅ contasDll (cache)
✅ strategyAllocations (cache)
✅ CarteirasDeRefDLL (cache)

// Se não houver cache:
📖 READ collection('strategies')                    // 6 docs
📖 READ collection('contasDll')                     // 72 docs
📖 READ collection('strategyAllocations')           // 68 docs
📖 READ collection('CarteirasDeRefDLL')             // 64 docs
                                                    ─────────────
                                                    210 reads
```

### **1.2. Sistema carrega posições das contas**

**API Call (Frontend → Backend):**
```typescript
fetch('/api/client-positions/2758466')  // Para cada conta
  ↓ (API Next.js repassa)
fetch('http://localhost:8000/client-positions/2758466')
```

**Requisições Firestore (Backend - POR CONTA):**
```python
📖 READ collection('posicoesDLL').where('account_id', '==', '2758466')         // ~29 docs
📖 READ collection('posicoesAjusteManual').where('account_id', '==', '2758466') // ~27 docs
                                                                                ─────────────
                                                                                56 reads/conta

Com cache ativo: 0 reads (usa cache de 30s) ✅
```

**Para 10 contas:**
```
SEM CACHE: 10 × 56 = 560 reads
COM CACHE: 0 reads ✅ (depois da primeira carga)
```

### **1.3. Cálculos no Frontend**

**Função: `calculateSyncAllData()` (linha ~1177)**
```javascript
Para cada ativo da carteira de referência:
  Para cada conta:
    1. Buscar posição real da conta: accountPositions[accountId][ticker]
    2. Calcular % atual: (quantidade × preço) / valor_investido × 100
    3. Buscar % ideal: positions.find(ticker).percentage
    4. Calcular diferença: % ideal - % atual
    5. SE diferença > 0.5%:
       - Calcular valor diferença: (diferença × valor_investido) / 100
       - Calcular quantidade: valor_diferença / preço
       - Determinar ação: buy ou sell
       - Agregar por ticker
    
Resultado: Array de ativos que precisam sincronização
```

**Complexidade:**
- **Posições de referência**: ~30 tickers
- **Contas**: ~10 contas
- **Iterações**: 30 × 10 = **300 cálculos**
- **Tempo**: ~10-50ms (JavaScript puro, em memória)

**Reads Firestore:** **0** (tudo em memória do frontend)

---

## 🚀 FASE 2: ENVIO DA ORDEM ICEBERG (Frontend → Backend)

### **2.1. Usuário clica em "Sincronizar PETR4" → "Ordem Iceberg"**

**API Call:**
```typescript
POST http://localhost:8000/order_iceberg
Body: {
  "account_id": "2758466",
  "broker_id": 345,
  "ticker": "PETR4",
  "quantity_total": 100,
  "price": 35.50,
  "side": "buy",
  "exchange": "B",
  "lote": 10,
  "twap_enabled": false,
  "twap_interval": 0,
  "strategy_id": "blackbox-fiis"
}
```

**Requisições:** 1 POST (Frontend → Backend)

---

## ⚙️ FASE 3: PROCESSAMENTO BACKEND (Loop de Lotes)

### **3.1. Criação do Iceberg (1x)**

**Write Firestore:**
```python
📝 WRITE collection('icebergs').document(iceberg_id).set({
    'account_id': '2758466',
    'ticker': 'PETR4',
    'quantity_total': 100,
    'lote': 10,
    'executed': 0,
    'executed_lotes': 0,
    'status': 'executing',
    // ... outros campos
})
                                                    ─────────────
                                                    1 write
```

### **3.2. Loop de Execução (10x - UM POR LOTE)**

**Para cada lote (1 a 10):**

#### **A) Verificar configuração (antes de cada lote):**
```python
📖 READ collection('icebergs').document(iceberg_id).get()   // Verifica halt, preço, lote
                                                            ─────────────
                                                            1 read
```

#### **B) Enviar ordem via DLL:**
```python
send_order(...)
  ↓
DLL → Bolsa (protocolo binário)
  ↓
📝 WRITE collection('ordensDLL').document(order_id).set({
    'account_id': '2758466',
    'ticker': 'PETR4',
    'quantity': 10,
    'price': 35.50,
    'side': 'buy',
    'Status': 'Sent',
    'master_batch_id': iceberg_id,
    // ... outros campos
})
                                                            ─────────────
                                                            1 write
```

#### **C) Polling até execução (OTIMIZADO):**
```python
# Loop a cada 100ms até ordem executar
while not filled:
    📖 READ collection('ordensDLL').document(order_id).get()
    
    if ordem.Status == "Filled":
        break
    
    time.sleep(0.1)  # ⚡ 100ms

# Número de reads: depende do tempo de execução
# Execução instantânea: 1-3 reads
# Execução em 1s: ~10 reads
# Execução em 5s: ~50 reads

MÉDIA: ~5-10 reads por lote
```

#### **D) Atualização de progresso (ASSÍNCRONO):**
```python
# Thread separada (não bloqueia próximo lote!)
threading.Thread(target=async_update_firestore).start()
  ↓
📝 WRITE collection('icebergs').document(iceberg_id).update({
    'executed': Increment(10),
    'executed_lotes': lote_atual,
    'current_lote': lote_atual,
    'last_update': SERVER_TIMESTAMP
})
                                                            ─────────────
                                                            1 write (async)
```

#### **E) Atualização de posições (ASSÍNCRONO - SE strategy_id):**
```python
# Thread separada
threading.Thread(target=async_update_positions).start()
  ↓
atualizar_posicoes_firebase_strategy(strategy_id)
  ↓
📖 READ collection('strategyAllocations').where('strategy_id', '==', strategy_id)  // ~10 docs
📖 READ collection('ordensDLL').where('strategy_id', '==', strategy_id)           // MUITOS docs (100-1000+)
📝 WRITE collection('strategyPositions').document(f"{strategy_id}_{ticker}")     // ~30 writes

                                                            ─────────────
                                                            10-1000+ reads
                                                            30 writes
```

**⚠️ PROBLEMA CRÍTICO IDENTIFICADO!**
```python
# Linha 552
ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()

# Isso busca TODAS as ordens da estratégia (sem filtro de data no Firestore!)
# Filtro de data é feito em PYTHON (linha 587)
# Se a estratégia tem 10.000 ordens históricas → 10.000 reads!
```

---

### **3.3. Resumo por Lote:**

| Operação | Reads | Writes | Quando |
|----------|-------|--------|--------|
| Verificar config | 1 | 0 | Antes do lote |
| Enviar ordem | 0 | 1 | Início do lote |
| Polling execução | 5-10 | 0 | Durante execução |
| Update progresso | 0 | 1 | Após execução (async) |
| Update posições strategy | 10-1000+ | 30 | Após execução (async) |
| **TOTAL/LOTE** | **16-1011+** | **32** | **POR LOTE** |

### **3.4. Finalização (1x):**
```python
📝 WRITE collection('icebergs').document(iceberg_id).update({
    'status': 'completed',
    'end_time': SERVER_TIMESTAMP,
    'last_update': SERVER_TIMESTAMP
})
                                                            ─────────────
                                                            1 write
```

---

## 🎯 FASE 4: MONITORAMENTO FRONTEND (Polling)

### **4.1. Frontend verifica status (a cada 300ms):**

```typescript
// Loop até completar
while (!completed) {
    📡 GET http://localhost:8000/iceberg_status/${orderId}
    
    // Backend lê:
    📖 READ collection('icebergs').document(orderId).get()
    
    // Retorna JSON com status
    
    await sleep(300ms)  // Intervalo do frontend
}

// Número de requisições: depende do tempo total
// 10 lotes × 1s cada = 10s total
// 10s ÷ 0.3s = ~33 requisições
                                                            ─────────────
                                                            33 reads (10 lotes)
```

---

## 📊 TOTAL CONSOLIDADO (10 LOTES, 1 CONTA)

### **SEM OTIMIZAÇÃO (Cenário Pior - strategy_id ativo):**

| Coleção | Reads | Writes | Notas |
|---------|-------|--------|-------|
| **icebergs** | 10 (config) + 33 (status) = 43 | 1 (criar) + 10 (progresso) + 1 (finalizar) = 12 | Config, progresso, status |
| **ordensDLL** | 50 (polling) + 10.000 (strategy) = 10.050 | 10 (enviar) | ⚠️ GARGALO! |
| **strategyAllocations** | 100 | 0 | 10 lotes × 10 docs |
| **strategyPositions** | 0 | 300 | 10 lotes × 30 writes |
| **TOTAL** | **10.193** | **322** | **POR ORDEM ICEBERG** |

**Custo:** $0.006 por ordem iceberg (10 lotes)

---

### **COM OTIMIZAÇÕES (Cache + Async):**

| Coleção | Reads | Writes | Economia |
|---------|-------|--------|----------|
| **icebergs** | 43 | 12 | - |
| **ordensDLL** | 50 (polling) | 10 | ✅ -10.000 reads |
| **strategyAllocations** | 0 | 0 | ✅ Cache (primeira vez: 10) |
| **strategyPositions** | 0 | 300 | - |
| **TOTAL** | **93** | **322** | **⚡ 99% menos reads!** |

**Custo:** $0.00006 por ordem iceberg (10 lotes)

**Economia:** $0.0054 por ordem (90x mais barato!)

---

## 🔴 PROBLEMA CRÍTICO DESCOBERTO!

### **`atualizar_posicoes_firebase_strategy()` - LINHA 552**

```python
# ❌ PROBLEMA: Busca TODAS as ordens da estratégia (sem filtro Firestore de data!)
ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()

# Se estratégia tem 10.000 ordens históricas:
# → 10.000 reads do Firestore
# → Filtro de data é feito EM PYTHON (linha 587)
# → Desperdício MASSIVO!

for doc in ordens_ref:  # Itera TODAS as ordens
    o = doc.to_dict()
    
    # Filtro de data EM PYTHON (deveria estar no Firestore!)
    if order_date.date() != hoje:
        continue  # Descarta, mas JÁ FEZ O READ!
```

**ESTE É O GARGALO PRINCIPAL!** 🚨

---

## 🔧 CÁLCULOS REALIZADOS

### **1. Frontend (JavaScript):**

#### **calculateSyncAllData():**
```javascript
Para cada ticker (30 tickers):
  Para cada conta (10 contas):
    ✓ Buscar posição real: O(1) - lookup em Map
    ✓ Calcular valor posição atual: quantidade × preço
    ✓ Calcular % atual: (valor / investimento) × 100
    ✓ Buscar % ideal: O(1) - lookup em Array
    ✓ Calcular diferença: ideal - atual
    ✓ SE diferença > 0.5%:
      ✓ Calcular valor diferença: (diferença × investimento) / 100
      ✓ Calcular quantidade: valor / preço
      ✓ Determinar ação: buy/sell

Total iterações: 30 × 10 = 300
Tempo: ~20-50ms (tudo em memória)
```

#### **calculateIcebergQuantities():**
```javascript
Para cada conta afetada pelo ticker:
  ✓ Extrair quantidade para aquela conta
  ✓ Calcular número de lotes: Math.ceil(quantidade / lote_size)
  
Total iterações: ~5-10 contas
Tempo: ~1-5ms
```

### **2. Backend (Python):**

#### **POR LOTE - send_order():**
```python
✓ Validar parâmetros: ~5ms
✓ Chamar DLL: profit_dll.SendOrder(...)  ~10-20ms
✓ DLL → Bolsa (protocolo binário): ~20-50ms
✓ Registrar no Firestore (ordensDLL): ~50-100ms (1 write)

Total: ~85-175ms
```

#### **POR LOTE - Polling (OTIMIZADO):**
```python
Loop a cada 100ms:
  ✓ READ ordensDLL.document(order_id): ~20-50ms
  ✓ Verificar status: ~1ms
  ✓ Se executado: break
  
Execução típica: 5-10 iterações
Reads: 5-10 por lote
Tempo: 500ms-1s
```

#### **POR LOTE - atualizar_posicoes_firebase_strategy() (ASSÍNCRONO):**
```python
# ⚠️ EXECUTADO EM PARALELO (não bloqueia próximo lote)

1. READ strategyAllocations.where(strategy_id): ~10 docs
2. READ ordensDLL.where(strategy_id): ⚠️ TODAS as ordens (1000-10000+)
3. Calcular posições em Python:
   Para cada ordem:
     ✓ Verificar se é da conta ativa
     ✓ Verificar se é do dia (filtro Python)
     ✓ Acumular quantidade por ticker
     ✓ Calcular preço médio ponderado
4. WRITE strategyPositions: ~30 docs

Tempo: 2-10 segundos (dependendo de quantas ordens existem)
Reads: 10-10.000+
Writes: 30
```

---

## 💰 CUSTO TOTAL POR OPERAÇÃO

### **Cenário: 1 conta, 10 lotes, strategy_id ativo**

#### **PIOR CASO (sem otimizações, 10k ordens históricas):**
```
Carga inicial:           210 reads
Posições da conta:        56 reads
Polling (10 lotes):      100 reads (10 × 10 reads)
Update strategy:      10.000 reads (⚠️ TODAS as ordens!)
Status checks:            33 reads (frontend)
                      ──────────────
TOTAL:               10.399 reads
                         333 writes

Custo: $0.0062 por ordem iceberg
```

#### **COM OTIMIZAÇÕES (cache + async + filtro de data):**
```
Carga inicial:             0 reads (cache)
Posições da conta:         0 reads (cache)
Polling (10 lotes):       50 reads (10 × 5 reads, mais eficiente)
Update strategy:          20 reads (⚡ FILTRO DE DATA no Firestore!)
Status checks:            33 reads
                      ──────────────
TOTAL:                   103 reads
                         333 writes

Custo: $0.00006 por ordem iceberg

ECONOMIA: 99% nos reads! ($0.0062 → $0.00006)
```

---

## 🎯 DETALHAMENTO: ONDE ESTÃO OS GARGALOS?

### **🔴 GARGALO #1: atualizar_posicoes_firebase_strategy()**

**Problema:**
```python
# Linha 552 - BUSCA TODAS AS ORDENS DA ESTRATÉGIA
ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
# → 10.000 reads se houver 10.000 ordens históricas!

# Filtro de data é feito EM PYTHON (linha 587)
if order_date.date() != hoje:
    continue  # Descarta, mas JÁ LIDO!
```

**Solução:**
```python
# ✅ ADICIONAR FILTRO DE DATA NO FIRESTORE
ordens_ref = db.collection('ordensDLL')\
    .where('strategy_id', '==', strategy_id)\
    .where('createdAt', '>=', inicio_dia)\  # ⚡ FILTRO NO FIRESTORE!
    .stream()

# → Apenas ~50-100 ordens do dia
# → 99% menos reads!
```

**Impacto:**
- **De 10.000 reads → 50 reads**
- **Economia: 99.5%**
- **Tempo: 10s → 100ms**

---

### **🟡 GARGALO #2: Polling de Execução**

**Situação atual (OTIMIZADO):**
```python
# A cada 100ms verifica ordensDLL
# Ordem típica executa em 1-3s
# → 10-30 reads por lote
```

**Já otimizado com:**
- ✅ Polling 100ms (era 200ms)
- ⏳ Aguardando callback DLL (futuro)

**Potencial adicional:**
- Callback DLL: eliminaria polling completamente
- De 10 reads → 0 reads

---

### **🟢 JÁ OTIMIZADO: Cache de Posições**

**Antes:**
```
Cada chamada: 56 reads (posicoesDLL + ajustes)
10 contas: 560 reads
```

**Depois:**
```
Primeira chamada: 56 reads
Cache válido (30s): 0 reads
Economia: ~90% em uso repetido
```

---

## 📈 RESUMO FINAL - REQUISIÇÕES POR FASE

### **TABELA COMPLETA:**

| Fase | Frontend | Backend | Firestore | Total |
|------|----------|---------|-----------|-------|
| **Preparação** | 1 handleSyncAll | 10 client-positions | 210 reads (inicial) | ~210 |
| **Envio Iceberg** | 1 POST order_iceberg | 1 aceitar | 1 write (icebergs) | 1 |
| **Lote 1** | - | send_order + polling | 1 read (config) + 10 reads (polling) + 1 write (ordem) | 12 |
| **Lote 2-10** | - | send_order + polling | (1+10+1) × 9 = 108 | 108 |
| **Update Progress** | - | 10 async threads | 10 writes (icebergs) | 10 |
| **Update Positions** | - | 10 async threads | 10.000 reads + 300 writes | 10.300 |
| **Monitoramento** | 33 status checks | 33 iceberg_status | 33 reads (icebergs) | 33 |
| **Finalização** | 1 reload positions | 1 client-positions | 1 write (icebergs) + 56 reads (posições) | 57 |
| **TOTAL** | **35 API calls** | **64 operações** | **10.721 reads + 343 writes** | - |

---

## 🚨 CORREÇÃO URGENTE NECESSÁRIA!

### **atualizar_posicoes_firebase_strategy() - Linha 552**

**ANTES (CRÍTICO):**
```python
ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
# 10.000+ reads POR LOTE!
```

**DEPOIS (OTIMIZADO):**
```python
import datetime
hoje_inicio = datetime.datetime.combine(datetime.datetime.now().date(), datetime.time.min)

ordens_ref = db.collection('ordensDLL')\
    .where('strategy_id', '==', strategy_id)\
    .where('createdAt', '>=', hoje_inicio)\
    .stream()
# Apenas 50-100 reads por lote!
```

---

## ✅ RESUMO - O QUE OTIMIZAR AGORA:

### **CRÍTICO (99% do custo):**
1. 🔴 **Filtro de data em `atualizar_posicoes_firebase_strategy()`**
   - De 10.000 reads → 50 reads
   - Economia: $0.006 por ordem

### **IMPORTANTE (já implementado):**
2. ✅ Cache de posições (de 560 → 0 reads)
3. ✅ Polling 100ms (de 200ms → 100ms)
4. ✅ Firestore async (não bloqueia)

### **DESEJÁVEL (futuro):**
5. ⏳ Callback DLL (eliminar polling de execução)
6. ⏳ Redis cache para ordensDLL

---

**Quer que eu implemente a correção CRÍTICA do filtro de data AGORA?** Essa é a que terá **MAIOR impacto** (redução de 99% nos reads)! 🚀
