# 🤖 TWAP à Mercado - Detector de Padrões Específicos

## 📋 Visão Geral

O **TWAP à Mercado** é um novo tipo de robô que detecta padrões específicos de trading onde corretoras enviam ordens de **volume fixo** à mercado com **intervalos regulares**, em meio a outros trades da mesma corretora.

## 🎯 Características do Padrão

### **Padrão Detectado:**
- **Volume Fixo**: Ordens sempre com o mesmo volume (ex: 300, 500, 1000 unidades)
- **Direção Única**: Apenas compra OU apenas venda (não alterna)
- **Intervalo Regular**: Qualquer intervalo < 5 minutos (1s, 30s, 2min, etc.)
- **À Mercado**: Ordens que agridem o livro de ofertas
- **Consistência**: Padrão se repete em meio a outros trades

### **Exemplo Real:**
```
Corretora BTG (85) em PETR4:
- 14:30:01 - COMPRA 300 @ R$ 32.45 (à mercado) - trade_type=2
- 14:30:03 - COMPRA 300 @ R$ 32.46 (à mercado) - trade_type=2
- 14:30:05 - COMPRA 300 @ R$ 32.47 (à mercado) - trade_type=2
- 14:30:07 - COMPRA 300 @ R$ 32.48 (à mercado) - trade_type=2
```

**Nota**: O sistema usa a coluna `trade_type` da tabela `ticks_raw`:
- `trade_type = 2`: Comprador foi o agressor (comprou à mercado)
- `trade_type = 3`: Vendedor foi o agressor (vendeu à mercado)
```

## 🔧 Implementação Técnica

### **Arquivos Criados/Modificados:**

#### **Backend:**
- `robot_models.py` - Adicionado `MARKET_TWAP` ao enum `RobotType`
- `market_twap_detector.py` - **NOVO**: Detector específico para este padrão
- `robot_detector.py` - Integrado novo detector no sistema principal

#### **Frontend:**
- `page.tsx` - Adicionado "TWAP à Mercado" aos tipos e cores

#### **Scripts:**
- `deploy_market_twap.py` - Script de deploy e migração
- `test_market_twap.py` - Script de teste com dados simulados

## ⚙️ Configuração

### **Parâmetros do Detector:**
```python
class MarketTWAPConfig:
    # Volume
    volume_tolerance_percent = 2.0      # 2% de tolerância no volume
    min_volume_repetitions = 8          # Mínimo de repetições do mesmo volume
    min_volume_frequency = 0.6          # 60% dos trades devem ter o mesmo volume
    
    # Tempo
    max_interval_minutes = 5.0          # Máximo 5 minutos entre trades
    time_consistency_threshold = 0.75   # 75% consistência temporal
    min_time_intervals = 5              # Mínimo de 5 intervalos para analisar
    
    # Direção
    min_direction_consistency = 0.9     # 90% consistência direcional
    
    # Confiança
    min_confidence = 0.75               # 75% confiança mínima
```

## 🚀 Como Usar

### **1. Deploy do Sistema:**
```bash
cd services/high_frequency
python deploy_market_twap.py
```

### **2. Teste da Implementação:**
```bash
python test_market_twap.py
```

### **3. Reiniciar Backend:**
```bash
python main.py
```

### **4. Acessar Interface:**
```
http://localhost:3000/dashboard/blackbox-multi/motion-tracker
```

## 🎨 Interface Frontend

### **Novo Tipo na Lista:**
- **"TWAP à Mercado"** aparece nos filtros de tipo
- **Cor Ciano** (`bg-cyan-600`) para identificação visual
- **Badge específico** com ícone ⚡

### **Informações Exibidas:**
- **Volume Fixo**: "300 unidades" (sempre o mesmo)
- **Intervalo**: "2.0s" ou "2.0min" (conforme detectado)
- **Direção**: "🟢 Apenas Compra" ou "🔴 Apenas Venda"
- **Confiança**: Score específico para este padrão
- **Regularidade**: "95% consistente" (desvio padrão baixo)

## 📊 Algoritmo de Detecção

### **Passo 1: Agrupamento**
- Agrupa trades por `agent_id` + `symbol` + `trade_type`
- Filtra apenas trades "à mercado"
- Ordena por timestamp

### **Passo 2: Análise de Volume**
- Identifica volumes repetidos com tolerância de 2%
- Calcula frequência de repetição
- Valida que > 60% dos trades têm o mesmo volume

### **Passo 3: Análise Temporal**
- Mede intervalos entre trades consecutivos
- Calcula regularidade temporal
- Aceita qualquer intervalo < 5 minutos

### **Passo 4: Validação de Direção**
- Confirma que 90%+ dos trades são na mesma direção
- Rejeita padrões que alternam compra/venda

### **Passo 5: Cálculo de Confiança**
```python
confidence = (
    volume_consistency * 0.3 +      # 30% - Consistência de volume
    time_consistency * 0.3 +         # 30% - Regularidade temporal
    direction_score * 0.2 +          # 20% - Consistência de direção
    frequency_score * 0.2            # 20% - Frequência de repetição
)
```

## 📈 Exemplos de Padrões Detectados

### **Alta Frequência (1 segundo):**
```
Agente 3 (XP) em ITUB4 - COMPRA:
- 14:30:00 - COMPRA 1000 @ R$ 28.50
- 14:30:01 - COMPRA 1000 @ R$ 28.51
- 14:30:02 - COMPRA 1000 @ R$ 28.52
```
**Análise**: Intervalo 1s, Volume 1000, Direção: 100% compra

### **Média Frequência (30 segundos):**
```
Agente 120 (Genial) em VALE3 - VENDA:
- 14:30:00 - VENDA 500 @ R$ 45.20
- 14:30:30 - VENDA 500 @ R$ 45.18
- 14:31:00 - VENDA 500 @ R$ 45.16
```
**Análise**: Intervalo 30s, Volume 500, Direção: 100% venda

### **Baixa Frequência (2 minutos):**
```
Agente 72 (Bradesco) em BBDC4 - VENDA:
- 14:30:00 - VENDA 2000 @ R$ 25.80
- 14:32:00 - VENDA 2000 @ R$ 25.77
- 14:34:00 - VENDA 2000 @ R$ 25.74
```
**Análise**: Intervalo 2min, Volume 2000, Direção: 100% venda

## 🔍 Monitoramento

### **Logs do Sistema:**
```bash
# Procure por mensagens como:
✅ Padrão TWAP à Mercado detectado: PETR4 - BTG (85) - BUY - Volume: 300 - Intervalo: 2.0s - Confiança: 0.85
🔄 Reclassificado: VALE3 - Agente 120 -> TWAP à Mercado
```

### **Interface Motion Tracker:**
- Acesse a aba "Padrões Detectados"
- Filtre por "TWAP à Mercado"
- Observe badges cianos com ícone ⚡
- Verifique informações específicas do padrão

## ⚠️ Considerações Importantes

### **Performance:**
- Análise mais complexa que TWAP tradicional
- Processamento em background para não impactar performance
- Considerar otimizações para grandes volumes de dados

### **Falsos Positivos:**
- Trades casuais podem coincidir temporariamente
- Threshold de confiança alto (75%) para reduzir falsos positivos
- Mínimo de 8 repetições para validar padrão

### **Dados Necessários:**
- Precisão de timestamp (milissegundos)
- Informação de preço de mercado
- Volume exato das ordens
- Identificação correta do agente

## 🎯 Benefícios

### **Detecção Precisa:**
- Identifica padrões específicos de mercado
- Diferencia de outros tipos de TWAP
- Alta precisão na classificação

### **Informações Valiosas:**
- Volume exato do lote
- Intervalo preciso entre ordens
- Padrão de direção identificado
- Consistência temporal medida

### **Integração Natural:**
- Usa a mesma infraestrutura existente
- Compatível com WebSocket e notificações
- Filtros e análises funcionam normalmente

## 🚀 Próximos Passos

1. **Monitorar Performance**: Acompanhar impacto na detecção
2. **Ajustar Parâmetros**: Otimizar baseado em dados reais
3. **Adicionar Métricas**: Mais informações sobre os padrões detectados
4. **Alertas Específicos**: Notificações para padrões importantes
5. **Análise Histórica**: Estatísticas de padrões ao longo do tempo

---

**O sistema TWAP à Mercado está pronto para detectar padrões específicos de trading em tempo real!** 🎉
