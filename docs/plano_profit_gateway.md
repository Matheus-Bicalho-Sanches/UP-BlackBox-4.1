# Plano de Desenvolvimento – **Profit Gateway**

> Objetivo: isolar o acesso à ProfitDLL em um serviço dedicado ("Profit Gateway") que forneça market‐data em tempo real, envio/edição de ordens e callbacks de execução, permitindo que os demais microsserviços consumam esses dados via HTTP/WebSocket.

---
## 1. Visão Geral da Arquitetura

```
┌────────────────────────┐        WebSocket (ticks/candles)        ┌──────────────────────────┐
│                        │<───────────────────────────────────────┐│                          │
│    Market-Data         │                                        │  Estratégias / IA        │
│    Recorder            │─────⌂ TimescaleDB (histórico) ───▶     │  (ex.: cálculo de sinais)│
│  (Python + asyncpg)    │                                        │                          │
└────────────────────────┘                                        └──────────────────────────┘
        ▲                                                                ▲
        │ REST (ordens, posições)                                         │ REST
        │                                                                │
┌────────┴─────────┐   WebSocket (ticks)   ┌────────────────────────┐     ┌─────────────────────┐
│                  │<──────────────────────│                        │<────│                     │
│  Front-end       │                       │   Profit Gateway       │     │  Job de Alertas     │
│  (Next.js)       │──── REST / WS ───────▶│  (FastAPI + DLL)       │────▶│  (Python)           │
└──────────────────┘                       │  • Login único DLL      │     └─────────────────────┘
                                           │  • /order, /positions   │
                                           │  • WS /marketdata       │
                                           └────────────────────────┘
```

---
## 2. Componentes e Responsabilidades

| Componente | Linguagem | Responsabilidade Principal |
|------------|-----------|----------------------------|
| **Profit Gateway** | Python/FastAPI | Carrega ProfitDLL, mantém login, expõe REST & WS, reconexão automática, rate-limit, logs. |
| **Market-Data Recorder** | Python (script independente) | Conecta ao WS do Gateway, grava ticks (1 seg) e candles (5m) no TimescaleDB. |
| **Order Service** (existente) | Python/FastAPI | Envia/edita ordens chamando o Gateway (não mais a DLL direta); grava ordens/posições no Firestore. |
| **TimescaleDB** | Docker | Armazém histórico de ticks & candles. |
| **Docker Compose** | YAML | Orquestra containers: timescaledb, profit-gateway, market-recorder, order-service, front-end. |

---
## 3. Cronograma de Entrega (exemplo 4 semanas)

| Semana | Entregas |
|--------|----------|
| **1** | • Docker TimescaleDB funcionando.<br/>• Refatorar wrapper `profit_dll.py` p/ ser usado pelo Gateway.<br/>• Esqueleto FastAPI do Gateway com endpoint health. |
| **2** | • Implementar login único + reconexão.<br/>• Endpoints REST: `/order`, `/orders`, `/positions`.<br/>• Testes manuais enviando ordens via cURL. |
| **3** | • WebSocket `/marketdata` transmitindo ticks.<br/>• Market-Recorder: consolidar 1s / 5m candles e gravar no TimescaleDB.<br/>• Script de plotagem validando dados reais. |
| **4** | • Adaptar Order Service atual para chamar o Gateway.<br/>• Docker-Compose unificado + README.<br/>• Monitoramento básico (logs, restart policy). |

*(Prazos ilustrativos; ajuste conforme recursos.)*

---
## 4. Detalhamento Técnico

### 4.1 Profit Gateway (FastAPI)

| Tarefas | Observações |
|---------|-------------|
| Carregar ProfitDLL via `ctypes` | Reutilizar código em `dll_login.py`. |
| Manter login vivo | `@app.on_event('startup')` executa `login_profit`; timer para `Heartbeat` / reconexão. |
| REST Endpoints | `POST /order`, `POST /edit_order`, `POST /cancel`, `GET /positions`. |
| WebSocket | Rota `/marketdata` envia JSON `{ticker, price, qty, ts}` (máx 10 msgs/s). |
| Segurança | Rate-limit por IP, token de API simples; logs estruturados. |
| Testes | `pytest` + mocks da DLL. |

### 4.2 Market-Data Recorder

1. Conecta no WS; reconecta se cair.  
2. Usa `TickSampler` e `CandleBuilder` (já prototipados).  
3. Insere no TimescaleDB com `asyncpg` em lote (100 linhas).  
4. Config via variáveis de ambiente (DSN, ativo, tf).

### 4.3 Esquema TimescaleDB

```sql
-- ticks (1s)
CREATE TABLE ticks (
  ts TIMESTAMPTZ NOT NULL,
  asset TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  quantity BIGINT,
  PRIMARY KEY (asset, ts)
);
SELECT create_hypertable('ticks','ts');

-- candles_5m
CREATE TABLE candles_5m (
  open_time TIMESTAMPTZ NOT NULL,
  asset TEXT NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low  DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume BIGINT NOT NULL,
  PRIMARY KEY (asset, open_time)
);
SELECT create_hypertable('candles_5m','open_time');
```

### 4.4 Docker-Compose (esboço)

```yaml
version: "3.9"
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_PASSWORD: ${PG_PASS}
    ports: ["5432:5432"]
    volumes:
      - timescale_data:/var/lib/postgresql/data

  profit-gateway:
    build: ./profit_gateway  # Dockerfile inclui DLL + app.py
    environment:
      PG_DSN: postgres://postgres:${PG_PASS}@timescaledb:5432/postgres
      API_TOKEN: ${API_TOKEN}
    depends_on: [timescaledb]

  market-recorder:
    build: ./market_recorder
    environment:
      WS_URL: ws://profit-gateway:8000/marketdata
      PG_DSN: postgres://postgres:${PG_PASS}@timescaledb:5432/postgres
    depends_on: [profit-gateway]

  order-service:
    build: ./UP BlackBox 4.0
    environment:
      GATEWAY_URL: http://profit-gateway:8000
    depends_on: [profit-gateway]

volumes:
  timescale_data:
```

### 4.5 Observabilidade

| Item | Ferramenta | Nota |
|------|------------|------|
| Logs estruturados | `loguru` ou Stdout JSON | Consumidos pelo Docker. |
| Health checks | `/healthz` em cada serviço | Liveness/Readiness probes. |
| Métricas | Expor `/metrics` (Prometheus client) no Gateway. |

---
## 5. Segurança & Confiabilidade

1. **Token de API** para endpoints críticos (`/order`).  
2. **SSL/TLS** se trafegar fora da máquina host.  
3. Política de reconexão automática à DLL (com backoff).  
4. Backup diário do volume `timescale_data`.  
5. Deploy com políticas `restart: always` nos containers.

---
## 6. Próximos Passos Imediatos

1. Definir variáveis de ambiente seguras (`PG_PASS`, `API_TOKEN`).
2. Criar pasta `profit_gateway/` com FastAPI mínimo + wrapper DLL.
3. Adaptar `UP BlackBox 4.0` para usar `GATEWAY_URL` em vez de chamar a DLL direta.
4. Validar fluxo completo em ambiente de desenvolvimento.
5. Escrever README com instruções para subir o `docker-compose`.

---
**Contato**: Para dúvidas durante o desenvolvimento, comentar neste documento ou abrir issue. 