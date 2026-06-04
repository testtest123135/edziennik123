import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tematy")({ component: TopicsPage });

function TopicsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [fSubject, setFSubject] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [search, setSearch] = useState("");

  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });
  const { data: topics = [] } = useQuery({ queryKey: ["topics"], queryFn: async () => (await supabase.from("lesson_topics").select("*, subjects(name)").order("date", { ascending: false }).limit(300)).data ?? [] });

  const filtered = useMemo(() => (topics as any[])
    .filter(t => fSubject === "all" || t.subject_id === fSubject)
    .filter(t => !fFrom || t.date >= fFrom)
    .filter(t => !fTo || t.date <= fTo)
    .filter(t => !search || t.topic.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "date_asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)),
    [topics, fSubject, fFrom, fTo, sort, search]);

  const [editing, setEditing] = useState<any>(null);
  const save = useMutation({
    mutationFn: async () => {
      const payload = { date, subject_id: subjectId || null, topic, notes: notes || null };
      if (editing) { const { error } = await supabase.from("lesson_topics").update(payload).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("lesson_topics").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success(editing ? "Zapisano" : "Dodano"); qc.invalidateQueries({ queryKey: ["topics"] }); setTopic(""); setNotes(""); setEditing(null); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("lesson_topics").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["topics"] }) });
  const openEdit = (t: any) => { setEditing(t); setDate(t.date); setSubjectId(t.subject_id ?? ""); setTopic(t.topic); setNotes(t.notes ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div>
      <PageHeader title="Tematy zajęć" description="Zapis tematów dla konkretnego dnia i przedmiotu." />
      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Nowy temat</h3>
          <div><Label>Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Przedmiot</Label>
            <Select value={subjectId} onValueChange={setSubjectId}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Temat</Label><Input value={topic} onChange={e => setTopic(e.target.value)} /></div>
          <div><Label>Notatki</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <Button onClick={() => add.mutate()} disabled={!topic} className="w-full"><Plus className="w-4 h-4 mr-1" />Dodaj</Button>
        </Card>
        <Card className="p-4 lg:col-span-2 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div className="col-span-2"><Label className="text-xs">Szukaj</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="w temacie…" /></div>
            <div><Label className="text-xs">Przedmiot</Label>
              <Select value={fSubject} onValueChange={setFSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-xs">Od</Label><Input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} /></div>
            <div><Label className="text-xs">Do</Label><Input type="date" value={fTo} onChange={e => setFTo(e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Sortuj</Label>
              <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date_desc">Data ↓</SelectItem><SelectItem value="date_asc">Data ↑</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="border-b border-border pb-2 last:border-0 flex gap-3">
                <div className="text-xs text-muted-foreground w-24 shrink-0">{t.date}<br /><span className="text-accent">{t.subjects?.name ?? "—"}</span></div>
                <div className="flex-1"><p className="font-medium text-sm">{t.topic}</p>{t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}</div>
                <button onClick={() => del.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
            {!filtered.length && <p className="text-sm text-muted-foreground text-center py-8">Brak tematów.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
