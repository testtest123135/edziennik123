import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ATTENDANCE_STATUSES } from "@/lib/grade-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/frekwencja")({ component: AttendancePage });

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState("first_name");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("first_name")).data ?? [] });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("date", date)).data ?? [],
  });

  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))) as string[], [students]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter(s => !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q))
      .filter(s => classFilter === "all" || s.class_name === classFilter)
      .sort((a, b) => sort === "last_name" ? (a.last_name ?? "").localeCompare(b.last_name ?? "") : (a.first_name ?? "").localeCompare(b.first_name ?? ""));
  }, [students, search, classFilter, sort]);

  const set = useMutation({
    mutationFn: async ({ student_id, status }: { student_id: string; status: string }) => {
      const existing = (attendance as any[]).find(a => a.student_id === student_id);
      if (existing) { const { error } = await supabase.from("attendance").update({ status }).eq("id", existing.id); if (error) throw error; }
      else { const { error } = await supabase.from("attendance").insert({ student_id, status, date, subject_id: null }); if (error) throw error; }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", date] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Frekwencja" description="Sprawdź obecność konkretnego dnia." actions={
        <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      } />
      <div className="p-8 space-y-4">
        <Card className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Szukaj</Label><Input placeholder="Imię lub nazwisko…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="w-40"><Label className="text-xs">Klasa</Label>
            <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="w-44"><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first_name">Imię</SelectItem><SelectItem value="last_name">Nazwisko</SelectItem></SelectContent></Select>
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          {filtered.map(s => {
            const cur = (attendance as any[]).find(a => a.student_id === s.id)?.status ?? "";
            return (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-48 font-medium text-sm">{s.first_name} {s.last_name}</div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {ATTENDANCE_STATUSES.map(st => (
                    <Button key={st.value} size="sm" variant={cur === st.value ? "default" : "outline"}
                      className={cn("text-xs", cur === st.value && st.color)}
                      onClick={() => set.mutate({ student_id: s.id, status: st.value })}>
                      {st.label}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {!filtered.length && <p className="p-6 text-center text-muted-foreground text-sm">Brak uczniów.</p>}
        </Card>
      </div>
    </div>
  );
}
