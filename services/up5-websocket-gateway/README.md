# UP 5.0 WebSocket Gateway

Gateway WebSocket que faz bridge entre clientes WebSocket e o NATS message bus para streaming de candles em tempo real.

## Funcionalidades

- Conecta clientes WebSocket ao NATS
- Subscribe/unsubscribe dinâmico em tópicos de candles
- Throttling de updates (100ms) para evitar sobrecarga
- Suporta múltiplos clientes simultâneos

## Configuração

Variáveis de ambiente (opcionais):
- `WS_PORT`: Porta do WebSocket (padrão: 3002)
- `NATS_URL`: URL do NATS (padrão: nats://localhost:4222)
- `NATS_SUBJECT_PREFIX`: Prefixo dos tópicos NATS (padrão: up5)

## Execução

```bash
cd services/up5-websocket-gateway
npm install
npm start
```

## Protocolo WebSocket

### Mensagens do Cliente

**Subscribe:**
```json
{
  "type": "subscribe",
  "symbol": "PETR4",
  "exchange": "B",
  "timeframe": "1m"
}
```

**Unsubscribe:**
```json
{
  "type": "unsubscribe",
  "symbol": "PETR4",
  "exchange": "B",
  "timeframe": "1m"
}
```

**Ping:**
```json
{
  "type": "ping"
}
```

### Mensagens do Servidor

**Connected:**
```json
{
  "type": "connected",
  "clientId": "1234567890-0.123",
  "message": "Conectado ao WebSocket Gateway"
}
```

**Subscribed:**
```json
{
  "type": "subscribed",
  "symbol": "PETR4",
  "exchange": "B",
  "timeframe": "1m",
  "subject": "up5.candles.B.PETR4.1m"
}
```

**Candle Update:**
```json
{
  "type": "candle",
  "symbol": "PETR4",
  "exchange": "B",
  "timeframe": "1m",
  "data": {
    "symbol": "PETR4",
    "exchange": "B",
    "timestamp": "2024-01-01T12:00:00Z",
    "open": 25.50,
    "high": 25.75,
    "low": 25.45,
    "close": 25.60,
    "volume": 1000,
    "volumeFinancial": 25600.00,
    "tickCount": 50,
    "isClosed": false
  }
}
```

**Pong:**
```json
{
  "type": "pong"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Mensagem de erro"
}
```

