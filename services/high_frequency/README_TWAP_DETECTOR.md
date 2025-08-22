# 🤖 Detector TWAP - Sistema de Detecção de Robôs

## 📋 Visão Geral

O **Detector TWAP** é um sistema inteligente que analisa dados de mercado em tempo real para identificar padrões de robôs de trading, especificamente algoritmos TWAP (Time-Weighted Average Price) e VWAP (Volume-Weighted Average Price).

## 🎯 Funcionalidades

### ✅ **Detecção Automática**
- **Análise em tempo real** de janela deslizante de 24h
- **Identificação de padrões** baseada em múltiplas métricas
- **Score de confiança** para cada padrão detectado
- **Classificação automática** de status (ativo, inativo, suspeito)

### 📊 **Métricas Analisadas**
- **Frequência de trades** (regularidade temporal)
- **Volume total** e tamanho médio dos trades
- **Variação de preço** durante o período
- **Agressividade de preço** (quanto o agente "empurra" o mercado)
- **Consistência do agente** (buy_agent/sell_agent)

### 🔍 **Algoritmos Implementados**
- **TWAP Detection**: Identifica robôs que distribuem volume ao longo do tempo
- **VWAP Detection**: Detecta robôs baseados em volume (em desenvolvimento)
- **Pattern Recognition**: Análise de consistência e regularidade

## 🏗️ Arquitetura

### **Componentes Principais**

#### 1. **`robot_models.py`**
- Modelos de dados para padrões e trades
- Enums para tipos e status
- Configurações de detecção

#### 2. **`robot_persistence.py`**
- Persistência no banco TimescaleDB
- Operações CRUD para padrões e trades
- Limpeza automática de dados antigos

#### 3. **`robot_detector.py`**
- Algoritmo principal de detecção TWAP
- Análise de métricas e cálculo de scores
- Agrupamento por agente e símbolo

#### 4. **Integração no `main.py`**
- Endpoints da API para consulta
- Detecção contínua em background
- Monitoramento de status

## 🚀 Como Usar

### **1. Inicialização Automática**
O detector é iniciado automaticamente quando o backend HF é executado:
```bash
# O detector inicia junto com o sistema
python services/high_frequency/main.py
```

### **2. Endpoints da API**

#### **Consultar Padrões Detectados**
```http
GET /robots/patterns?symbol=PETR4
GET /robots/patterns  # Todos os símbolos
```

#### **Consultar Atividade Recente**
```http
GET /robots/activity?symbol=PETR4&hours=24
GET /robots/activity  # Últimas 24h, todos os símbolos
```

#### **Status do Sistema**
```http
GET /metrics  # Inclui status do detector TWAP
```

### **3. Teste Manual**
```bash
# Executa testes do detector
cd services/high_frequency
python test_twap_detector.py

# Ou use o script batch
test_twap_detector.bat
```

## ⚙️ Configuração

### **Parâmetros de Detecção**
```python
config = TWAPDetectionConfig(
    analysis_window_minutes=1440,    # Janela de 24h
    min_trades=10,                   # Mínimo de trades
    min_total_volume=100000,         # Volume mínimo
    max_price_variation=5.0,         # Variação máxima de preço (%)
    min_frequency_minutes=1.0,       # Frequência mínima
    max_frequency_minutes=30.0,      # Frequência máxima
    min_confidence=0.6               # Confiança mínima
)
```

### **Variáveis de Ambiente**
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/market_data
```

## 📈 Exemplo de Saída

### **Padrão TWAP Detectado**
```json
{
  "success": true,
  "patterns": [
    {
      "symbol": "PETR4",
      "exchange": "B3",
      "pattern_type": "TWAP",
      "confidence_score": 0.89,
      "agent_id": 1001,
      "first_seen": "2025-08-21T14:00:00Z",
      "last_seen": "2025-08-21T16:30:00Z",
      "total_volume": 1500000,
      "total_trades": 45,
      "avg_trade_size": 33333,
      "frequency_minutes": 3.2,
      "price_aggression": 0.02,
      "status": "active"
    }
  ],
  "count": 1
}
```

## 🔧 Monitoramento

### **Logs do Sistema**
```bash
# Logs de detecção
INFO: Detector TWAP iniciado com sucesso
INFO: Analisando PETR4 para padrões TWAP...
INFO: Detectados 2 padrões TWAP para PETR4
INFO: Padrão TWAP salvo para PETR4 - Agente 1001
```

### **Métricas de Performance**
```json
{
  "twap_detector_status": {
    "active": true,
    "active_patterns_count": 15
  }
}
```

## 🧪 Testes

### **Executar Testes Completos**
```bash
# Testa persistência e detector
python test_twap_detector.py

# Saída esperada:
# ✅ Detector TWAP criado com sucesso
# 🔍 Analisando PETR4...
#   ✅ Detectados 2 padrões TWAP
# 🌐 Analisando todos os símbolos ativos...
#   ✅ Total de padrões detectados: 8
```

## 🚨 Troubleshooting

### **Problemas Comuns**

#### 1. **"TWAP Detector não inicializado"**
- Verifique se o backend HF está rodando
- Confirme que as tabelas `robot_patterns` e `robot_trades` existem

#### 2. **"Nenhum padrão detectado"**
- Verifique se há dados na tabela `ticks_raw`
- Ajuste os parâmetros de configuração (reduza thresholds)
- Confirme que os agentes têm volume suficiente

#### 3. **Erro de conexão com banco**
- Verifique `DATABASE_URL` no `.env`
- Confirme que o TimescaleDB está rodando
- Teste conexão manual com `psql`

### **Debug Mode**
```python
# Adicione no início do script
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🔮 Próximos Passos

### **Funcionalidades Planejadas**
- [ ] **Detecção VWAP** avançada
- [ ] **Machine Learning** para melhorar scores
- [ ] **Alertas em tempo real** para padrões suspeitos
- [ ] **Dashboard web** para monitoramento
- [ ] **Integração com Telegram** para notificações

### **Melhorias Técnicas**
- [ ] **Cache Redis** para performance
- [ ] **Análise multi-timeframe** (1m, 5m, 15m)
- [ ] **Backtesting** de algoritmos de detecção
- [ ] **Métricas avançadas** (Sharpe ratio, drawdown)

## 📚 Referências

- **TWAP Strategy**: [Investopedia](https://www.investopedia.com/terms/t/twap.asp)
- **TimescaleDB**: [Documentação Oficial](https://docs.timescale.com/)
- **FastAPI**: [Documentação](https://fastapi.tiangolo.com/)

---

**🎯 Sistema desenvolvido para detectar robôs de trading em tempo real com alta precisão e performance!**
