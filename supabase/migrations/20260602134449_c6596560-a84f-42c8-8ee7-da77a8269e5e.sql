
CREATE OR REPLACE FUNCTION public.cleanup_expired_punishments()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
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
