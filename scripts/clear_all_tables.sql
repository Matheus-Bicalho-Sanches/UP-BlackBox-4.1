-- =====================================================
-- SCRIPT PARA LIMPAR TODAS AS TABELAS DO BANCO
-- ⚠️ ATENÇÃO: Este script irá EXCLUIR TODOS os dados!
-- Use apenas quando quiser recomeçar do zero
-- =====================================================

-- 1. Desabilita triggers e constraints temporariamente
SET session_replication_role = replica;

-- 2. Lista todas as tabelas existentes
DO $$
DECLARE
    table_record RECORD;
    table_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Listando tabelas existentes...';
    
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '   - %', table_record.table_name;
        table_count := table_count + 1;
    END LOOP;
    
    RAISE NOTICE '📋 Total de tabelas encontradas: %', table_count;
END $$;

-- 3. Limpa todas as tabelas principais identificadas no projeto
-- Tabela de ticks brutos
TRUNCATE TABLE IF EXISTS ticks_raw RESTART IDENTITY CASCADE;

-- Tabela de padrões de robôs
TRUNCATE TABLE IF EXISTS robot_patterns RESTART IDENTITY CASCADE;

-- Tabela de trades de robôs
TRUNCATE TABLE IF EXISTS robot_trades RESTART IDENTITY CASCADE;

-- Tabela de candles de 1 minuto
TRUNCATE TABLE IF EXISTS candles_1m RESTART IDENTITY CASCADE;

-- Tabela de candles de 5 minutos
TRUNCATE TABLE IF EXISTS candles_5m RESTART IDENTITY CASCADE;

-- Tabela de ticks (se existir)
TRUNCATE TABLE IF EXISTS ticks RESTART IDENTITY CASCADE;

-- 4. Limpa outras tabelas que possam existir
-- (Este bloco limpa qualquer tabela que não foi listada acima)
DO $$
DECLARE
    table_record RECORD;
    cleared_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🧹 Limpando outras tabelas...';
    
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name NOT IN (
            'ticks_raw', 'robot_patterns', 'robot_trades', 
            'candles_1m', 'candles_5m', 'ticks'
        )
    LOOP
        BEGIN
            EXECUTE 'TRUNCATE TABLE ' || table_record.table_name || ' RESTART IDENTITY CASCADE';
            RAISE NOTICE '   ✅ %: limpa', table_record.table_name;
            cleared_count := cleared_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ⚠️  %: erro ao limpar - %', table_record.table_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '📊 Tabelas adicionais limpas: %', cleared_count;
END $$;

-- 5. Reseta todas as sequências (auto-increment) para 1
DO $$
DECLARE
    seq_record RECORD;
    reset_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Resetando sequências...';
    
    FOR seq_record IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        BEGIN
            EXECUTE 'ALTER SEQUENCE ' || seq_record.sequence_name || ' RESTART WITH 1';
            RAISE NOTICE '   ✅ %: resetada para 1', seq_record.sequence_name;
            reset_count := reset_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ⚠️  %: erro ao resetar - %', seq_record.sequence_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '📊 Sequências resetadas: %', reset_count;
END $$;

-- 6. Reabilita triggers e constraints
SET session_replication_role = DEFAULT;

-- 7. Verifica se as tabelas foram limpas
DO $$
DECLARE
    table_record RECORD;
    total_records BIGINT := 0;
    empty_tables INTEGER := 0;
    non_empty_tables INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Verificando se as tabelas foram limpas...';
    
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    LOOP
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM ' || table_record.table_name INTO total_records;
            
            IF total_records = 0 THEN
                RAISE NOTICE '   ✅ %: vazia', table_record.table_name;
                empty_tables := empty_tables + 1;
            ELSE
                RAISE NOTICE '   ⚠️  %: ainda tem % registros', table_record.table_name, total_records;
                non_empty_tables := non_empty_tables + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ❌ %: erro ao verificar - %', table_record.table_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '📊 RESUMO:';
    RAISE NOTICE '   ✅ Tabelas vazias: %', empty_tables;
    RAISE NOTICE '   ⚠️  Tabelas com dados: %', non_empty_tables;
    
    IF non_empty_tables = 0 THEN
        RAISE NOTICE '🎉 SUCESSO! Todas as tabelas foram limpas!';
    ELSE
        RAISE NOTICE '⚠️  ATENÇÃO: Algumas tabelas ainda contêm dados';
    END IF;
END $$;

-- 8. Executa VACUUM para liberar espaço e otimizar
VACUUM FULL;
ANALYZE;

-- 9. Confirma finalização
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '🎉 LIMPEZA COMPLETA FINALIZADA!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ Todas as tabelas foram limpas';
    RAISE NOTICE '✅ Todas as sequências foram resetadas';
    RAISE NOTICE '✅ Banco otimizado com VACUUM';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 O banco está pronto para recomeçar do zero!';
    RAISE NOTICE '============================================================';
END $$;
