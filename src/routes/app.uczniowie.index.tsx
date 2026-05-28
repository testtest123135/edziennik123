import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/grade-utils";
import { Plus, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/uczniowie/")({ component: StudentsPage });

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", class_name: "", parent_name: "", parent_contact: "", notes: "" });
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState("first_name");

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*").order("first_name")).data ?? [],
  });

  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))) as string[], [students]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter(s => !q || fullName(s).toLowerCase().includes(q))
      .filter(s => classFilter === "all" || s.class_name === classFilter)
      .sort((a, b) => {
        if (sort === "behavior_points") return b.behavior_points - a.behavior_points;
        if (sort === "last_name") return (a.last_name ?? "").localeCompare(b.last_name ?? "");
        if (sort === "class_name") return (a.class_name ?? "").localeCompare(b.class_name ?? "");
        return (a.first_name ?? "").localeCompare(b.first_name ?? "");
      });
  }, [students, search, classFilter, sort]);

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("students").insert(form); if (error) throw error; },
    onSuccess: () => { toast.success("Uczeń dodany"); qc.invalidateQueries({ queryKey: ["students"] }); setForm({ first_name: "", last_name: "", class_name: "", parent_name: "", parent_contact: "", notes: "" }); setOpen(false); },
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
      <div className="p-8 space-y-4">
        <Card className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Szukaj</Label><Input placeholder="Imię lub nazwisko…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="w-40"><Label className="text-xs">Klasa</Label>
            <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="w-44"><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="first_name">Imię (A-Z)</SelectItem><SelectItem value="last_name">Nazwisko (A-Z)</SelectItem><SelectItem value="class_name">Klasa</SelectItem><SelectItem value="behavior_points">Pkt zach. (malejąco)</SelectItem>
            </SelectContent></Select>
          </div>
        </Card>
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Uczeń</th><th className="text-left p-3">Klasa</th><th className="text-left p-3">Rodzic</th><th className="text-right p-3">Pkt zach.</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="p-3">{s.class_name ?? "—"}</td>
                  <td className="p-3">{s.parent_name ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{s.behavior_points}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link to="/app/uczniowie/$id" params={{ id: s.id }}>
                        <Button size="sm" variant="outline"><FolderOpen className="w-3.5 h-3.5 mr-1" />Kartoteka</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Brak uczniów.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
