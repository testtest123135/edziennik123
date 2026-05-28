import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DAYS_OF_WEEK } from "@/lib/grade-utils";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/plan")({ component: SchedulePage });

function SchedulePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ day_of_week: 1, start_time: "08:00", end_time: "08:45", subject_id: "", class_name: "", room: "" });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });
  const { data: items = [] } = useQuery({ queryKey: ["schedule"], queryFn: async () => (await supabase.from("schedule").select("*, subjects(name)").order("day_of_week").order("start_time")).data ?? [] });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("schedule").insert({ ...form, subject_id: form.subject_id || null }); if (error) throw error; },
    onSuccess: () => { toast.success("Dodano"); qc.invalidateQueries({ queryKey: ["schedule"] }); setOpen(false); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("schedule").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }) });
  return (
    <div>
      <PageHeader title="Plan lekcji" description="Stałe zajęcia w określonych godzinach." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Pozycja planu</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowa pozycja</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Dzień</Label>
                <Select value={String(form.day_of_week)} onValueChange={(v) => setForm({...form, day_of_week: Number(v)})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Od</Label><Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} /></div>
                <div><Label>Do</Label><Input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} /></div>
              </div>
              <div><Label>Przedmiot</Label>
                <Select value={form.subject_id} onValueChange={(v) => setForm({...form, subject_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Klasa</Label><Input value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})} /></div>
                <div><Label>Sala</Label><Input value={form.room} onChange={e => setForm({...form, room: e.target.value})} /></div>
              </div>
              <Button onClick={() => add.mutate()} className="w-full">Dodaj</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {DAYS_OF_WEEK.slice(0, 5).map((d, idx) => (
          <Card key={d} className="p-3">
            <h3 className="font-semibold text-center pb-2 border-b">{d}</h3>
            <div className="space-y-2 mt-2">
              {(items as any[]).filter(i => i.day_of_week === idx + 1).map(i => (
                <div key={i.id} className="bg-secondary rounded p-2 text-xs">
                  <div className="font-mono text-muted-foreground">{i.start_time?.slice(0,5)}–{i.end_time?.slice(0,5)}</div>
                  <div className="font-semibold mt-0.5">{i.subjects?.name ?? "—"}</div>
                  <div className="text-muted-foreground">{i.class_name} {i.room && `· s. ${i.room}`}</div>
                  <button onClick={() => del.mutate(i.id)} className="text-destructive text-[10px] mt-1">usuń</button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
