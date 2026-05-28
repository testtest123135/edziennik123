import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { weightedAverage, attendancePct, fullName } from "@/lib/grade-utils";
import { PUNISHMENT_TYPES } from "@/lib/grade-utils";
import { ArrowLeft, Gavel } from "lucide-react";

export const Route = createFileRoute("/app/uczniowie/$id")({ component: KartotekaPage });

function KartotekaPage() {
  const { id } = Route.useParams();
  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => (await supabase.from("students").select("*").eq("id", id).single()).data,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["student-grades", id],
    queryFn: async () => (await supabase.from("grades").select("*, subjects(name), grade_categories(name)").eq("student_id", id).order("date", { ascending: false })).data ?? [],
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", id],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("student_id", id)).data ?? [],
  });
  const { data: behavior = [] } = useQuery({
    queryKey: ["student-behavior", id],
    queryFn: async () => (await supabase.from("behavior_entries").select("*").eq("student_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: punishments = [] } = useQuery({
    queryKey: ["student-punishments", id],
    queryFn: async () => (await supabase.from("punishments").select("*").eq("student_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["student-messages", id],
    queryFn: async () => (await supabase.from("messages").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  if (!student) return <div className="p-8 text-muted-foreground">Ładowanie…</div>;

  const avg = weightedAverage(grades as any);
  const pct = attendancePct(attendance as any);

  return (
    <div>
      <PageHeader title={`Kartoteka — ${fullName(student)}`} description={`Klasa ${student.class_name ?? "—"} • Rodzic: ${student.parent_name ?? "—"}`} actions={
        <Link to="/app/uczniowie"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1" />Wróć</Button></Link>
      } />
      <div className="p-8 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Średnia ważona</div><div className="text-2xl font-bold">{avg ? avg.toFixed(2) : "—"}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Frekwencja</div><div className="text-2xl font-bold">{pct}%</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Pkt z zachowania</div><div className={`text-2xl font-bold ${student.behavior_points >= 50 ? "text-success" : "text-destructive"}`}>{student.behavior_points}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Liczba ocen</div><div className="text-2xl font-bold">{grades.length}</div></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Oceny</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
              {(grades as any[]).map(g => (
                <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <span className="font-bold text-accent w-10">{g.grade}</span>
                  <span className="flex-1">{g.subjects?.name ?? "—"} <span className="text-xs text-muted-foreground">• {g.grade_categories?.name ?? "—"} • w{g.weight}</span></span>
                  <span className="text-xs text-muted-foreground">{g.date}</span>
                </div>
              ))}
              {!grades.length && <p className="text-muted-foreground text-sm">Brak ocen.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Historia punktów zachowania</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
              {(behavior as any[]).map(b => (
                <div key={b.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                  <span className={`font-mono font-bold w-12 ${b.points > 0 ? "text-success" : "text-destructive"}`}>{b.points > 0 ? "+" : ""}{b.points}</span>
                  <span className="flex-1">{b.reason ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{b.date}</span>
                </div>
              ))}
              {!behavior.length && <p className="text-muted-foreground text-sm">Brak wpisów.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Frekwencja</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
              {(attendance as any[]).slice().sort((a,b) => b.date.localeCompare(a.date)).map(a => (
                <div key={a.id} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span>{a.date}</span>
                  <span className="text-xs">{a.status}</span>
                </div>
              ))}
              {!attendance.length && <p className="text-muted-foreground text-sm">Brak danych.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Kartoteka kar</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(punishments as any[]).map(p => {
                const meta = PUNISHMENT_TYPES.find(t => t.value === p.type);
                return (
                  <div key={p.id} className="border-b border-border pb-2 last:border-0">
                    <div className="flex items-center gap-2 text-sm"><Gavel className="w-3.5 h-3.5 text-destructive" /><strong>{meta?.label ?? p.type}</strong><span className="text-xs text-muted-foreground ml-auto">{new Date(p.created_at).toLocaleDateString("pl")}</span></div>
                    <p className="text-xs mt-1"><strong>Powód:</strong> {p.reason}</p>
                  </div>
                );
              })}
              {!punishments.length && <p className="text-muted-foreground text-sm">Brak kar.</p>}
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Wiadomości</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto text-sm">
            {(messages as any[]).map(m => (
              <div key={m.id} className="border-b border-border pb-2 last:border-0">
                <div className="text-xs text-muted-foreground">{m.direction} • {new Date(m.created_at).toLocaleString("pl")}</div>
                {m.subject && <strong>{m.subject}</strong>}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
            {!messages.length && <p className="text-muted-foreground text-sm">Brak wiadomości.</p>}
          </div>
        </Card>

        {student.notes && <Card className="p-4"><h3 className="font-semibold mb-2">Notatki</h3><p className="text-sm whitespace-pre-wrap">{student.notes}</p></Card>}
      </div>
    </div>
  );
}
