
ALTER TABLE public.punishments
  ADD COLUMN IF NOT EXISTS work_due_date date,
  ADD COLUMN IF NOT EXISTS penalty_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS no_correction boolean NOT NULL DEFAULT false;

-- Trigger: subtract / restore behavior points when penalty_points is set
CREATE OR REPLACE FUNCTION public.apply_punishment_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.penalty_points, 0) <> 0 THEN
      UPDATE public.students SET behavior_points = behavior_points - NEW.penalty_points WHERE id = NEW.student_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.penalty_points, 0) <> 0 THEN
      UPDATE public.students SET behavior_points = behavior_points + OLD.penalty_points WHERE id = OLD.student_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.penalty_points, 0) <> COALESCE(OLD.penalty_points, 0) THEN
      UPDATE public.students
        SET behavior_points = behavior_points + COALESCE(OLD.penalty_points,0) - COALESCE(NEW.penalty_points,0)
        WHERE id = NEW.student_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_punishment_points ON public.punishments;
CREATE TRIGGER trg_apply_punishment_points
  AFTER INSERT OR UPDATE OR DELETE ON public.punishments
  FOR EACH ROW EXECUTE FUNCTION public.apply_punishment_points();

-- Cleanup helper – delete expired warning-type punishments (types 1-3)
CREATE OR REPLACE FUNCTION public.cleanup_expired_punishments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH d AS (
    DELETE FROM public.punishments
     WHERE type IN ('pouczenie','ostrzezenie_slowne','ostrzezenie_pisemne')
       AND expires_at IS NOT NULL
       AND expires_at < now()
     RETURNING 1
  )
  SELECT COUNT(*) INTO n FROM d;
  RETURN COALESCE(n,0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_punishments() TO authenticated;
