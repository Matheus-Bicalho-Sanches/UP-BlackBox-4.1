# 🚀 Quick Start - Estratégia Voltaamedia_Bollinger_1min_WINQ25

## ⚡ Configuração Rápida (5 minutos)

### 1. Preparar Ambiente
```bash
cd services/quant
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Testar Estratégia (RECOMENDADO)
```bash
python test_strategy.py
```
✅ **Analise os resultados** antes de prosseguir!

### 3. Configurar APIs
- ✅ UP BlackBox rodando: `http://localhost:8000`
- ✅ Market Feed rodando: `http://localhost:8001`
- ✅ Firebase configurado em `UP BlackBox 4.0/secrets/`

## 🎯 Executar Estratégia

### 1. Criar Estratégia no Frontend
1. Acesse: `http://localhost:3000/dashboard/market-data/teste-2`
2. Clique: **"Nova Estratégia"**
3. Preencha:
   ```
   Nome: Voltaamedia_Bollinger_1min_WINQ25
   Carteira BlackBox: [Selecione uma existente]
   Tamanho Posição: 10.0%
   Status: ✅ Ativo
   ```

### 2. Garantir Dados de Mercado
1. Acesse: `http://localhost:3000/dashboard/market-data/teste-1`
2. Adicione: **WINQ25** ao acompanhamento
3. Aguarde acúmulo de pelo menos 20 candles de 1min

### 3. Iniciar Quant Engine
```bash
start_quant_engine.bat
```

## 📊 Monitoramento

### Logs em Tempo Real
```bash
tail -f quant_engine.log
```

### Interface Web
- **Monitor de Sinais**: `/dashboard/market-data/teste-3`
- **Ordens Executadas**: `/dashboard/up-blackbox4/ordens`
- **Posições**: `/dashboard/up-blackbox4/posicoes`

## 🚨 Segurança

### 🔴 MODO ATUAL: TRADING REAL
No arquivo `config.json`:
```json
"safety": {
  "paper_trading_mode": false  // ← ORDENS REAIS!
}
```

**⚠️ ATENÇÃO:** Paper trading está **DESATIVADO**. As ordens serão enviadas para sua conta real de simulação.

### Para reativar Paper Trading (apenas teste):
```json
"safety": {
  "paper_trading_mode": true
}
```

## 📈 Lógica da Estratégia

```
WINQ25 (Mini Índice - 1min) + Bollinger Bands (20, 1.0, SMA)

🎯 SISTEMA DE ORDENS LIMITADAS SEMPRE ATIVAS:
• Sem posição: Mantém ordem de compra na banda inferior
• Com posição: Mantém ordem de venda na média BB
• Atualiza preços automaticamente conforme bandas se movem

🟢 COMPRA (Ordem Limitada):
• Condição: Sempre ativa quando sem posição
• Preço: Banda Inferior das Bollinger Bands
• Quantidade: 1 contrato
• Execução: Automática quando preço atingir banda inferior

🔴 VENDA (Ordem Limitada):
• Condição: Sempre ativa quando com posição
• Preço: Média das Bollinger Bands
• Quantidade: Toda posição atual
• Execução: Automática quando preço atingir média BB

🔄 GESTÃO AUTOMÁTICA:
• Cancela e reenvia ordens quando preços das bandas mudam
• Monitora ordens ativas vs. posições atuais
• Atualiza preços se diferença > R$ 0,50
• Sistema proativo (não reativo)

🔒 VANTAGENS:
• Ordens sempre no mercado aguardando execução
• Não perde oportunidades de entrada/saída
• Preços sempre atualizados com as bandas
• Execução automática sem monitoramento manual

💡 DIFERENÇA PRINCIPAL: Sistema mantém ordens LIMITADAS ativas no mercado, não aguarda condições para enviar ordens a mercado
```

## 🆘 Problemas Comuns

| Erro | Solução |
|------|---------|
| "Firebase credentials not found" | Verificar arquivo em `UP BlackBox 4.0/secrets/` |
| "Dados insuficientes" | Aguardar mais candles ou adicionar WINQ25 ao acompanhamento |
| "Erro ao enviar ordem" | Verificar se UP BlackBox API está ativa |
| "Estratégia não encontrada" | Verificar nome exato no frontend |

## 🎯 Próximos Passos

1. ✅ **Teste com dados simulados**
2. ✅ **Execute em paper trading**
3. ✅ **Monitore por algumas horas**
4. ✅ **Analise performance**
5. ⚠️ **Considere modo real apenas após validação completa**

## 🔍 Verificação dos Serviços

### Verificador Automático (RECOMENDADO)
```bash
python check_services.py
```

### Status Individual
```bash
# Verificar APIs
curl http://localhost:8000/health  # UP BlackBox
curl http://localhost:8001/health  # Profit Feed

# Testar instalação
python test_installation.py
```

## 🛠️ Troubleshooting

### ❌ Problema: Erros de Unicode no Console
**Solução:** ✅ **RESOLVIDO** - Sistema agora remove emojis automaticamente do console Windows

### ❌ Problema: "must be real number, not NoneType" 
**Causa:** UP BlackBox espera campo `price` mesmo em ordens "market"
**Solução:** ✅ **RESOLVIDO** - Quant Engine agora envia preço atual automaticamente
**Teste:** `python test_fix.py`

### ❌ Problema: "Dados insuficientes para WINQ25: 0 candles"
**Causa:** Profit Feed não está enviando dados
**Solução:**
1. Inicie o Profit Feed: `cd services\profit && python dispatcher.py`
2. Aguarde 1-2 minutos para acúmulo de dados
3. Verifique Firebase Console: `marketDataDLL > WINQ25 > candles_1m`

### ❌ Problema: Estratégia não executando
**Verificar:**
1. ✅ Estratégia ativa no frontend
2. ✅ Nome exatamente igual: `Voltaamedia_Bollinger_1min_WINQ25`
3. ✅ Dados de mercado disponíveis (>20 candles)
4. ✅ UP BlackBox API rodando

📖 **Guia completo:** `TROUBLESHOOTING.md`

---
**🔥 Status Atual**: Paper trading **DESATIVADO** - usando conta de simulação real conforme solicitado! 