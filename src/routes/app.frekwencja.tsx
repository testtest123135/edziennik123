import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";
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

const searchSchema = z.object({
  date: z.string().optional(),
  subject_id: z.string().optional(),
}).optional();

export const Route = createFileRoute("/app/frekwencja")({
  component: AttendancePage,
  validateSearch: searchSchema,
});

function AttendancePage() {
  const qc = useQueryClient();
  const search = Route.useSearch() as { date?: string; subject_id?: string } | undefined;
  const [date, setDate] = useState(search?.date ?? new Date().toISOString().slice(0, 10));
  const [subjectId, setSubjectId] = useState<string>(search?.subject_id ?? "__none");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState("journal"); // domyślnie: kolejność z dziennika

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("sort_order").order("journal_no")).data ?? [] });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [] });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date, subjectId],
    queryFn: async () => {
      let q = supabase.from("attendance").select("*").eq("date", date);
      if (subjectId === "__none") q = q.is("subject_id", null);
      else q = q.eq("subject_id", subjectId);
      return (await q).data ?? [];
    },
  });

  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))) as string[], [students]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const arr = students
      .filter(s => !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q))
      .filter(s => classFilter === "all" || s.class_name === classFilter);
    if (sort === "journal") return arr; // już posortowane przez supabase
    if (sort === "first_name") return [...arr].sort((a, b) => (a.first_name ?? "").localeCompare(b.first_name ?? ""));
    if (sort === "last_name") return [...arr].sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? ""));
    return arr;
  }, [students, query, classFilter, sort]);

  const set = useMutation({
    mutationFn: async ({ student_id, status }: { student_id: string; status: string }) => {
      const existing = (attendance as any[]).find(a => a.student_id === student_id);
      const subject = subjectId === "__none" ? null : subjectId;
      if (existing) { const { error } = await supabase.from("attendance").update({ status }).eq("id", existing.id); if (error) throw error; }
      else { const { error } = await supabase.from("attendance").insert({ student_id, status, date, subject_id: subject }); if (error) throw error; }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", date, subjectId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const subjectName = subjects.find((s: any) => s.id === subjectId)?.name;

  return (
    <div>
      <PageHeader
        title="Frekwencja"
        description={`Sprawdź obecność${subjectName ? ` — ${subjectName}` : ""} • ${date}`}
        actions={<div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>}
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Card className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]"><Label className="text-xs">Szukaj</Label><Input placeholder="Imię lub nazwisko…" value={query} onChange={e => setQuery(e.target.value)} /></div>
          <div className="w-44"><Label className="text-xs">Przedmiot</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— ogólna —</SelectItem>
                {(subjects as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40"><Label className="text-xs">Klasa</Label>
            <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="w-44"><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="journal">Kolejność z dziennika</SelectItem>
                <SelectItem value="first_name">Imię</SelectItem>
                <SelectItem value="last_name">Nazwisko</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
        <Card className="p-4 space-y-2">
          {filtered.map(s => {
            const cur = (attendance as any[]).find(a => a.student_id === s.id)?.status ?? "";
            return (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0 flex-wrap">
                <div className="w-8 text-xs font-mono text-muted-foreground">{s.journal_no ?? "—"}</div>
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
