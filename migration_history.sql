-- Adicionar coluna de histórico e novo status
ALTER TABLE evaluation_requests 
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- Nota: O status 'INCONCLUSIVE' será usado via código. 
-- Garanta que o Check Constraint (se houver) permita esse novo valor.
-- Se houver uma constraint de status, ela pode ser atualizada assim:
-- ALTER TABLE evaluation_requests DROP CONSTRAINT IF EXISTS evaluation_requests_status_check;
-- ALTER TABLE evaluation_requests ADD CONSTRAINT evaluation_requests_status_check 
-- CHECK (status IN ('PENDING_CEES', 'SCHEDULED', 'COMPLETED', 'RETURNED', 'INCONCLUSIVE', 'CANCELLED'));
