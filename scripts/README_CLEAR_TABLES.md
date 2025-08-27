# 🗑️ Limpeza Completa do Banco de Dados

## ⚠️ ATENÇÃO CRÍTICA

**Este script irá EXCLUIR TODOS os dados existentes no banco de dados!**

Use apenas quando:
- ✅ Quiser recomeçar do zero
- ✅ Estiver em ambiente de desenvolvimento
- ✅ Tiver backup dos dados importantes
- ✅ Estiver certo de que não há dados críticos

## 📋 O que será limpo

### Tabelas Principais Identificadas:
- `ticks_raw` - Dados brutos de ticks de mercado
- `robot_patterns` - Padrões de robôs detectados
- `robot_trades` - Operações individuais dos robôs
- `candles_1m` - Candles de 1 minuto
- `candles_5m` - Candles de 5 minutos
- `ticks` - Tabela de ticks (se existir)

### Outras Tabelas:
- Qualquer outra tabela que exista no schema `public`

### Sequências:
- Todas as sequências (auto-increment) serão resetadas para 1

## 🚀 Como Executar

### Opção 1: Script Python (Recomendado)

```bash
# Navegue para a pasta scripts
cd scripts

# Execute o script Python
python clear_all_tables.py
```

### Opção 2: Script Batch (Windows)

```cmd
# Navegue para a pasta scripts
cd scripts

# Execute o script batch
clear_all_tables.bat
```

### Opção 3: SQL Direto

```sql
-- Conecte ao banco via psql, pgAdmin ou outro cliente
-- Execute o arquivo clear_all_tables.sql
```

## 📋 Pré-requisitos

### 1. Python
- Python 3.7+ instalado
- Biblioteca `psycopg` instalada

### 2. Conexão com Banco
- PostgreSQL rodando
- Acesso ao banco `market_data`
- Variável de ambiente `DATABASE_URL` configurada

### 3. Permissões
- Usuário com permissão para TRUNCATE
- Usuário com permissão para ALTER SEQUENCE

## 🔧 Configuração

### Variável de Ambiente
```bash
# Windows
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/market_data

# Linux/Mac
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/market_data
```

### Arquivo .env
```ini
DATABASE_URL=postgres://postgres:postgres@localhost:5432/market_data
```

## 📊 O que acontece durante a execução

### 1. Listagem de Tabelas
- Mostra todas as tabelas existentes
- Conta o total de tabelas

### 2. Desabilitação de Constraints
- Desabilita triggers temporariamente
- Permite limpeza sem erros de FK

### 3. Limpeza das Tabelas
- Executa TRUNCATE em cada tabela
- Reseta sequências para 1
- Usa CASCADE para limpar dependências

### 4. Verificação
- Confirma se todas as tabelas foram limpas
- Mostra contagem de registros restantes

### 5. Otimização
- Executa VACUUM FULL para liberar espaço
- Executa ANALYZE para atualizar estatísticas

## 🛡️ Segurança

### Confirmação Dupla
- O script pede confirmação digitando "SIM"
- Só executa após confirmação explícita

### Rollback
- Em caso de erro, as alterações são revertidas
- Banco não fica em estado inconsistente

### Logs Detalhados
- Todas as operações são logadas
- Erros são capturados e exibidos

## 🔍 Verificação Pós-Limpeza

### 1. Contagem de Registros
```sql
-- Verifica se as tabelas estão vazias
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t1.table_name) as record_count
FROM information_schema.tables t1 
WHERE table_schema = 'public';
```

### 2. Verificação de Sequências
```sql
-- Verifica se as sequências foram resetadas
SELECT sequence_name, last_value 
FROM information_schema.sequences 
WHERE sequence_schema = 'public';
```

### 3. Tamanho do Banco
```sql
-- Verifica o tamanho total do banco
SELECT pg_size_pretty(pg_database_size(current_database()));
```

## 🚨 Solução de Problemas

### Erro: "permission denied"
```bash
# Conecte como usuário postgres ou superusuário
psql -U postgres -d market_data
```

### Erro: "psycopg not found"
```bash
# Instale a biblioteca
pip install psycopg[binary]
```

### Erro: "connection failed"
```bash
# Verifique se o PostgreSQL está rodando
# Verifique a string de conexão
# Teste a conexão manualmente
```

### Tabelas não foram limpas
```bash
# Verifique logs de erro
# Execute manualmente via SQL
# Verifique constraints e dependências
```

## 📞 Suporte

### Logs de Erro
- Todos os erros são exibidos no console
- Use `--verbose` para mais detalhes

### Debug
```bash
# Execute com debug ativado
python clear_all_tables.py --debug
```

### Backup Antes da Limpeza
```bash
# Faça backup antes de executar
pg_dump -U postgres -d market_data > backup_before_clear.sql
```

## 🎯 Próximos Passos

Após a limpeza:

1. **Verifique se todas as tabelas estão vazias**
2. **Reinicie os serviços que usam o banco**
3. **Teste a inserção de novos dados**
4. **Monitore o funcionamento do sistema**

## 📝 Histórico de Versões

- **v1.0** - Versão inicial com limpeza básica
- **v1.1** - Adicionado reset de sequências
- **v1.2** - Adicionado VACUUM e otimização
- **v1.3** - Melhorado tratamento de erros e logs

---

**⚠️ LEMBRE-SE: Este script é irreversível! Faça backup antes de usar!**
