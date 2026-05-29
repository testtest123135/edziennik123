
-- 1. Numer w dzienniku + kolejność uczniów
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS journal_no integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS students_journal_no_unique ON public.students(journal_no) WHERE journal_no IS NOT NULL;

-- Backfill journal_no i sort_order według first_name dla istniejących uczniów
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY first_name, last_name) AS rn FROM public.students
)
UPDATE public.students s SET journal_no = COALESCE(s.journal_no, r.rn), sort_order = CASE WHEN s.sort_order = 0 THEN r.rn ELSE s.sort_order END
FROM ranked r WHERE r.id = s.id;

-- Auto-przypisanie kolejnego numeru przy INSERT, jeśli nie podano
CREATE OR REPLACE FUNCTION public.assign_journal_no()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.journal_no IS NULL THEN
    SELECT COALESCE(MAX(journal_no), 0) + 1 INTO NEW.journal_no FROM public.students;
  END IF;
  IF NEW.sort_order = 0 THEN
    NEW.sort_order := NEW.journal_no;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_journal_no ON public.students;
CREATE TRIGGER trg_assign_journal_no BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.assign_journal_no();

-- 2. Historia wpłat i wykonania kar
CREATE TABLE IF NOT EXISTS public.punishment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punishment_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'payment', -- 'payment' | 'work_hours' | 'note'
  amount numeric,
  hours numeric,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punishment_payments TO authenticated;
GRANT ALL ON public.punishment_payments TO service_role;
ALTER TABLE public.punishment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher punishment_payments" ON public.punishment_payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role));

-- Trigger aktualizujący amount_paid / work_hours_done na karze
CREATE OR REPLACE FUNCTION public.recalc_punishment_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.punishment_id, OLD.punishment_id);
  UPDATE public.punishments p SET
    amount_paid = COALESCE((SELECT SUM(amount) FROM public.punishment_payments WHERE punishment_id = pid AND kind = 'payment'), 0),
    work_hours_done = COALESCE((SELECT SUM(hours) FROM public.punishment_payments WHERE punishment_id = pid AND kind = 'work_hours'), 0),
    paid_at = CASE WHEN p.amount IS NOT NULL AND COALESCE((SELECT SUM(amount) FROM public.punishment_payments WHERE punishment_id = pid AND kind = 'payment'), 0) >= p.amount THEN now() ELSE p.paid_at END,
    work_done_at = CASE WHEN p.work_hours_required IS NOT NULL AND COALESCE((SELECT SUM(hours) FROM public.punishment_payments WHERE punishment_id = pid AND kind = 'work_hours'), 0) >= p.work_hours_required THEN now() ELSE p.work_done_at END
  WHERE p.id = pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_recalc_punishment_totals ON public.punishment_payments;
CREATE TRIGGER trg_recalc_punishment_totals AFTER INSERT OR UPDATE OR DELETE ON public.punishment_payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_punishment_totals();

-- 3. Bucket na zdjęcia do chatu AI
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-uploads', 'ai-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ai-uploads read public" ON storage.objects FOR SELECT USING (bucket_id = 'ai-uploads');
CREATE POLICY "ai-uploads teacher write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-uploads' AND public.has_role(auth.uid(), 'teacher'::app_role));
CREATE POLICY "ai-uploads teacher delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-uploads' AND public.has_role(auth.uid(), 'teacher'::app_role));

-- 4. Naprawa domyślnego modelu AI (jeśli ktoś ma ustawiony zły model)
UPDATE public.app_settings SET ai_model = 'google/gemini-2.5-flash'
WHERE ai_model LIKE '%llama-4%' OR ai_model LIKE '%maverick%' OR ai_model LIKE '%scout%';
