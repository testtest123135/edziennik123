
-- 1. Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('teacher', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Security definer role check (locked down)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3. Fix mutable search_path on existing trigger function
CREATE OR REPLACE FUNCTION public.update_behavior_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.students SET behavior_points = behavior_points + NEW.points WHERE id = NEW.student_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.students SET behavior_points = behavior_points - OLD.points WHERE id = OLD.student_id;
  END IF;
  RETURN NULL;
END; $$;

-- 4. Update handle_new_user: first signup becomes the teacher
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Auto-assign teacher role to the very first user
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'teacher') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  END IF;

  RETURN NEW;
END; $$;

-- Make sure the auth trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Replace permissive policies on every data table with teacher-only access

-- profiles: each user sees only their own
DROP POLICY IF EXISTS "teacher all profiles" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- helper macro-like recreation for teacher-only tables
DROP POLICY IF EXISTS "teacher all students" ON public.students;
CREATE POLICY "teacher students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all grades" ON public.grades;
CREATE POLICY "teacher grades" ON public.grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all attendance" ON public.attendance;
CREATE POLICY "teacher attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all behavior" ON public.behavior_entries;
CREATE POLICY "teacher behavior" ON public.behavior_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all punishments" ON public.punishments;
CREATE POLICY "teacher punishments" ON public.punishments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all messages" ON public.messages;
CREATE POLICY "teacher messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all announcements" ON public.announcements;
CREATE POLICY "teacher announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all events" ON public.calendar_events;
CREATE POLICY "teacher events" ON public.calendar_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all topics" ON public.lesson_topics;
CREATE POLICY "teacher topics" ON public.lesson_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all schedule" ON public.schedule;
CREATE POLICY "teacher schedule" ON public.schedule FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all subjects" ON public.subjects;
CREATE POLICY "teacher subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all categories" ON public.grade_categories;
CREATE POLICY "teacher categories" ON public.grade_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all extra" ON public.extra_activities;
CREATE POLICY "teacher extra" ON public.extra_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all settings" ON public.app_settings;
CREATE POLICY "teacher settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all chats" ON public.ai_chats;
CREATE POLICY "teacher chats" ON public.ai_chats FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "teacher all ai messages" ON public.ai_messages;
CREATE POLICY "teacher ai messages" ON public.ai_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher')) WITH CHECK (public.has_role(auth.uid(), 'teacher'));
