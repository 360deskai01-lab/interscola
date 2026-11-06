-- FAZ D.2: Ödev / sınav atamalarına isteğe bağlı teslim tarihi.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS due_date timestamptz;

COMMENT ON COLUMN public.assignments.due_date IS
  'Öğretmenin belirlediği son teslim tarihi (UTC); NULL ise süre sınırı yok.';
