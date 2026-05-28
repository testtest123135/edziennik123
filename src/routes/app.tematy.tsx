import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });
  const { data: topics = [] } = useQuery({ queryKey: ["topics"], queryFn: async () => (await supabase.from("lesson_topics").select("*, subjects(name)").order("date", { ascending: false }).limit(100)).data ?? [] });

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("lesson_topics").insert({ date, subject_id: subjectId || null, topic, notes: notes || null }); if (error) throw error; },
    onSuccess: () => { toast.success("Dodano"); qc.invalidateQueries({ queryKey: ["topics"] }); setTopic(""); setNotes(""); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("lesson_topics").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["topics"] }) });

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
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold mb-3">Ostatnie tematy</h3>
          <div className="space-y-2">
            {(topics as any[]).map(t => (
              <div key={t.id} className="border-b border-border pb-2 last:border-0 flex gap-3">
                <div className="text-xs text-muted-foreground w-24 shrink-0">{t.date}<br /><span className="text-accent">{t.subjects?.name ?? "—"}</span></div>
                <div className="flex-1"><p className="font-medium text-sm">{t.topic}</p>{t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}</div>
                <button onClick={() => del.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
            {!topics.length && <p className="text-sm text-muted-foreground text-center py-8">Brak tematów.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
