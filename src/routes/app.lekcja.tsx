import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/app/lekcja")({ component: LessonPage });

function LessonPage() {
  const today = new Date().toISOString().slice(0, 10);
  const dow = ((new Date().getDay() + 6) % 7) + 1; // 1=Mon..7=Sun

  const { data: schedule = [] } = useQuery({ queryKey: ["schedule-today", dow], queryFn: async () => (await supabase.from("schedule").select("*, subjects(name)").eq("day_of_week", dow).order("start_time")).data ?? [] });
  const { data: topics = [] } = useQuery({ queryKey: ["topics-today", today], queryFn: async () => (await supabase.from("lesson_topics").select("subject_id").eq("date", today)).data ?? [] });
  const { data: attendance = [] } = useQuery({ queryKey: ["att-today", today], queryFn: async () => (await supabase.from("attendance").select("subject_id").eq("date", today)).data ?? [] });

  const topicSubjects = new Set((topics as any[]).map(t => t.subject_id));
  const attSubjects = new Set((attendance as any[]).map(a => a.subject_id));

  return (
    <div>
      <PageHeader title="Lekcja" description="Dzisiejsze zajęcia — co jeszcze trzeba uzupełnić." />
      <div className="p-8 space-y-3">
        {(schedule as any[]).map(s => {
          const hasTopic = topicSubjects.has(s.subject_id);
          const hasAtt = attSubjects.has(s.subject_id);
          return (
            <Card key={s.id} className="p-4 flex items-center gap-4">
              <div className="font-mono text-sm w-24">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</div>
              <div className="flex-1">
                <p className="font-semibold">{s.subjects?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{s.class_name} {s.room && `· sala ${s.room}`}</p>
              </div>
              <Status ok={hasTopic} label="Temat" />
              <Status ok={hasAtt} label="Frekwencja" />
            </Card>
          );
        })}
        {!schedule.length && <Card className="p-8 text-center text-muted-foreground">Brak lekcji na dziś. Skonfiguruj plan lekcji.</Card>}
      </div>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}
