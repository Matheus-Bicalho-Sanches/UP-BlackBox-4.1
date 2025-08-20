# Configuração do Banco de Dados para MarketData

Este guia te ajudará a configurar o PostgreSQL + TimescaleDB para que a aba MarketData funcione corretamente.

## 📋 Pré-requisitos

- Windows 10/11
- PowerShell (já incluído no Windows)
- PostgreSQL 15 ou 16 instalado
- TimescaleDB (opcional, mas recomendado)

## 🚀 Instalação Rápida

### 1. Instalar PostgreSQL

**Opção A: Instalador Oficial (Recomendado)**
1. Baixe do site oficial: https://www.postgresql.org/download/windows/
2. Durante a instalação:
   - Anote a senha do usuário `postgres`
   - Mantenha a porta padrão 5432
   - Instale o pgAdmin se quiser uma interface gráfica

**Opção B: Docker**
```bash
docker run -d --name postgres-timescale \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=market_data \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg16
```

### 2. Configurar o Banco

Execute o script PowerShell como **Administrador**:

```powershell
# Navegue até a pasta scripts
cd scripts

# Execute o script de configuração
.\setup_database.ps1
```

**Parâmetros opcionais:**
```powershell
# Se sua configuração for diferente
.\setup_database.ps1 -DbHost "localhost" -Port "5432" -User "postgres" -Password "sua_senha" -Database "market_data"
```

### 3. Executar o Script SQL

O script PowerShell criou um arquivo `setup_database.sql`. Execute-o de uma das formas:

**Via pgAdmin (Interface Gráfica):**
1. Abra o pgAdmin
2. Conecte como usuário `postgres`
3. Abra o arquivo `scripts/setup_database.sql`
4. Execute o script (F5)

**Via linha de comando:**
```bash
# No PowerShell
psql -U postgres -h localhost -p 5432 -f scripts\setup_database.sql
```

**Via psql direto:**
```bash
psql -U postgres -h localhost -p 5432
# Cole o conteúdo do arquivo setup_database.sql
```

### 4. Testar a Configuração

```powershell
# Execute o script de teste
.\test_database.ps1
```

Este script verificará:
- ✅ Conexão com PostgreSQL
- ✅ Existência do banco `market_data`
- ✅ Tabela `candles_1m` criada
- ✅ Extensão TimescaleDB ativa
- ✅ Inserção e consulta funcionando

## 🔧 Configuração Manual (se preferir)

### 1. Criar o Banco
```sql
CREATE DATABASE market_data;
```

### 2. Conectar ao Banco
```sql
\c market_data;
```

### 3. Criar Extensão TimescaleDB
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 4. Criar Tabela de Candles
```sql
CREATE TABLE IF NOT EXISTS candles_1m (
    symbol text NOT NULL,
    exchange text NOT NULL,
    ts_minute_utc timestamptz NOT NULL,
    o double precision NOT NULL,
    h double precision NOT NULL,
    l double precision NOT NULL,
    c double precision NOT NULL,
    v bigint NOT NULL,
    vf double precision,
    trades integer,
    vwap double precision,
    PRIMARY KEY (symbol, ts_minute_utc)
);
```

### 5. Criar Índices
```sql
CREATE INDEX IF NOT EXISTS idx_candles_1m_symbol_ts ON candles_1m(symbol, ts_minute_utc);
CREATE INDEX IF NOT EXISTS idx_candles_1m_ts ON candles_1m(ts_minute_utc);
```

### 6. Transformar em Hypertable
```sql
SELECT create_hypertable('candles_1m', 'ts_minute_utc', if_not_exists => TRUE);
```

## 🧪 Testando a Configuração

### 1. Verificar Tabelas
```sql
\dt
```

### 2. Verificar Extensões
```sql
\dx
```

### 3. Inserir Dados de Teste
```sql
INSERT INTO candles_1m (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf) 
VALUES ('TEST', 'B', NOW(), 100.0, 101.0, 99.0, 100.5, 1000, 100500.0);
```

### 4. Consultar Dados
```sql
SELECT COUNT(*) FROM candles_1m;
SELECT * FROM candles_1m ORDER BY ts_minute_utc DESC LIMIT 5;
```

## 🔗 Atualizar .env.local

Após configurar o banco, atualize seu arquivo `.env.local`:

```ini
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/market_data
```

## 🚀 Testar a MarketData

1. **Configure o banco** (passos acima)
2. **Rode o start-dev.bat** (sobe os backends)
3. **Acesse**: http://localhost:3000/dashboard/blackbox-multi/marketdata
4. **Teste**: Digite um ticker (ex: PETR4), clique "Acompanhar"
5. **Aguarde**: ~1-2 minutos para o feed gravar as primeiras velas

## ❗ Troubleshooting

### Erro: "connection refused"
- Verifique se o PostgreSQL está rodando
- Confirme a porta (padrão: 5432)
- Teste: `Test-NetConnection localhost 5432`

### Erro: "authentication failed"
- Verifique a senha do usuário `postgres`
- Confirme o usuário e host

### Erro: "database does not exist"
- Execute o script SQL primeiro
- Verifique se está conectado no banco correto

### Erro: "extension timescaledb does not exist"
- Instale o TimescaleDB
- Ou use apenas timeframe "1m" (funciona sem TimescaleDB)

### Erro: "relation candles_1m does not exist"
- Execute o script SQL completo
- Verifique se está no banco `market_data`

## 📞 Suporte

Se encontrar problemas:
1. Execute `.\test_database.ps1` para diagnóstico
2. Verifique os logs do PostgreSQL
3. Confirme se todas as variáveis de ambiente estão corretas

## 🎯 Próximos Passos

Após configurar o banco:
1. ✅ Banco configurado
2. ✅ Tabelas criadas
3. ✅ Scripts de teste funcionando
4. 🚀 Rode o `start-dev.bat`
5. 🚀 Teste a aba MarketData
6. 🚀 Configure estratégias e backtests
