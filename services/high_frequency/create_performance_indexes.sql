-- 🚀 SCRIPT DE CRIAÇÃO DE ÍNDICES PARA OTIMIZAÇÃO DE PERFORMANCE
-- Este script cria os índices mais importantes para resolver a lentidão do Motion Tracker

-- =====================================================
-- 📊 ÍNDICES CRÍTICOS PARA PERFORMANCE
-- =====================================================

-- 1. 🚀 ÍNDICE COMPOSTO PARA TICKS_RAW (SÍMBOLO + TIMESTAMP)
-- OTIMIZA: Queries por símbolo específico em período de tempo
-- IMPACTO: ALTO - Esta é a query mais lenta (1.3M registros)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticks_raw_symbol_timestamp 
ON ticks_raw(symbol, timestamp DESC);

-- 2. 🚀 ÍNDICE COMPOSTO PARA ROBOT_PATTERNS (SÍMBOLO + STATUS + TIMESTAMP)
-- OTIMIZA: Queries por símbolo + status + ordenação por último visto
-- IMPACTO: ALTO - Queries de padrões ativos por símbolo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_patterns_symbol_status_timestamp 
ON robot_patterns(symbol, status, last_seen DESC);

-- 3. 🚀 ÍNDICE COMPOSTO PARA ROBOT_TRADES (SÍMBOLO + AGENTE + TIMESTAMP)
-- OTIMIZA: Queries por símbolo + agente específico + ordenação por tempo
-- IMPACTO: ALTO - Queries de trades por agente em símbolo específico
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_trades_symbol_agent_timestamp 
ON robot_trades(symbol, agent_id, timestamp DESC);

-- =====================================================
-- 📊 ÍNDICES SECUNDÁRIOS PARA OTIMIZAÇÃO ADICIONAL
-- =====================================================

-- 4. 🚀 ÍNDICE PARA ROBOT_PATTERNS POR AGENTE + SÍMBOLO
-- OTIMIZA: Queries por agente específico em símbolo específico
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_patterns_agent_symbol 
ON robot_patterns(agent_id, symbol, last_seen DESC);

-- 5. 🚀 ÍNDICE PARA ROBOT_TRADES POR AGENTE + TIMESTAMP
-- OTIMIZA: Queries por agente + período de tempo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_trades_agent_timestamp 
ON robot_trades(agent_id, timestamp DESC);

-- =====================================================
-- 📊 VERIFICAÇÃO DOS ÍNDICES CRIADOS
-- =====================================================

-- Comando para verificar se os índices foram criados:
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes 
-- WHERE tablename IN ('ticks_raw', 'robot_patterns', 'robot_trades')
--     AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- =====================================================
-- 📊 ESTIMATIVA DE IMPACTO NA PERFORMANCE
-- =====================================================

-- ANTES (sem índices compostos):
-- - Queries por símbolo + timestamp: 2-5 segundos
-- - Queries por símbolo + status: 1-3 segundos
-- - Queries por símbolo + agente: 1-2 segundos

-- DEPOIS (com índices compostos):
-- - Queries por símbolo + timestamp: 50-200ms (10-25x mais rápido)
-- - Queries por símbolo + status: 20-100ms (15-30x mais rápido)
-- - Queries por símbolo + agente: 10-50ms (20-40x mais rápido)

-- =====================================================
-- 📊 NOTAS IMPORTANTES
-- =====================================================

-- ✅ CONCURRENTLY: Permite criar índices sem bloquear operações de escrita
-- ✅ IF NOT EXISTS: Evita erros se o índice já existir
-- ✅ ORDEM DAS COLUNAS: Mais seletiva primeiro (symbol), depois ordenação (timestamp)
-- ✅ DESC: Otimiza ORDER BY timestamp DESC (mais recente primeiro)

-- ⚠️ TEMPO DE CRIAÇÃO: 
-- - ticks_raw: ~30-60 segundos (1.3M registros)
-- - robot_patterns: ~5-10 segundos (850 registros)
-- - robot_trades: ~2-5 segundos (0 registros atualmente)

-- 🔄 APÓS CRIAÇÃO: 
-- - Reinicie o backend para garantir que as queries usem os novos índices
-- - Monitore a performance das queries no Motion Tracker
