-- Grade correction (Popraw)
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS original_grade_id uuid;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS is_correction boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_grades_original ON public.grades(original_grade_id);

-- Renumber students by sort_order -> journal_no = 1,2,3,...
CREATE OR REPLACE FUNCTION public.renumber_students_journal()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 1;
BEGIN
  FOR r IN SELECT id FROM public.students ORDER BY sort_order NULLS LAST, journal_no NULLS LAST, created_at LOOP
    UPDATE public.students SET journal_no = n, sort_order = n WHERE id = r.id;
    n := n + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.renumber_students_journal() TO authenticated;