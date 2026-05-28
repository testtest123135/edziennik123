import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/uczniowie")({ component: StudentsPage });

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", class_name: "", parent_name: "", parent_contact: "", notes: "" });

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*").order("last_name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Uczeń dodany");
      qc.invalidateQueries({ queryKey: ["students"] });
      setForm({ first_name: "", last_name: "", class_name: "", parent_name: "", parent_contact: "", notes: "" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("students").delete().eq("id", id); },
    onSuccess: () => { toast.success("Usunięto"); qc.invalidateQueries({ queryKey: ["students"] }); },
  });

  return (
    <div>
      <PageHeader title="Uczniowie" description="Zarządzanie uczniami i ich profilami." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Dodaj ucznia</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowy uczeń</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Imię</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
              <div><Label>Nazwisko</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
              <div><Label>Klasa</Label><Input value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})} /></div>
              <div><Label>Rodzic</Label><Input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} /></div>
              <div className="col-span-2"><Label>Kontakt do rodzica</Label><Input value={form.parent_contact} onChange={e => setForm({...form, parent_contact: e.target.value})} /></div>
              <div className="col-span-2"><Label>Notatki</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <Button onClick={() => add.mutate()} disabled={!form.first_name || !form.last_name}>Zapisz</Button>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8">
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Uczeń</th><th className="text-left p-3">Klasa</th><th className="text-left p-3">Rodzic</th><th className="text-right p-3">Pkt zach.</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {students?.map(s => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="p-3">{s.class_name ?? "—"}</td>
                  <td className="p-3">{s.parent_name ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{s.behavior_points}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => del.mutate(s.id)} className="text-destructive hover:opacity-70"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {!students?.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Brak uczniów. Dodaj pierwszego.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
