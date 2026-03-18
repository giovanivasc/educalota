-- Adicionar colunas para suporte a reavaliação e status inconclusivo
ALTER TABLE evaluation_requests 
ADD COLUMN IF NOT EXISTS reassessment_needed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reassessment_period TEXT;

COMMENT ON COLUMN evaluation_requests.reassessment_needed IS 'Indica se o aluno precisará de uma nova avaliação futura.';
COMMENT ON COLUMN evaluation_requests.reassessment_period IS 'O tempo de espera para a próxima avaliação (ex: 6 meses, 1 ano).';
