## Planejamento de Arquitetura e Implementação

Automação BlackBox Multi-contas: market data em tempo real, persistência de candles 1m, agregação para timeframes maiores, execução de estratégias quantitativas e envio de ordens via DLL nas contas dos clientes.

## Objetivos
- Subscrever/desubscrever ativos pelo frontend (por usuário) com controle global de ingestão.
- Persistir candles 1m como base canônica (histórico confiável e idempotente).
- Agregar 5m/15m/60m/1d/1w de forma consistente (timezone B3).
- Disponibilizar APIs e WS para leitura/stream de dados.
- Evoluir para estratégias em tempo real, OMS e execução via DLL com segurança, auditoria e gestão de risco.

## Visão Geral da Arquitetura
- Ingestion Service (Node/Python): consome o feed (ticks ou 1m), consolida e upserta candles 1m em banco timeseries.
- Banco Timeseries (TimescaleDB ou ClickHouse): armazena 1m (canônico) e agregados (continuous aggregates ou consultas on-the-fly).
- API/WS Gateway: expõe endpoints REST (subscribe/unsubscribe, candles) e um WS para “current candle”.
- Gerenciamento de Assinaturas:
  - Por usuário: lista de símbolos do usuário.
  - Global: refCount por símbolo para ligar/desligar ingestão no feed.
- Strategy Runtime: processos que recebem market data e emitem sinais.
- Event Bus (Kafka/NATS/Redis Streams): trafega market-data, signals, orders, executions.
- OMS (Order Management System): orquestra ordens, aloca por cliente, idempotência e auditoria.
- Adapter DLL: serviço Windows que fala com a DLL (fila/retentativa/reconexão) e com o OMS.
- Risco e Compliance: pre-trade limits, kill switch, reconciliação pós-trade.
- Observabilidade, Segurança e Governança: logs/métricas/tracing, secrets, autorização e trilha de auditoria.

## Timezone e Canonicidade
- Canônico: armazenar timestamps em UTC.
- Fronteiras de bucket: calculadas na timezone da bolsa (America/Sao_Paulo, configurável) e convertidas para UTC na persistência.
- Frontend e APIs: retornam times coerentes com essa política; labels em TZ configurada.

## Modelagem dos Dados
- Tabela 1m (canônica):
  - symbol (string), exchange (string)
  - ts_minute_utc (timestamp UTC, início do minuto de negociação)
  - open, high, low, close (float)
  - volume (int), volume_financeiro (decimal), num_trades (int), vwap (decimal)
  - PK/unique: (symbol, ts_minute_utc)
  - Índices: (symbol, ts_minute_utc)
- Agregados (5m/15m/60m/1d/1w):
  - Mesmo schema, PK (symbol, ts_bucket_utc)
  - Gerados por continuous aggregates (preferencial) ou consultas de agrupamento on-the-fly.

## APIs (contratos de alto nível)
- POST /api/market/subscribe { symbol, exchange }
  - Autenticado; atualiza lista do usuário; incrementa refCount global; inicia ingestão se 1º assinante global.
- POST /api/market/unsubscribe { symbol }
  - Autenticado; remove do usuário; decrementa refCount; encerra ingestão se 0 assinantes globais.
- GET /api/candles?symbol=...&timeframe=1m|5m|15m|60m|1d|1w&from=ISO&to=ISO&limit=N
  - Retorna candles ordenados asc, baseados em UTC; fronteiras por TZ de bolsa.
- WS /ws/market?symbol=...
  - Emite o “current candle” do minuto em curso e “close” do minuto anterior.
- (Fase OMS) POST /api/orders, GET /api/orders/:id, POST /api/orders/:id/cancel
  - Idempotência, ciclo de vida e auditoria.

## Event Bus (quando estratégias entrarem em cena)
- Tópicos/streams sugeridos:
  - market_data.1m.{symbol}
  - strategy.signals.{strategyId}
  - oms.orders.new, oms.orders.ack, oms.exec.fills
- Schema estável (JSON/Avro), versionado, com campos mínimos: ids, timestamps, origem, payload, assinatura de integridade.

## OMS e Adapter DLL (alto nível)
- OMS: recebe sinais → constrói ordens → aloca por cliente → aplica pre-trade risk → envia ao Adapter DLL.
- Adapter DLL: serviço Windows com fila, idempotência, reconexão e logs detalhados. Comunica-se com OMS via gRPC/HTTP/IPC.
- Pós-trade: callbacks/execuções retornam ao OMS, atualizando posições e auditoria.

## Segurança, Risco e Auditoria
- AuthN/AuthZ por usuário/role (configurar/ativar estratégias, enviar ordens).
- Pre-trade risk por cliente/estratégia: limites notional, qty, alavancagem, posição, horários.
- Kill switch/circuit breaker: global, por estratégia e por cliente.
- Auditoria E2E: do sinal ao fill, com timestamps, versões e parâmetros da estratégia.

## Passo a Passo de Implementação (Fases)

### Fase 0 — Infra e Fundamentos
- Decidir banco timeseries (TimescaleDB ou ClickHouse). Provisionar instância.
- Definir TZ padrão (ex.: America/Sao_Paulo) via env: NEXT_PUBLIC_EXCHANGE_TZ.
- Criar repositório/serviço para o Ingestion Service e para o Adapter DLL.

### Fase 1 — Tabela 1m e Ingestão Canônica
- DDL (exemplo TimescaleDB):
  - Table candles_1m(symbol, ts_minute_utc, o,h,l,c, v, vf, trades, vwap, PRIMARY KEY(symbol, ts_minute_utc)).
  - Índices por (symbol, ts_minute_utc); hypertable (time_partition_col=ts_minute_utc).
- Ingestion Service:
  - Conectar ao feed (ticks ou 1m).
  - Se tick: mapear para minuto (TZ bolsa → bucket UTC) e upsert consolidado.
  - Se 1m: validar e upsert direto.
  - Janela de retificação (ex.: 3 min) para late data; tarefa de reprocesso.
  - Métricas: latência feed→persistência, erros, lacunas.

### Fase 2 — API de Leitura e WS
- REST GET /api/candles com paginação/limit, filtros por intervalo.
- WS /ws/market: envia “current candle” do minuto em curso e close anterior.
- Normalizar timezone em ambas as saídas (UTC + labels TZ bolsa no cliente).

### Fase 3 — Subscrição por Usuário e Controle Global
- Tabela/coleção user_subscriptions(userId → [symbols]).
- Tabela/coleção subscriptions_global(symbol → { refCount, exchange }).
- POST /subscribe e /unsubscribe:
  - Idempotentes; alteram lista do usuário e refCount global.
  - No 1º assinante global: iniciar ingestão do símbolo. No último a sair: encerrar ingestão.
- UI: lista por usuário; não interfere nos demais.

### Fase 4 — Agregação 5m/15m/60m/1d/1w
- TimescaleDB: continuous aggregates (time_bucket com timezone) ou ClickHouse: materialized views.
- Alternativa: gerar on-the-fly em SQL (menos performático, mais simples inicialmente).
- Garantir fronteiras definidas pela TZ da bolsa; persistir bucket “start” em UTC.

### Fase 5 — Frontend
- Histórico: GET /api/candles. Live: WS único (sem misturar fontes).
- Filtros/timeframes; labels em TZ da bolsa; sem agregação client-side (ou só fallback).
- UX de subscribe/unsubscribe por usuário; exibição determinística em ordem alfabética.

### Fase 6 — Strategy Runtime (MVP)
- Serviço/worker que consome market_data.1m e publica strategy.signals.
- Parametrização de estratégia e controle de ativação (paper vs live).
- Logs e métricas por estratégia (latência, throughput, erros).

### Fase 7 — Event Bus
- Introduzir Kafka/NATS/Redis Streams.
- Contratos versionados para market_data, signals, orders, executions.
- Replay/auditoria via retenção configurada.

### Fase 8 — OMS (MVP)
- API de ordens idempotente. Estados: NEW → SENT → ACK/REJECT → PARTIAL/FILLED/CANCELED.
- Alocação por cliente (percentual/notional/qty). Throttling/limites básicos.
- Persistência completa do ciclo de vida e correlação com signals.

### Fase 9 — Adapter DLL (MVP)
- Serviço Windows com fila, reconexão, health check, logs em arquivo e centralizados.
- Integração com OMS: gRPC/HTTP/IPC; idempotência por clientOrderId.
- Callbacks da DLL → OMS (execuções, erros, estados de sessão).

### Fase 10 — Risco e Kill Switch
- Pre-trade: valida limites antes de liberar ordem para o Adapter.
- Kill switch por cliente/estratégia/global. Circuit breaker por erro/latência.

### Fase 11 — Posições, Caixa e Reconciliação
- Store de posições em tempo real (Redis + DB). Importação periódica da corretora.
- Reconciliação e alertas de divergência.

### Fase 12 — Observabilidade, Segurança e Operação
- Dashboards (Grafana), logs (ELK), tracing (OTel).
- Secret Manager/Vault; políticas de acesso; trilha de auditoria E2E.
- Runbooks: incidentes comuns, rollback, recuperação.

## Critérios de Aceite (MVP de Dados)
- 1m canônico persistido com PK (symbol, ts_minute_utc) e upsert idempotente.
- Continuous aggregates prontos para 5m/15m/60m/1d/1w.
- APIs de leitura performáticas e WS funcionando sem duplicidades.
- Subscrição por usuário não interfere em terceiros; ingestão global controlada por refCount.
- Timezone consistente em agregação e exibição.

## Backtests
- Export de candles por símbolo/timeframe/intervalo.
- Scripts offline e/ou serviço dedicado que lê direto do banco timeseries.
- Mesmos contratos de dados do runtime para garantir reprodutibilidade.

## Plano de Rollout
- Paper trading com subset de clientes.
- Feature flags por estratégia e por cliente.
- Go-live faseado (poucos ativos, depois ampliar).

## Riscos e Mitigações
- Late data → janela de retificação + reprocesso.
- Falhas no DLL → fila/idempotência/reconexão + health checks.
- Carga de leitura alta → caches, pagination, downsampling/agregados.
- Interferência entre usuários → segregação por usuário e refCount global separado.

## Checklist de Configuração
- Variáveis de ambiente:
  - NEXT_PUBLIC_EXCHANGE_TZ=America/Sao_Paulo
  - Credenciais do banco timeseries e do feed.
  - Segredos do Adapter DLL.
- Infra:
  - TimescaleDB/ClickHouse provisionado e acessível.
  - Event bus provisionado (quando aplicável).
  - Observabilidade (coleta de logs/métricas).

## Próximos Passos Imediatos
1) Provisionar banco timeseries e criar tabela 1m com PK/índices.
2) Implementar Ingestion Service com upsert idempotente e janela de retificação.
3) Criar GET /api/candles e WS /ws/market.
4) Implementar subscribe/unsubscribe por usuário com refCount global.
5) Configurar agregação server-side (continuous aggregates) e ajustar frontend para consumir.
6) Preparar esqueleto do Strategy Runtime e contratos no event bus.
7) Iniciar OMS + Adapter DLL (MVP) com operações paper; depois live.

> Com essa base, você terá dados confiáveis, APIs estáveis e o caminho pavimentado para execução quantitativa multi-contas com segurança e auditabilidade.


