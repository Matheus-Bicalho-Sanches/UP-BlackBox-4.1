# Market Collector Service

Serviço C# que coleta dados de mercado da ProfitDLL e publica no NATS.

## Estrutura

- **Models/**: Contratos de mensagens (TradeEvent, OrderBookSnapshotEvent, etc.)
- **DataTypes/**: Estruturas de dados da DLL (TConnectorTrade, SystemTime, etc.)
- **DLLInterop.cs**: Declarações de interop com ProfitDLL.dll
- **CollectorService.cs**: Serviço principal que faz DLL → NATS
- **Program.cs**: Entry point

## Configuração

### Opção 1: appsettings.json

Edite `appsettings.json`:

```json
{
  "CollectorConfig": {
    "ActivationKey": "sua-activation-key",
    "User": "seu-usuario",
    "Password": "sua-senha",
    "DllPath": "ProfitDLL.dll",
    "NatsUrl": "nats://localhost:4222",
    "Symbols": ["WINZ25:F", "PETR4:B"],
    "DefaultExchange": "B"
  }
}
```

### Opção 2: Variáveis de Ambiente

Configure variáveis de ambiente (sobrescrevem appsettings.json):
- `ACTIVATION_CODE`
- `login`
- `password`
- `DLL_PATH`
- `NATS_URL`

### Opção 3: Arquivo .env

O serviço tenta carregar automaticamente de:
1. `Dll_Profit/.env` (padrão do projeto)
2. `.env` no diretório atual

Formato do .env:
```
ACTIVATION_CODE=seu-codigo
login=seu-usuario
password=sua-senha
```

## Pré-requisitos

1. **.NET 8 SDK**
   - Baixe em: https://dotnet.microsoft.com/download/dotnet/8.0
2. **ProfitDLL.dll** no mesmo diretório ou caminho configurado
   - A DLL deve estar acessível (mesma pasta ou PATH)
3. **NATS Server** rodando (padrão: `nats://localhost:4222`)
   - Download: https://github.com/nats-io/nats-server/releases
   - Ou via Docker: `docker run -p 4222:4222 nats`

## Compilação

```bash
dotnet build
```

## Execução

### Windows (Script)

```bash
start_collector.bat
```

### Manual

```bash
dotnet run
```

## Tópicos NATS Publicados

- `trades.{symbol}` - Trades em tempo real
- `history_trades.{symbol}` - Trades históricos
- `order_book.snapshots.{symbol}` - Snapshots do livro de ofertas
- `order_book.updates.{symbol}` - Updates incrementais do livro
- `order_book.offers.{symbol}` - Ofertas por agente

Exemplo de mensagem publicada:

```json
{
  "type": "trade",
  "symbol": "WINZ25",
  "timestamp": 1734432000.123,
  "price": 128500.0,
  "quantity": 5,
  "volumeFinancial": 642500.0,
  "tradeId": 123456789,
  "tradeType": 0,
  "buyAgent": 3210,
  "sellAgent": 4567,
  "isEdit": false
}
```

## Notas Importantes

- Todos os timestamps são **epoch float64** (segundos desde 1970-01-01 UTC, com fração para milissegundos)
- Formato de serialização: **JSON** (camelCase)
- Candles são derivados de trades (não vêm prontos da DLL na V1)
- O serviço mantém os callbacks da DLL ativos (GC não coleta)
- Logs são escritos no console (configurável via appsettings.json)

## Troubleshooting

### Erro: "ProfitDLL.dll não encontrada"
- Verifique se a DLL está no diretório do executável ou configure `DllPath` corretamente

### Erro: "Falha ao conectar ao NATS"
- Certifique-se de que o NATS Server está rodando
- Verifique a URL em `NatsUrl` (padrão: `nats://localhost:4222`)

### Erro: "Falha ao inicializar DLL"
- Verifique as credenciais (ACTIVATION_CODE, login, password)
- Certifique-se de que a DLL está acessível e não está bloqueada pelo Windows
