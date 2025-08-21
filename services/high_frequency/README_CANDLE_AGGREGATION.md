# 🕯️ Sistema de Agregação Automática de Candles

## 📋 **Visão Geral**

Este sistema converte automaticamente **ticks** em **candles de 1 minuto** em tempo real, alimentando a tabela `candles_1m` para que os gráficos da página de market data funcionem corretamente.

## 🔧 **Como Funciona**

### **1. Fluxo de Dados:**
```
Ticks chegam → Salvos em ticks_raw → Agrupados em candles → Salvos em candles_1m → Gráficos atualizados
```

### **2. Agregação Automática:**
- **Ticks** são recebidos em tempo real
- **Agrupados** por minuto usando bucket de tempo
- **Candles** são criados automaticamente a cada minuto
- **Salvos** na tabela `candles_1m`

### **3. Timeframes Suportados:**
- **1 minuto**: Direto da tabela `candles_1m`
- **5m, 15m, 1h, 1d**: Agregados a partir de `ticks_raw` usando `time_bucket`

## 🚀 **Como Usar**

### **1. Iniciar o Sistema:**
```bash
cd services/high_frequency/
python main.py
```

### **2. Testar Agregação:**
```bash
# Usando arquivo batch
test_candles.bat

# Ou diretamente
python test_candle_aggregation.py
```

### **3. Verificar Status:**
```bash
# Endpoint da API
GET /metrics

# Retorna:
{
  "candle_aggregator_status": {
    "is_running": true,
    "active_candles_count": 2,
    "active_symbols": ["PETR4_B", "VALE3_B"]
  }
}
```

## 📊 **Estrutura dos Dados**

### **Tabela `ticks_raw`:**
- **symbol**: Código do ativo (ex: PETR4)
- **exchange**: Mercado (B = B3, F = BMF)
- **price**: Preço do tick
- **volume**: Volume negociado
- **timestamp**: Timestamp UTC
- **volume_financial**: Volume financeiro

### **Tabela `candles_1m`:**
- **symbol**: Código do ativo
- **exchange**: Mercado
- **ts_minute_utc**: Timestamp do minuto (UTC)
- **o**: Preço de abertura
- **h**: Preço máximo
- **l**: Preço mínimo
- **c**: Preço de fechamento
- **v**: Volume total
- **vf**: Volume financeiro total

## 🔍 **Monitoramento**

### **1. Logs do Sistema:**
```bash
# Logs de agregação
tail -f logs/high_frequency.log | grep CandleAggregator
```

### **2. Métricas em Tempo Real:**
```bash
# Status do agrupador
curl http://localhost:8000/metrics
```

### **3. Verificar Dados no Banco:**
```sql
-- Candles criados
SELECT COUNT(*) FROM candles_1m WHERE symbol = 'PETR4';

-- Ticks recebidos
SELECT COUNT(*) FROM ticks_raw WHERE symbol = 'PETR4';

-- Últimos candles
SELECT * FROM candles_1m 
WHERE symbol = 'PETR4' 
ORDER BY ts_minute_utc DESC 
LIMIT 5;
```

## 🚨 **Solução de Problemas**

### **1. Candles não estão sendo criados:**
- Verifique se o agrupador está rodando: `/metrics`
- Confirme se ticks estão chegando: `/status`
- Verifique logs de erro

### **2. Performance lenta:**
- Ajuste `BATCH_SIZE` no buffer
- Verifique conexões do banco
- Monitore uso de CPU/memória

### **3. Dados incorretos:**
- Verifique timezone das datas
- Confirme formato dos timestamps
- Valide estrutura das tabelas

## 📈 **Configurações**

### **Variáveis de Ambiente:**
```bash
# Configurações do banco
DATABASE_URL=postgres://user:pass@localhost:5432/market_data

# Configurações de logging
LOG_LEVEL=INFO

# Configurações de performance
HF_BATCH_MS=100
HF_BATCH_MAX=1000
```

### **Parâmetros do Agrupador:**
- **Intervalo de agregação**: 1 minuto (fixo)
- **Timeout de fechamento**: Automático a cada minuto
- **Retry de persistência**: 3 tentativas

## 🔗 **APIs Relacionadas**

### **1. `/api/candles`**
- Busca candles de diferentes timeframes
- Fallback automático para agregação de ticks
- Suporte a filtros por período

### **2. `/api/ticks`**
- Retorna ticks individuais
- Agregação em tempo real para diferentes timeframes
- Filtros por símbolo e período

### **3. `/metrics`**
- Status completo do sistema
- Métricas de performance
- Status do agrupador de candles

## 🎯 **Próximos Passos**

### **1. Otimizações:**
- Compressão automática de candles antigos
- Políticas de retenção configuráveis
- Cache de agregações frequentes

### **2. Funcionalidades:**
- Suporte a múltiplos timeframes em tempo real
- Indicadores técnicos automáticos
- Alertas de preço/volume

### **3. Monitoramento:**
- Dashboard de métricas em tempo real
- Alertas de falhas
- Histórico de performance

## 📞 **Suporte**

Se encontrar problemas:
1. Verifique os logs do sistema
2. Confirme status via `/metrics`
3. Teste com dados simulados
4. Verifique conectividade do banco

---

**✅ Sistema funcionando corretamente quando:**
- Ticks chegam e são salvos em `ticks_raw`
- Candles são criados automaticamente em `candles_1m`
- Gráficos mostram dados em tempo real
- API `/api/candles` retorna dados corretos
