# UP 5.0 Tick Collector

Serviço C# otimizado para coletar ticks da ProfitDLL, processar em paralelo e publicar em tempo real via NATS, além de persistir em PostgreSQL/TimescaleDB.

## Arquitetura

- **ProfitDllConnector**: Wrapper C# para P/Invoke da DLL com callbacks não-bloqueantes
- **TickProcessor**: Processamento paralelo de ticks com batching
- **SubscriptionManager**: Gerenciamento dinâmico de subscriptions via Firestore
- **NatsPublisher**: Publicação de eventos no message bus NATS
- **PostgresPersistence**: Persistência em batch no PostgreSQL/TimescaleDB
- **ConnectionManager**: Gerenciamento de estado de conexão com auto-reconexão

## Configuração

Edite `appsettings.json`:

```json
{
  "ProfitDll": {
    "DllPath": "ProfitDLL.dll",
    "ActivationKey": "...",
    "User": "...",
    "Password": "..."
  },
  "Nats": {
    "Url": "nats://localhost:4222"
  },
  "Postgres": {
    "ConnectionString": "Host=localhost;Database=up5;Username=postgres;Password=..."
  },
  "Firestore": {
    "ProjectId": "...",
    "CollectionName": "activeSubscriptions"
  }
}
```

## Execução

```bash
cd services/up5-tick-collector
dotnet run
```

## Estrutura de Dados

### Ticks (NATS: `up5.ticks.{exchange}.{symbol}`)

```json
{
  "symbol": "WING26",
  "exchange": "F",
  "timestamp": 1734432000.123,
  "price": 163.040,
  "quantity": 10,
  "volumeFinancial": 1630.40,
  "tradeId": 12345678,
  "tradeType": 2,
  "buyAgent": 123,
  "sellAgent": 456,
  "isEdit": false
}
```

### Persistência PostgreSQL

Tabela: `ticks_raw` (hypertable TimescaleDB)

## Performance

- Processa 10k+ ticks/segundo
- Suporta 50+ ativos simultaneamente
- Latência < 10ms entre callback e publicação
- Batch insertion otimizado no PostgreSQL

