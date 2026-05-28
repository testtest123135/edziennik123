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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/zachowanie")({ component: BehaviorPage });

function BehaviorPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("5");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("last_name")).data ?? [] });
  const { data: entries = [] } = useQuery({ queryKey: ["behavior"], queryFn: async () => (await supabase.from("behavior_entries").select("*, students(first_name, last_name)").order("created_at", { ascending: false }).limit(100)).data ?? [] });

  const add = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const p = Number(points) * sign;
      const rows = selected.map(sid => ({ student_id: sid, points: p, reason }));
      const { error } = await supabase.from("behavior_entries").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punkty dodane");
      qc.invalidateQueries({ queryKey: ["behavior"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false); setSelected([]); setReason("");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("behavior_entries").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["behavior"] }); qc.invalidateQueries({ queryKey: ["students"] }); },
  });

  return (
    <div>
      <PageHeader title="Zachowanie" description="Każdy uczeń startuje z 50 pkt. Dodawaj plusy lub minusy." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Dodaj punkty</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Punkty z zachowania</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Liczba punktów</Label><Input type="number" value={points} onChange={e => setPoints(e.target.value)} /></div>
              <div><Label>Powód</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="np. aktywność na lekcji" /></div>
              <div>
                <Label>Uczniowie ({selected.length})</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                  <label className="flex items-center gap-2 px-2 py-1 text-sm font-medium border-b">
                    <Checkbox checked={selected.length === students.length && students.length > 0} onCheckedChange={(v) => setSelected(v ? students.map(s => s.id) : [])} />Wszyscy
                  </label>
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer">
                      <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => setSelected(v ? [...selected, s.id] : selected.filter(x => x !== s.id))} />
                      {s.last_name} {s.first_name} <span className="ml-auto text-muted-foreground">{s.behavior_points} pkt</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => add.mutate(1)} disabled={!selected.length} className="bg-success hover:bg-success/90"><Plus className="w-4 h-4 mr-1" />Plus</Button>
                <Button onClick={() => add.mutate(-1)} disabled={!selected.length} variant="destructive"><Minus className="w-4 h-4 mr-1" />Minus</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Aktualne saldo uczniów</h3>
          <div className="space-y-1">
            {students.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>{s.last_name} {s.first_name}</span>
                <span className={`font-mono font-bold ${s.behavior_points >= 50 ? "text-success" : "text-destructive"}`}>{s.behavior_points} pkt</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Historia wpisów</h3>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {(entries as any[]).map(e => (
              <div key={e.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0">
                <span className={`font-mono font-bold ${e.points > 0 ? "text-success" : "text-destructive"}`}>{e.points > 0 ? "+" : ""}{e.points}</span>
                <span className="flex-1">{e.students?.last_name} {e.students?.first_name}</span>
                <span className="text-muted-foreground text-xs">{e.reason ?? "—"}</span>
                <button onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive/70" /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
