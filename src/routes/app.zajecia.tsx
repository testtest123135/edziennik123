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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/zajecia")({ component: ExtraPage });

function ExtraPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", date: "", start_time: "", end_time: "", location: "", notes: "", status: "planowane" });
  const { data: items = [] } = useQuery({ queryKey: ["extra"], queryFn: async () => (await supabase.from("extra_activities").select("*").order("date", { ascending: false })).data ?? [] });
  const add = useMutation({
    mutationFn: async () => { const payload = { ...form, date: form.date || null, start_time: form.start_time || null, end_time: form.end_time || null }; const { error } = await supabase.from("extra_activities").insert(payload); if (error) throw error; },
    onSuccess: () => { toast.success("Dodano"); qc.invalidateQueries({ queryKey: ["extra"] }); setOpen(false); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("extra_activities").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["extra"] }) });
  return (
    <div>
      <PageHeader title="Zajęcia dodatkowe" description="Monitoring zajęć pozalekcyjnych i ich przebiegu." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Zajęcia</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowe zajęcia</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nazwa</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Opis</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
                <div><Label>Od</Label><Input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} /></div>
                <div><Label>Do</Label><Input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} /></div>
              </div>
              <div><Label>Miejsce</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
              <div><Label>Notatki z przebiegu</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <Button onClick={() => add.mutate()} disabled={!form.name} className="w-full">Dodaj</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 space-y-3">
        {(items as any[]).map(i => (
          <Card key={i.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{i.name}</h3>
                <p className="text-xs text-muted-foreground">{i.date} {i.start_time?.slice(0,5)}–{i.end_time?.slice(0,5)} {i.location && `· ${i.location}`}</p>
                {i.description && <p className="text-sm mt-1">{i.description}</p>}
                {i.notes && <p className="text-xs text-muted-foreground mt-2 italic">{i.notes}</p>}
              </div>
              <button onClick={() => del.mutate(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </Card>
        ))}
        {!items.length && <Card className="p-8 text-center text-muted-foreground">Brak zajęć dodatkowych.</Card>}
      </div>
    </div>
  );
}
