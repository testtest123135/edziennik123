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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kalendarz")({ component: CalendarPage });

const TYPES = ["wycieczka", "sprawdzian", "kartkowka", "odpowiedz_ustna", "uroczystosc", "inne"];

function CalendarPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", event_type: "inne", event_date: new Date().toISOString().slice(0,10), event_time: "" });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: async () => (await supabase.from("calendar_events").select("*").order("event_date")).data ?? [] });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("calendar_events").insert({ ...form, event_time: form.event_time || null }); if (error) throw error; },
    onSuccess: () => { toast.success("Dodano"); qc.invalidateQueries({ queryKey: ["events"] }); setOpen(false); setForm({ title: "", description: "", event_type: "inne", event_date: new Date().toISOString().slice(0,10), event_time: "" }); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("calendar_events").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }) });
  return (
    <div>
      <PageHeader title="Kalendarz" description="Wycieczki, sprawdziany, kartkówki, odpowiedzi ustne i więcej." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Wydarzenie</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowe wydarzenie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tytuł</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div><Label>Typ</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({...form, event_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Data</Label><Input type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} /></div>
                <div><Label>Godzina</Label><Input type="time" value={form.event_time} onChange={e => setForm({...form, event_time: e.target.value})} /></div>
              </div>
              <div><Label>Opis</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <Button onClick={() => add.mutate()} disabled={!form.title} className="w-full">Dodaj</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8">
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left p-3">Data</th><th className="text-left p-3">Godz.</th><th className="text-left p-3">Typ</th><th className="text-left p-3">Tytuł</th><th className="text-left p-3">Opis</th><th></th></tr></thead>
            <tbody>
              {(events as any[]).map(e => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3">{e.event_date}</td><td className="p-3">{e.event_time ?? "—"}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{e.event_type}</span></td>
                  <td className="p-3 font-medium">{e.title}</td><td className="p-3 text-muted-foreground">{e.description ?? "—"}</td>
                  <td className="p-3"><button onClick={() => del.mutate(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak wydarzeń.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
