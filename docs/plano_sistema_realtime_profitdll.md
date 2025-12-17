# Plano de Sistema Realtime com ProfitDLL (V1 tipo Profit)

## 1. Objetivo e escopo da V1

- **Objetivo geral**: construir a base de um sistema tipo Profit (Nelogica) capaz de:
  - Receber dados de mercado em tempo real via **ProfitDLL** (trades/ticks e book de ofertas).
  - Armazenar os dados em um backend performático (Postgres + TimescaleDB).
  - Calcular **candles** e **indicadores** em tempo real.
  - Exibir gráficos em um **frontend Next.js**.
- **Escopo da V1** (decisão sua):
  - Apenas **visualização**: cotações, candles e indicadores em tempo real.
  - **Sem envio de ordens** ou DOM avançado nesta primeira versão.

---

## 2. Como a ProfitDLL funciona neste projeto

### 2.1. Visão geral

A ProfitDLL é uma biblioteca Windows que:
- Faz login nos servidores de **roteamento** e **market data** da Nelogica.
- Expõe funções para **login**, **inscrição em ativos** e **requisição de histórico**.
- Entrega dados em tempo real via **callbacks** (funções que o seu código registra e a DLL chama).

No seu repositório atual, a DLL é usada principalmente em:
- `Dll_Profit/manual_profit.txt` (documentação oficial em texto).
- `services/market_feed_next/dll.py` (integração moderna com callbacks V2).
- `services/profit/profit_feed.py` (protótipo que agrega ticks em velas de 1min e grava em banco/Firestore).
- `services/profit/history_probe.py` (script para testar/sondar histórico via `GetHistoryTrades`).

### 2.2. Inicialização e login de mercado

Funções principais (conforme `manual_profit.txt`):
- `DLLInitializeLogin(...)` – login completo (roteamento + market data) com vários callbacks.
- `DLLInitializeMarketLogin(...)` – login focado em **market data** com callbacks de:
  - `StateCallback` – mudanças de estado de conexão.
  - `NewTradeCallback` / `TradeCallbackV2` – novos negócios (trades/ticks em tempo real).
  - `NewDailyCallback` – dados diários agregados (não usado no seu código atual).
  - `PriceBookCallback` / `PriceBookCallbackV2` – livro de preços agregado.
  - `OfferBookCallback` / `OfferBookCallbackV2` – ofertas por agente (tape reading).
  - `HistoryTradeCallback` – trades históricos solicitados via `GetHistoryTrades`.

No código atual (`services/market_feed_next/dll.py` e `services/profit/history_probe.py`), o padrão é:
- Carregar a DLL com `ctypes.WinDLL(...)`.
- Definir as `argtypes`/`restype` das funções utilizadas.
- Chamar `DLLInitializeMarketLogin(activation_key, user, password, state_cb, trade_cb, ..., history_cb, ...)`.
- Esperar o callback de estado indicar **market data conectado** (`state_type == 2` e `result == 4`).

### 2.3. Inscrição em ativos (real-time)

Após o login de market data, o código usa:
- `SubscribeTicker(ticker, exchange)` – assinar o ativo para receber **trades** (ticks).
- `SubscribePriceBook(ticker, exchange)` – assinar o ativo para receber **livro de preços** (book agregado).
- `SubscribeOfferBook(ticker, exchange)` – assinar para receber **ofertas detalhadas por agente**.

No seu código (`services/market_feed_next/dll.py`), isso acontece dentro do callback de estado, quando a conexão de mercado é estabelecida:
- Para cada símbolo desejado, chama `SubscribeTicker`, `SubscribePriceBook` e `SubscribeOfferBook`.

### 2.4. Histórico de trades (`GetHistoryTrades`)

Para histórico, a DLL expõe a função:
- `GetHistoryTrades(ticker, exchange, startDate, endDate)` – descrita em `manual_profit.txt`.

No seu código:
- `services/profit/history_probe.py` e `services/profit/profit_feed.py` configuram um `HistoryTradeCallback`.
- Chamam `GetHistoryTrades(...)` para um intervalo de datas.
- A DLL então dispara múltiplos callbacks `HistoryTradeCallback`, um para cada trade daquele ativo no período.

Trechos relevantes:
- `manual_profit.txt` registra a função `GetHistoryTrades` e o callback associado.
- `profit_feed.py` possui um comentário claro:
  - **"Fala com a ProfitDLL, agrega ticks em velas de 1-minuto"** → candles são derivados dos trades.

### 2.5. Candles x Ticks – o que a DLL realmente fornece?

**Com base no código e na documentação disponível no repositório:**

- **Real-time:**
  - A DLL fornece **trades/ticks individuais** via callbacks (`TradeCallbackType`, `TradeCallbackV2Type`).
  - Fornece também **eventos de book de ofertas** (`PriceBookCallbackV2`, `OfferBookCallbackV2`).
  - **Não há uso de nenhum callback que entregue candles prontos** (OHLC) no seu código atual.

- **Histórico:**
  - A DLL fornece **trades históricos** via `GetHistoryTrades` + `HistoryTradeCallback`.
  - O seu código (`history_probe.py` e `profit_feed.py`) converte esses trades em **candles de 1 minuto** (e outras agregações) manualmente.
  - No manual aparecem erros relacionados a `Dataserie` (`NL_INVALID_SERIE`, `NL_SERIE_NO_HISTORY`), mas não há funções de candles usadas no código atual.

- **Conclusão prática para o projeto:**
  - Para **este sistema**, vamos considerar que a ProfitDLL fornece **apenas trades (ticks) + dados de livro de ofertas** (em tempo real e histórico).
  - **Candles serão sempre construídos pela nossa aplicação**, agregando esses trades.

---

## 3. Estrutura dos eventos (contratos)

Aqui estão os **contratos de dados** que vamos adotar entre:
- DLL → `CollectorService` (C#).
- `CollectorService` → **NATS** (Message Bus escolhido).
- **NATS** → serviços de indicadores/API/frontend.

> **Decisões técnicas aplicadas a todos os contratos**: 
> - **Timestamp**: todos os campos `timestamp` usam **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
> - **Serialização V1**: JSON (pode ser otimizado para binário/msgpack no futuro se necessário).
> - **Candles**: serão sempre derivados de trades (via `GetHistoryTrades` para histórico e callbacks de trades para real-time), não usando `GetSerieHistory` da DLL na V1.

### 3.1. Evento `Trade` (tick em tempo real)

Baseado em `services/market_feed_next/dll.py` (`_trade_cb_v2`) e `TConnectorTrade`:

**Campos recomendados:**
- `type`: sempre `"trade"`.
- `symbol`: string do ativo (ex.: `"WINZ25"`, `"PETR4"`).
- `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
- `price`: preço negociado.
- `quantity`: quantidade (número de contratos/ações).
- `volume_financial`: volume financeiro (quando disponível).
- `trade_id`: identificador único do negócio (TradeNumber).
- `trade_type`: código de tipo de negócio (inteiro, conforme DLL).
- `buy_agent`: ID do agente comprador (quando disponível).
- `sell_agent`: ID do agente vendedor (quando disponível).
- `is_edit`: flag booleana indicando se é um negócio editado/ajustado.

**Exemplo:**
```json
{
  "type": "trade",
  "symbol": "WINZ25",
  "timestamp": 1734432000.123,
  "price": 128500.0,
  "quantity": 5,
  "volume_financial": 642500.0,
  "trade_id": 123456789,
  "trade_type": 0,
  "buy_agent": 3210,
  "sell_agent": 4567,
  "is_edit": false
}
```

### 3.2. Evento `HistoryTrade` (trade histórico via `GetHistoryTrades`)

Baseado em `services/profit/history_probe.py` e `profit_feed.py`:

**Campos recomendados:**
- `type`: sempre `"history_trade"`.
- `symbol`: string do ativo.
- `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC), já convertido a partir da string `"dd/MM/yyyy HH:mm:ss(.mmm)"` da DLL.
- `price`: preço.
- `quantity`: quantidade.
- Opcionalmente podemos reaproveitar os mesmos campos de `Trade` para facilitar reuso:
  - `trade_id`, `buy_agent`, `sell_agent`, `trade_type`, etc.

**Exemplo:**
```json
{
  "type": "history_trade",
  "symbol": "PETR4",
  "timestamp": 1709292323.150,
  "price": 37.25,
  "quantity": 1000,
  "trade_id": 987654321,
  "buy_agent": 1111,
  "sell_agent": 2222,
  "trade_type": 1
}
```

### 3.3. Evento `OrderBookSnapshot` (livro completo)

Baseado em `_price_book_cb_v2` e `_forward_snapshot` em `services/market_feed_next/dll.py`:

**Campos recomendados:**
- `type`: sempre `"order_book_snapshot"`.
- `symbol`: ativo.
- `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
- `bids`: lista de níveis de compra.
- `asks`: lista de níveis de venda.

Cada nível de book:
- `price`: preço daquele nível.
- `quantity`: quantidade total naquele nível.
- Opcionalmente: `level` (posição no book), `orders_count`, etc., se a informação estiver disponível.

**Exemplo:**
```json
{
  "type": "order_book_snapshot",
  "symbol": "WINZ25",
  "timestamp": 1734432001.500,
  "bids": [
    { "level": 0, "price": 128495.0, "quantity": 20 },
    { "level": 1, "price": 128490.0, "quantity": 15 }
  ],
  "asks": [
    { "level": 0, "price": 128505.0, "quantity": 18 },
    { "level": 1, "price": 128510.0, "quantity": 25 }
  ]
}
```

### 3.4. Evento `OrderBookUpdate` (delta incremental)

Baseado em `_forward_event` em `services/market_feed_next/dll.py`:

**Campos recomendados:**
- `type`: sempre `"order_book_update"`.
- `symbol`: ativo.
- `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
- `action`: código de ação no book (inteiro vindo da DLL, ex.: inserir, atualizar, remover).
- `side`: 0 = bid (compra), 1 = ask (venda).
- `position`: posição no book (índice do nível), quando aplicável.
- `price`: preço afetado.
- `quantity`: nova quantidade total naquele nível.
- `offer_count`: quantidade de ofertas agregadas naquele nível (se disponível).

**Exemplo:**
```json
{
  "type": "order_book_update",
  "symbol": "WINZ25",
  "timestamp": 1734432001.900,
  "action": 1,
  "side": 0,
  "position": 0,
  "price": 128495.0,
  "quantity": 25,
  "offer_count": 3
}
```

### 3.5. Evento `OrderBookOffer` (ofertas por agente)

Baseado em `_offer_book_cb` e `_forward_offer` em `services/market_feed_next/dll.py`:

**Campos recomendados:**
- `type`: sempre `"order_book_offer"`.
- `symbol`: ativo.
- `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
- `action`: código da ação (adicionar, atualizar, remover oferta).
- `position`: posição no ranking de ofertas (nível de prioridade).
- `side`: 0 = bid, 1 = ask.
- `quantity`: quantidade daquela oferta específica.
- `agent_id`: ID do player.
- `offer_id`: identificador único da oferta.
- `price`: preço da oferta.

**Exemplo:**
```json
{
  "type": "order_book_offer",
  "symbol": "WINZ25",
  "timestamp": 1734432002.050,
  "action": 0,
  "position": 5,
  "side": 1,
  "quantity": 10,
  "agent_id": 5555,
  "offer_id": 11223344,
  "price": 128510.0
}
```

### 3.6. Evento `Candle` (DERIVADO dos trades, não vem da DLL)

**Importante**: Os candles não são fornecidos prontos pela DLL na V1. Eles serão construídos pela nossa aplicação através da agregação de trades obtidos via `GetHistoryTrades` (histórico) e callbacks de trades em tempo real. Padronizamos o formato que nosso serviço de agregação vai produzir.

**Campos recomendados:**
- `type`: sempre `"candle"`.
- `symbol`: ativo.
- `timeframe`: string de período (ex.: `"1m"`, `"5m"`, `"1s"`).
- `open_time`: **epoch float64** (início do candle, segundos desde 1970-01-01 UTC).
- `close_time`: **epoch float64** (fim do candle, opcional – pode ser `open_time + timeframe`).
- `open`: primeiro preço do candle.
- `high`: maior preço.
- `low`: menor preço.
- `close`: último preço.
- `volume`: soma da quantidade negociada no período.
- `trades`: número de negócios no período.
- Opcional: `vwap`, `buy_volume`, `sell_volume`, etc.

**Exemplo:**
```json
{
  "type": "candle",
  "symbol": "WINZ25",
  "timeframe": "1m",
  "open_time": 1734432000.0,
  "close_time": 1734432059.999,
  "open": 128480.0,
  "high": 128510.0,
  "low": 128470.0,
  "close": 128500.0,
  "volume": 350,
  "trades": 42
}
```

---

## 4. Passos de implementação (resumo do plano)

### 4.1. Passo 1 – Fechar o contrato de mensagens

- **Definir oficialmente** os contratos acima (`Trade`, `HistoryTrade`, `OrderBookSnapshot`, `OrderBookUpdate`, `OrderBookOffer`, `Candle`).
- **Decisões finais já tomadas**:
  - Formato de serialização para V1: **JSON**.
  - Padrão de `timestamp`: **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos).
- Nomear os **tópicos/canais** do **NATS** (Message Bus escolhido):
  - `trades.{symbol}`
  - `history_trades.{symbol}`
  - `order_book.snapshots.{symbol}`
  - `order_book.updates.{symbol}`
  - `order_book.offers.{symbol}`
  - `candles.{symbol}.{timeframe}`
  - `indicators.{symbol}.{timeframe}` (para fase de indicadores).

### 4.2. Passo 2 – `CollectorService` em C# (camada DLL)

- Criar um projeto C# (.NET 6+) que:
  - Carrega a `ProfitDLL.dll` com `DllImport`/PInvoke ou `WinDLL` equivalente.
  - Implementa os callbacks:
    - `StateCallback` (para saber quando conectar/inscrever).
    - `TradeCallback` / `TradeCallbackV2` → converte para evento `Trade`.
    - `PriceBookCallbackV2` → converte para `OrderBookSnapshot` e `OrderBookUpdate`.
    - `OfferBookCallbackV2` → converte para `OrderBookOffer`.
  - Chama `DLLInitializeMarketLogin(...)` com as credenciais do `.env`.
  - Ao conectar, chama `SubscribeTicker/SubscribePriceBook/SubscribeOfferBook` para os símbolos desejados.
  - Publica os eventos no **NATS** (Message Bus escolhido) usando os contratos da seção 3.

### 4.3. Passo 3 – Message Bus NATS como fronteira

- Subir o **NATS Server** (escolhido para este projeto):
  - Instalar e configurar NATS Server (leve, baixa latência, fácil de usar).
  - Configurar para rodar localmente na máquina Windows ou em servidor separado.
- O `CollectorService` em C# será **producer** dos tópicos de mercado, usando o cliente `NATS.Client` (NuGet).
- Demais serviços (agregador de candles, indicadores, API) serão **consumers** desses tópicos, usando:
  - Python: `nats-py`
  - Node.js/Next.js: `nats` (se necessário)

### 4.4. Passo 4 – TimescaleDB + esquema inicial

- Configurar **Postgres + TimescaleDB** (local ou em servidor):
  - Criar banco específico para mercado, ex.: `market_data`.
- Criar tabelas como **hypertable**:
  - `ticks(trade_id, symbol, ts, price, quantity, volume_financial, trade_type, buy_agent, sell_agent, is_edit, ...)`.
  - `candles(symbol, timeframe, open_time, close_time, open, high, low, close, volume, trades, ...)`.
- Criar um serviço (Python/Node/Go) que:
  - Consome `trades.{symbol}` do NATS e grava em `ticks` via **batch insert**.
  - **Agrega ticks em memória** (não usa `GetSerieHistory` da DLL) e gera candles de `1m` (e outros timeframes), publicando `candles.{symbol}.{timeframe}` no NATS e gravando em `candles`.
  - Para histórico, também usa `GetHistoryTrades` da DLL (via `CollectorService` ou chamada direta) e agrega os trades em candles.

### 4.5. Passo 5 – Engine de indicadores em streaming

- Criar serviço `IndicatorEngine` (preferencialmente em Python com NumPy/pandas ou em Rust/Go para máxima performance):
  - Consome `candles.{symbol}.{timeframe}`.
  - Mantém buffers em memória (ex.: últimos 500–1000 candles por ativo/timeframe).
  - Calcula indicadores **incrementalmente**:
    - EMA/SMA, Bollinger, RSI, VWAP, etc.
  - Publica resultados em `indicators.{symbol}.{timeframe}`.
- Não é obrigatório persistir indicadores no banco na V1 – apenas streaming para o frontend já atende.

### 4.6. Passo 6 – API Realtime (WebSocket) + REST de histórico

- Implementar um **gateway WebSocket** (preferencialmente no próprio projeto Next.js):
  - O WS faz subscribe nos tópicos do **NATS**.
  - O cliente envia uma mensagem de subscribe com `{ symbol, timeframe, streams }`.
  - O servidor agrupa/limita os updates (por exemplo, pacotes a cada 50–100 ms) para evitar sobrecarga no browser.
- Implementar endpoints REST para histórico:
  - `GET /api/history/candles?symbol=WINZ25&timeframe=1m&from=...&to=...`
  - Usam TimescaleDB para buscar blocos de dados.

### 4.7. Passo 7 – Frontend de gráficos em tempo real (Next.js)

- Criar uma página em Next.js, ex.: `/dashboard/realtime`:
  - Seletor de ativo e timeframe.
  - Componente de gráfico (ex.: **TradingView Lightweight Charts** ou equivalente) para candles.
  - Overlay de indicadores (EMA, Bollinger, etc.).
- Implementar um hook `useRealtimeChart(symbol, timeframe)` que:
  - Abre conexão WebSocket.
  - Envia a mensagem de subscribe.
  - Mantém estado local dos candles + indicadores.
  - Faz **coalescing** de updates para evitar re-renderizar a cada tick.

### 4.8. Passo 8 – Testes de carga e observabilidade

- Criar um **simulador de feed**:
  - Script que publica eventos `Trade` e `OrderBook*` falsos no **NATS**, simulando milhares de msgs/s.
- Medir:
  - Latência DLL → Collector → Message Bus → API → Frontend.
  - Uso de CPU e memória nos serviços mais críticos.
- Adicionar métricas simples (logs/contadores) para identificar gargalos e otimizar conforme necessário.

---

## 5. Resumo da resposta sobre a DLL

- **Dados em tempo real**: a ProfitDLL, da forma como está usada neste repositório, fornece **trades/ticks individuais** e **dados de livro de ofertas** via callbacks. **Não há candles prontos** sendo usados.
- **Dados históricos**: o acesso é feito via `GetHistoryTrades`, que devolve **trades históricos**, processados pelos callbacks de histórico. Os candles são construídos no código Python a partir destes trades.
- **Para este projeto**, vamos padronizar que **todos os candles serão derivados de trades** (tanto em tempo real quanto em histórico), mantendo a DLL como fonte de verdade para trades e book.