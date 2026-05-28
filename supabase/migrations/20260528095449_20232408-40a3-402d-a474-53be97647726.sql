
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SUBJECTS / CATEGORIES (settings) ============
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1e3a5f',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all subjects" ON public.subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.grade_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_categories TO authenticated;
GRANT ALL ON public.grade_categories TO service_role;
ALTER TABLE public.grade_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all categories" ON public.grade_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_name TEXT,
  parent_name TEXT,
  parent_contact TEXT,
  notes TEXT,
  behavior_points INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ GRADES ============
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.grade_categories(id) ON DELETE SET NULL,
  grade TEXT NOT NULL,
  grade_value NUMERIC,
  weight NUMERIC NOT NULL DEFAULT 1,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all grades" ON public.grades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('obecny','nieobecny','spozniony','usprawiedliwiony','zwolniony','wycieczka','dzien_wolny')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ BEHAVIOR ============
CREATE TABLE public.behavior_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_entries TO authenticated;
GRANT ALL ON public.behavior_entries TO service_role;
ALTER TABLE public.behavior_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all behavior" ON public.behavior_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- trigger update student.behavior_points
CREATE OR REPLACE FUNCTION public.update_behavior_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.students SET behavior_points = behavior_points + NEW.points WHERE id = NEW.student_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.students SET behavior_points = behavior_points - OLD.points WHERE id = OLD.student_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_behavior_points
  AFTER INSERT OR DELETE ON public.behavior_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_behavior_points();

-- ============ LESSON TOPICS ============
CREATE TABLE public.lesson_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  topic TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_topics TO authenticated;
GRANT ALL ON public.lesson_topics TO service_role;
ALTER TABLE public.lesson_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all topics" ON public.lesson_topics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CALENDAR EVENTS ============
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'inne',
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all events" ON public.calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MESSAGES (do rodzicow) ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming','ai_reply')),
  subject TEXT,
  body TEXT NOT NULL,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ai_scheduled_for TIMESTAMPTZ,
  ai_replied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'wszyscy',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all announcements" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SCHEDULE (plan lekcji) ============
CREATE TABLE public.schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_name TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule TO authenticated;
GRANT ALL ON public.schedule TO service_role;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all schedule" ON public.schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ EXTRA ACTIVITIES ============
CREATE TABLE public.extra_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'planowane',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_activities TO authenticated;
GRANT ALL ON public.extra_activities TO service_role;
ALTER TABLE public.extra_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all extra" ON public.extra_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PUNISHMENTS ============
CREATE TABLE public.punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pouczenie','ostrzezenie_slowne','ostrzezenie_pisemne','grzywna','ograniczenie_praw','prace_szkolne','ograniczenie_wolnosci','areszt')),
  reason TEXT NOT NULL,
  details TEXT,
  expires_at TIMESTAMPTZ,
  -- grzywna
  amount NUMERIC,
  pay_due_date DATE,
  installments_allowed BOOLEAN DEFAULT false,
  amount_paid NUMERIC DEFAULT 0,
  paid_at TIMESTAMPTZ,
  -- ograniczenie praw / wolnosci
  degree INTEGER,
  -- prace szkolne
  work_hours_required NUMERIC,
  work_hours_done NUMERIC DEFAULT 0,
  work_done_at TIMESTAMPTZ,
  -- areszt
  hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punishments TO authenticated;
GRANT ALL ON public.punishments TO service_role;
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all punishments" ON public.punishments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ AI CHATS ============
CREATE TABLE public.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Nowy chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chats TO authenticated;
GRANT ALL ON public.ai_chats TO service_role;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all chats" ON public.ai_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all ai messages" ON public.ai_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ SETTINGS (singleton) ============
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_provider TEXT NOT NULL DEFAULT 'lovable',
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ai_vision_enabled BOOLEAN DEFAULT true,
  gguf_model_name TEXT,
  gguf_endpoint TEXT,
  groq_api_key_set BOOLEAN DEFAULT false,
  school_name TEXT,
  teacher_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher all settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- seed default categories + subjects
INSERT INTO public.grade_categories (name, weight) VALUES
  ('Sprawdzian', 3),
  ('Kartkówka', 2),
  ('Odpowiedź ustna', 2),
  ('Aktywność', 1),
  ('Praca domowa', 1);

INSERT INTO public.subjects (name) VALUES
  ('Matematyka'),
  ('Język polski'),
  ('Język angielski'),
  ('Historia'),
  ('Biologia');
