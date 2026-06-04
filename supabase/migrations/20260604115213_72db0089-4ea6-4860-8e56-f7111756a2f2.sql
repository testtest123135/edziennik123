
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS pesel text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS second_parent_name text,
  ADD COLUMN IF NOT EXISTS second_parent_contact text,
  ADD COLUMN IF NOT EXISTS health_notes text,
  ADD COLUMN IF NOT EXISTS hobbies text;

ALTER TABLE public.punishments
  ADD COLUMN IF NOT EXISTS arrest_started_at timestamptz;

-- backfill arrest_started_at = created_at for existing arrest rows
UPDATE public.punishments SET arrest_started_at = created_at WHERE type = 'areszt' AND arrest_started_at IS NULL;
