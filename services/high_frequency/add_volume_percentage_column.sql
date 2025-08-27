-- Adiciona coluna para volume em % do mercado
ALTER TABLE robot_patterns 
ADD COLUMN market_volume_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Cria índice para otimizar queries por volume %
CREATE INDEX idx_robot_patterns_volume_percentage 
ON robot_patterns(market_volume_percentage DESC);

-- Comentário explicativo
COMMENT ON COLUMN robot_patterns.market_volume_percentage IS 'Porcentagem do volume total do mercado movimentado por este robô (0.00 a 100.00)';
