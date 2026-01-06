# UP 5.0 Candle Aggregator

Serviço C# que consome ticks do NATS, agrega em candles de 1 minuto e publica os candles atualizados, além de persistir candles fechados no PostgreSQL.

## Arquitetura

- **NatsConsumer**: Consome ticks do NATS (`up5.ticks.{exchange}.{symbol}`)
- **CandleAggregator**: Agrega ticks em candles de 1 minuto em memória
- **CandlePublisher**: Publica candles atualizados no NATS (`up5.candles.{exchange}.{symbol}.1m`)
- **PostgresCandlePersistence**: Persiste candles fechados no PostgreSQL/TimescaleDB

## Configuração

Edite `appsettings.json`:

```json
{
  "Nats": {
    "Url": "nats://localhost:4222",
    "SubjectPrefix": "up5",
    "TickSubjectPattern": "up5.ticks.{exchange}.{symbol}",
    "CandleSubjectPattern": "up5.candles.{exchange}.{symbol}.1m"
  },
  "Postgres": {
    "ConnectionString": "Host=localhost;Port=5432;Database=market_data;Username=postgres;Password=postgres",
    "BatchSize": 100,
    "BatchIntervalMs": 1000
  },
  "Aggregation": {
    "CandleIntervalSeconds": 60,
    "CloseDelaySeconds": 2,
    "MaxCandlesInMemory": 1000
  }
}
```

## Execução

```bash
cd services/up5-candle-aggregator
dotnet run
```

## Tabela PostgreSQL

A tabela `candles_1m` deve existir. Execute `verify-table.sql` para verificar e ajustar a estrutura se necessário.

## Fluxo de Dados

1. **Ticks chegam**: Consumidos do NATS (`up5.ticks.{exchange}.{symbol}`)
2. **Agregação**: Ticks são agregados em candles de 1m em memória
3. **Publicação**: Candles atualizados são publicados no NATS (`up5.candles.{exchange}.{symbol}.1m`)
4. **Persistência**: Candles fechados (minuto encerrado + delay) são persistidos no PostgreSQL

## Performance

- Processa milhares de ticks por segundo
- Mantém candles atuais em memória para baixa latência
- Batch insertion otimizado no PostgreSQL
- Throttling automático para evitar sobrecarga

