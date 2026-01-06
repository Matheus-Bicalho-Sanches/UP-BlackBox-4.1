# Implementação - Passos 1 e 2

Este documento descreve o que foi implementado conforme o plano em `docs/plano_sistema_realtime_profitdll.md`.

## Passo 1: Contratos de Mensagens ✅

### Contratos Implementados

Todos os contratos foram criados em `Models/` com as seguintes características:

1. **TradeEvent.cs** - Trades em tempo real
   - Tópico NATS: `trades.{symbol}`
   - Timestamp: epoch float64
   - Campos: price, quantity, volumeFinancial, tradeId, tradeType, buyAgent, sellAgent, isEdit

2. **HistoryTradeEvent.cs** - Trades históricos
   - Tópico NATS: `history_trades.{symbol}`
   - Timestamp: epoch float64 (convertido da string da DLL)

3. **OrderBookSnapshotEvent.cs** - Snapshots completos do livro
   - Tópico NATS: `order_book.snapshots.{symbol}`
   - Contém arrays de bids e asks com BookLevel

4. **OrderBookUpdateEvent.cs** - Updates incrementais
   - Tópico NATS: `order_book.updates.{symbol}`
   - Campos: action, side, position, price, quantity, offerCount

5. **OrderBookOfferEvent.cs** - Ofertas por agente
   - Tópico NATS: `order_book.offers.{symbol}`
   - Campos: action, side, position, quantity, agentId, offerId, price

### Tópicos NATS

Definidos em `NatsTopics.cs` com métodos estáticos para gerar nomes de tópicos:
- `Trades(symbol)`
- `HistoryTrades(symbol)`
- `OrderBookSnapshots(symbol)`
- `OrderBookUpdates(symbol)`
- `OrderBookOffers(symbol)`
- `Candles(symbol, timeframe)` - para uso futuro
- `Indicators(symbol, timeframe)` - para uso futuro

### Decisões Técnicas Aplicadas

- ✅ **Timestamp**: epoch float64 em todos os eventos
- ✅ **Serialização**: JSON (camelCase via System.Text.Json)
- ✅ **Candles**: serão derivados de trades (não implementado ainda - será no Passo 4)

## Passo 2: CollectorService em C# ✅

### Estrutura Criada

1. **DLLInterop.cs**
   - Declarações P/Invoke para ProfitDLL.dll
   - Callbacks: TStateCallback, TConnectorTradeCallback, TPriceBookCallbackV2, TOfferBookCallbackV2
   - Funções: DLLInitializeMarketLogin, SubscribeTicker, SubscribePriceBook, SubscribeOfferBook, etc.
   - TranslateTrade para converter ponteiros de trade para estruturas

2. **DataTypes/**
   - `TAssetID.cs` - Identificação de ativo (versão antiga)
   - `TConnectorAssetIdentifier.cs` - Identificação de ativo (versão moderna V2)
   - `TConnectorTrade.cs` - Estrutura de trade
   - `SystemTime.cs` - Estrutura de data/hora Windows

3. **CollectorService.cs**
   - Inicializa conexão NATS
   - Configura callbacks da DLL
   - Converte eventos da DLL para modelos de mensagens
   - Publica eventos no NATS nos tópicos apropriados
   - Gerencia ciclo de vida (Initialize, Dispose)

4. **Program.cs**
   - Entry point
   - Carrega configuração (appsettings.json + variáveis de ambiente)
   - Tenta carregar .env automaticamente (Dll_Profit/.env ou .env local)
   - Valida configuração
   - Inicializa e mantém o serviço rodando

5. **Config/**
   - `CollectorConfig.cs` - Classe de configuração

6. **Utils/**
   - `DateTimeUtils.cs` - Conversão de datas para epoch float64

### Funcionalidades Implementadas

- ✅ Carregamento da DLL via P/Invoke
- ✅ Inicialização com DLLInitializeMarketLogin
- ✅ Callbacks V2 configurados (SetTradeCallbackV2, SetPriceBookCallbackV2, etc.)
- ✅ Conversão de trades via TranslateTrade
- ✅ Subscrição automática em símbolos configurados
- ✅ Publicação de eventos no NATS
- ✅ Tratamento de erros e logging

### Pontos de Atenção / TODO

- ⚠️ **ParseBookSnapshot**: Implementação simplificada - parse completo de arrays de book precisa ser implementado (linha ~323 em CollectorService.cs)
- ⚠️ **Callbacks de histórico**: GetHistoryTrades não está sendo chamado ainda (será implementado quando necessário)
- ⚠️ **Caminho da DLL**: Atualmente hardcoded como "ProfitDLL.dll" - considerar tornar configurável via DllPath

## Próximos Passos (Conforme Plano)

### Passo 3: Message Bus NATS
- [ ] Instalar e configurar NATS Server
- [ ] Documentar como subir NATS localmente

### Passo 4: TimescaleDB + Agregação de Candles
- [ ] Configurar Postgres + TimescaleDB
- [ ] Criar tabelas (ticks, candles)
- [ ] Implementar serviço de agregação que consome trades do NATS e gera candles

### Passo 5: IndicatorEngine
- [ ] Implementar cálculo de indicadores em streaming

### Passo 6: API Realtime + REST
- [ ] WebSocket gateway no Next.js
- [ ] Endpoints REST para histórico

### Passo 7: Frontend
- [ ] Página de gráficos em tempo real
- [ ] Integração com TradingView Lightweight Charts

### Passo 8: Testes e Otimizações
- [ ] Simulador de feed
- [ ] Testes de carga
- [ ] Métricas e observabilidade

## Como Testar os Passos 1 e 2

1. **Configurar NATS**:
   ```bash
   # Via Docker
   docker run -p 4222:4222 nats
   ```

2. **Configurar credenciais**:
   - Edite `appsettings.json` ou use variáveis de ambiente
   - Ou coloque um `.env` em `Dll_Profit/` com ACTIVATION_CODE, login, password

3. **Compilar**:
   ```bash
   cd services/market_collector
   dotnet build
   ```

4. **Executar**:
   ```bash
   dotnet run
   # ou
   start_collector.bat
   ```

5. **Verificar mensagens no NATS**:
   ```bash
   # Instale NATS CLI: https://github.com/nats-io/natscli/releases
   nats sub "trades.>" 
   ```

## Notas Finais

- O código está pronto para receber dados da DLL e publicar no NATS
- A estrutura permite fácil extensão para próximos passos
- Logs detalhados ajudam no debugging
- Configuração flexível (appsettings.json, .env, ou variáveis de ambiente)
