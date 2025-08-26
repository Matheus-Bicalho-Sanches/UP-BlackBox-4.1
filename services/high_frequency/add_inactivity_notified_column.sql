-- Script para adicionar coluna de controle de notificação de inatividade
-- Executar no banco TimescaleDB

-- Adiciona coluna para controlar se o robô já foi notificado como inativo
ALTER TABLE robot_patterns 
ADD COLUMN IF NOT EXISTS inactivity_notified BOOLEAN DEFAULT FALSE;

-- Atualiza registros existentes para marcar como não notificados
UPDATE robot_patterns 
SET inactivity_notified = FALSE 
WHERE inactivity_notified IS NULL;

-- Verifica se a coluna foi criada corretamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'robot_patterns' 
AND column_name = 'inactivity_notified';

-- Mostra alguns registros para verificar
SELECT 
    id, 
    symbol, 
    agent_id, 
    status, 
    inactivity_notified,
    last_seen
FROM robot_patterns 
LIMIT 5;
