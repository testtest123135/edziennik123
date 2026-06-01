import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, BookOpen, Users, Star, MessageSquare, Gavel, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/app/lekcja")({ component: LessonPage });

function LessonPage() {
  const today = new Date().toISOString().slice(0, 10);
  const dow = ((new Date().getDay() + 6) % 7) + 1; // 1=Mon..7=Sun

  const { data: schedule = [] } = useQuery({ queryKey: ["schedule-today", dow], queryFn: async () => (await supabase.from("schedule").select("*, subjects(name, color)").eq("day_of_week", dow).order("start_time")).data ?? [] });
  const { data: topics = [] } = useQuery({ queryKey: ["topics-today", today], queryFn: async () => (await supabase.from("lesson_topics").select("subject_id, topic").eq("date", today)).data ?? [] });
  const { data: attendance = [] } = useQuery({ queryKey: ["att-today", today], queryFn: async () => (await supabase.from("attendance").select("subject_id").eq("date", today)).data ?? [] });
  const { data: grades = [] } = useQuery({ queryKey: ["grades-today", today], queryFn: async () => (await supabase.from("grades").select("id, subject_id").eq("date", today)).data ?? [] });
  const { data: behavior = [] } = useQuery({ queryKey: ["beh-today", today], queryFn: async () => (await supabase.from("behavior_entries").select("id, points").eq("date", today)).data ?? [] });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("id").order("sort_order").order("journal_no")).data ?? [] });
  const { data: punishments = [] } = useQuery({ queryKey: ["punishments-due"], queryFn: async () => (await supabase.from("punishments").select("id, type, amount, amount_paid, work_hours_required, work_hours_done, paid_at, work_done_at, pay_due_date").is("paid_at", null)).data ?? [] });
  const { data: messagesIn = [] } = useQuery({ queryKey: ["msgs-in"], queryFn: async () => (await supabase.from("messages").select("id, ai_replied, direction").not("direction", "in", '("outgoing","ai_reply")').eq("ai_replied", false)).data ?? [] });
  const { data: events = [] } = useQuery({ queryKey: ["events-today", today], queryFn: async () => (await supabase.from("calendar_events").select("*").eq("event_date", today).order("event_time")).data ?? [] });

  const topicSubjects = new Set((topics as any[]).map(t => t.subject_id));
  const attSubjects = new Set((attendance as any[]).map(a => a.subject_id));
  const gradeSubjects = new Set((grades as any[]).map(g => g.subject_id));

  const studentCount = students.length;
  const overdueFines = (punishments as any[]).filter(p => p.type === "grzywna" && p.amount && Number(p.amount_paid ?? 0) < Number(p.amount) && p.pay_due_date && p.pay_due_date < today);
  const unpaidFines = (punishments as any[]).filter(p => p.type === "grzywna" && p.amount && Number(p.amount_paid ?? 0) < Number(p.amount));
  const pendingWork = (punishments as any[]).filter(p => p.work_hours_required && Number(p.work_hours_done ?? 0) < Number(p.work_hours_required));

  const totalGradesToday = grades.length;
  const totalBehaviorToday = behavior.length;

  return (
    <div>
      <PageHeader title="Lekcja" description={`Dziś: ${today}. Co jeszcze trzeba zrobić.`} />
      <div className="p-8 space-y-6">

        {/* Szybki podgląd dnia */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<BookOpen className="w-4 h-4" />} label="Lekcje dziś" value={schedule.length} />
          <Stat icon={<Star className="w-4 h-4" />} label="Oceny wystawione" value={totalGradesToday} />
          <Stat icon={<Users className="w-4 h-4" />} label="Uwagi/pkt zach." value={totalBehaviorToday} />
          <Stat icon={<CalendarClock className="w-4 h-4" />} label="Wydarzenia dziś" value={events.length} />
        </div>

        {/* Lista lekcji z postępami */}
        <div>
          <h3 className="font-semibold mb-3">Plan na dziś</h3>
          <div className="space-y-3">
            {(schedule as any[]).map(s => {
              const hasTopic = topicSubjects.has(s.subject_id);
              const hasAtt = attSubjects.has(s.subject_id);
              const hasGrades = gradeSubjects.has(s.subject_id);
              return (
                <Card key={s.id} className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="font-mono text-sm w-24">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="font-semibold">{s.subjects?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{s.class_name} {s.room && `· sala ${s.room}`}</p>
                  </div>
                  <Status ok={hasTopic} label="Temat" />
                  <Status ok={hasAtt} label="Frekwencja" />
                  <Status ok={hasGrades} label="Oceny" optional />
                  <div className="flex gap-1">
                    {!hasTopic && <Link to="/app/tematy"><Button size="sm" variant="outline">Wpisz temat</Button></Link>}
                    {!hasAtt && (
                      <Link to="/app/frekwencja" search={{ date: today, subject_id: s.subject_id ?? undefined }}>
                        <Button size="sm" variant="outline">Sprawdź obecność</Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
            {!schedule.length && <Card className="p-8 text-center text-muted-foreground">Brak lekcji na dziś. Skonfiguruj <Link to="/app/plan" className="underline">plan lekcji</Link>.</Card>}
          </div>
        </div>

        {/* Do zrobienia */}
        <div>
          <h3 className="font-semibold mb-3">Do zrobienia</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <TodoCard
              icon={<MessageSquare className="w-4 h-4" />}
              title="Wiadomości od rodziców bez odpowiedzi"
              count={messagesIn.length}
              link="/app/wiadomosci"
              variant={messagesIn.length > 0 ? "warn" : "ok"}
            />
            <TodoCard
              icon={<Gavel className="w-4 h-4" />}
              title="Niezapłacone grzywny"
              count={unpaidFines.length}
              subtitle={overdueFines.length > 0 ? `${overdueFines.length} po terminie` : undefined}
              link="/app/kary"
              variant={overdueFines.length > 0 ? "danger" : unpaidFines.length > 0 ? "warn" : "ok"}
            />
            <TodoCard
              icon={<AlertCircle className="w-4 h-4" />}
              title="Kary do odpracowania (godziny)"
              count={pendingWork.length}
              link="/app/kary"
              variant={pendingWork.length > 0 ? "warn" : "ok"}
            />
            <TodoCard
              icon={<Users className="w-4 h-4" />}
              title="Uczniowie w systemie"
              count={studentCount}
              link="/app/uczniowie"
              variant="ok"
            />
          </div>
        </div>

        {/* Wydarzenia dziś */}
        {events.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Wydarzenia dziś</h3>
            <div className="space-y-2">
              {(events as any[]).map(e => (
                <Card key={e.id} className="p-3 flex items-center gap-3">
                  <span className="font-mono text-xs w-16">{e.event_time?.slice(0, 5) ?? "—"}</span>
                  <span className="font-medium flex-1">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{e.event_type}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function Status({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  if (optional && !ok) {
    return <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">{label}: 0</div>;
  }
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

function TodoCard({ icon, title, count, subtitle, link, variant }: { icon: React.ReactNode; title: string; count: number; subtitle?: string; link: string; variant: "ok" | "warn" | "danger" }) {
  const tone = variant === "danger" ? "border-destructive/40 bg-destructive/5" : variant === "warn" ? "border-warning/40 bg-warning/5" : "border-border";
  return (
    <Link to={link}>
      <Card className={`p-4 hover:shadow-md transition ${tone}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{title}</div>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-2xl font-bold">{count}</p>
          {subtitle && <p className="text-xs text-destructive pb-1">{subtitle}</p>}
        </div>
      </Card>
    </Link>
  );
}
