import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/zachowanie")({ component: BehaviorPage });

function BehaviorPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("5");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const [editing, setEditing] = useState<any>(null);
  const [editPoints, setEditPoints] = useState("");
  const [editReason, setEditReason] = useState("");

  const [fStudent, setFStudent] = useState("all");
  const [fSign, setFSign] = useState("all");
  const [sort, setSort] = useState("date_desc");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("sort_order").order("journal_no")).data ?? [] });
  const { data: entries = [] } = useQuery({ queryKey: ["behavior"], queryFn: async () => (await supabase.from("behavior_entries").select("*, students(first_name, last_name)").order("created_at", { ascending: false }).limit(200)).data ?? [] });

  const filteredEntries = useMemo(() => (entries as any[])
    .filter(e => fStudent === "all" || e.student_id === fStudent)
    .filter(e => fSign === "all" || (fSign === "plus" ? e.points > 0 : e.points < 0))
    .sort((a, b) => {
      if (sort === "date_asc") return a.created_at.localeCompare(b.created_at);
      if (sort === "points_desc") return b.points - a.points;
      if (sort === "points_asc") return a.points - b.points;
      return b.created_at.localeCompare(a.created_at);
    }), [entries, fStudent, fSign, sort]);

  const add = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const absP = Math.abs(Number(points) || 0);
      if (absP >= 30) {
        const word = sign > 0 ? "plusowych" : "minusowych";
        if (!window.confirm(`Czy na pewno chcesz przyznać ${absP} pkt ${word} dla ${selected.length} ucz.? To duża zmiana.`)) {
          throw new Error("Anulowano");
        }
      }
      const p = absP * sign;
      const rows = selected.map(sid => ({ student_id: sid, points: p, reason }));
      const { error } = await supabase.from("behavior_entries").insert(rows); if (error) throw error;
    },
    onSuccess: () => { toast.success("Punkty dodane"); qc.invalidateQueries({ queryKey: ["behavior"] }); qc.invalidateQueries({ queryKey: ["students"] }); setOpen(false); setSelected([]); setReason(""); },
    onError: (e: any) => { if (e.message !== "Anulowano") toast.error(e.message); },
  });
  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("behavior_entries").update({ points: Number(editPoints) || 0, reason: editReason || null }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Zapisano"); qc.invalidateQueries({ queryKey: ["behavior"] }); qc.invalidateQueries({ queryKey: ["students"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
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
                      {s.first_name} {s.last_name} <span className="ml-auto text-muted-foreground">{s.behavior_points} pkt</span>
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Card className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2 items-end">
          <div><Label className="text-xs">Uczeń</Label>
            <Select value={fStudent} onValueChange={setFStudent}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszyscy</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Znak</Label>
            <Select value={fSign} onValueChange={setFSign}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem><SelectItem value="plus">Tylko plus</SelectItem><SelectItem value="minus">Tylko minus</SelectItem></SelectContent></Select>
          </div>
          <div><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date_desc">Data ↓</SelectItem><SelectItem value="date_asc">Data ↑</SelectItem><SelectItem value="points_desc">Punkty ↓</SelectItem><SelectItem value="points_asc">Punkty ↑</SelectItem></SelectContent></Select>
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Aktualne saldo uczniów</h3>
            <div className="space-y-1">
              {students.map(s => (
                <div key={s.id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <span>{s.first_name} {s.last_name}</span>
                  <span className={`font-mono font-bold ${s.behavior_points >= 50 ? "text-success" : "text-destructive"}`}>{s.behavior_points} pkt</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Historia wpisów</h3>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredEntries.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0">
                  <span className={`font-mono font-bold ${e.points > 0 ? "text-success" : "text-destructive"}`}>{e.points > 0 ? "+" : ""}{e.points}</span>
                  <span className="flex-1">{e.students?.first_name} {e.students?.last_name}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-[40%]">{e.reason ?? "—"}</span>
                  <button onClick={() => { setEditing(e); setEditPoints(String(e.points)); setEditReason(e.reason ?? ""); }}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  <button onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive/70" /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edytuj wpis</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{editing?.students?.first_name} {editing?.students?.last_name}</div>
            <div><Label>Punkty (np. -5 lub 10)</Label><Input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} /></div>
            <div><Label>Powód</Label><Input value={editReason} onChange={e => setEditReason(e.target.value)} /></div>
            <Button onClick={() => saveEdit.mutate()} className="w-full">Zapisz</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
