# 📊 Como Verificar o Tamanho dos Dados no Banco TimescaleDB

Este guia te ensina como verificar quanto espaço os dados estão ocupando no seu banco de dados de alta frequência.

## 🚀 Método 1: Script Python (Recomendado)

### Passo 1: Preparar o ambiente
1. Abra o PowerShell como administrador
2. Navegue até a pasta: `services/high_frequency/`
3. Execute o script de instalação:
   ```powershell
   .\install_rust.ps1
   ```

### Passo 2: Executar a verificação
1. Execute o arquivo batch:
   ```cmd
   check_database_size.bat
   ```

**OU** execute diretamente no PowerShell:
```powershell
.\venv\Scripts\activate
python check_database_size.py
```

### O que o script mostra:
- 📊 **Tamanho total do banco** (em MB, GB, etc.)
- 📋 **Tamanho de cada tabela** (dados + índices)
- 🎯 **Detalhes da tabela ticks_raw** (registros, símbolos únicos)
- ⏰ **Informações do TimescaleDB** (chunks, compressão)
- 📅 **Registros por dia** (últimos 7 dias)

## 🗄️ Método 2: Script SQL Direto

### Passo 1: Conectar ao banco
Use um cliente PostgreSQL como:
- **pgAdmin** (interface gráfica)
- **psql** (linha de comando)
- **DBeaver** (interface gráfica)

### Passo 2: Executar as consultas
Execute o arquivo `check_db_size.sql` ou copie as consultas individualmente.

## 🔍 Consultas SQL Importantes

### 1. Tamanho total do banco:
```sql
SELECT 
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as total_size;
```

### 2. Tamanho das tabelas:
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Detalhes da tabela ticks_raw:
```sql
SELECT 
    pg_size_pretty(pg_total_relation_size('ticks_raw')) as total_size,
    COUNT(*) as total_records,
    COUNT(DISTINCT symbol) as unique_symbols
FROM ticks_raw;
```

## 📈 O que Significam os Números

### Tamanhos:
- **B (Bytes)**: Unidade básica (1 caractere = 1 byte)
- **KB (Kilobytes)**: 1.024 bytes
- **MB (Megabytes)**: 1.048.576 bytes
- **GB (Gigabytes)**: 1.073.741.824 bytes
- **TB (Terabytes)**: 1.099.511.627.776 bytes

### Componentes:
- **Tamanho da tabela**: Apenas os dados
- **Tamanho dos índices**: Estruturas para busca rápida
- **Tamanho total**: Dados + índices

## 🚨 Problemas Comuns e Soluções

### Erro: "psycopg não encontrado"
```bash
pip install psycopg[binary]
```

### Erro: "Conexão recusada"
- Verifique se o PostgreSQL está rodando
- Confirme a URL do banco em `config.py`
- Verifique se a porta 5432 está livre

### Erro: "Permissão negada"
- Execute o PowerShell como administrador
- Verifique as credenciais do banco

## 💡 Dicas para Economizar Espaço

### 1. Habilitar compressão no TimescaleDB:
```sql
ALTER TABLE ticks_raw SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol'
);
```

### 2. Configurar política de retenção:
```sql
SELECT add_retention_policy('ticks_raw', INTERVAL '90 days');
```

### 3. Verificar chunks antigos:
```sql
SELECT * FROM timescaledb_information.chunks 
WHERE range_end < NOW() - INTERVAL '30 days';
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do PostgreSQL
2. Confirme se o TimescaleDB está instalado
3. Teste a conexão com um cliente simples

## 🔗 Links Úteis

- [Documentação TimescaleDB](https://docs.timescale.com/)
- [PostgreSQL Size Functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE)
- [Guia de Compressão](https://docs.timescale.com/use-timescaledb/compression)
