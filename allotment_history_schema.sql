CREATE TABLE IF NOT EXISTS public.allotment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    allotment_id UUID,
    staff_id UUID,
    staff_name TEXT,
    school_name TEXT,
    class_name TEXT,
    action_type TEXT NOT NULL, -- 'Nova Lotação', 'Remoção', 'Alteração de Data', 'Alteração de Carga Horária'
    previous_value TEXT,
    new_value TEXT,
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_name TEXT,
    user_email TEXT,
    obs TEXT
);

ALTER TABLE public.allotment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for authenticated users on allotment_history"
ON public.allotment_history FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
