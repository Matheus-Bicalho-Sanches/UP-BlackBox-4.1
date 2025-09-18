-- Script para adicionar coluna robot_type à tabela robot_patterns
-- Executar no banco TimescaleDB

-- Adiciona coluna para tipo do robô
ALTER TABLE robot_patterns 
ADD COLUMN IF NOT EXISTS robot_type TEXT DEFAULT 'Robô Tipo 1';

-- Atualiza registros existentes para 'Robô Tipo 1'
UPDATE robot_patterns 
SET robot_type = 'Robô Tipo 1' 
WHERE robot_type IS NULL OR robot_type = '';

-- Cria índice para otimizar queries por tipo
CREATE INDEX IF NOT EXISTS idx_robot_patterns_robot_type 
ON robot_patterns(robot_type);

-- Comentário explicativo
COMMENT ON COLUMN robot_patterns.robot_type IS 'Tipo/categoria do robô detectado (ex: Robô Tipo 1, Robô Tipo 2, etc.)';

-- Verifica se a coluna foi criada corretamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'robot_patterns' 
AND column_name = 'robot_type';

-- Mostra alguns registros para verificar
SELECT 
    id, 
    symbol, 
    agent_id, 
    pattern_type,
    robot_type,
    status,
    last_seen
FROM robot_patterns 
ORDER BY last_seen DESC
LIMIT 5;
