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
import { Plus, Trash2, FolderOpen, Pencil, ArrowUp, ArrowDown, ListOrdered } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/uczniowie/")({ component: StudentsPage });

const emptyForm = {
  first_name: "", last_name: "", class_name: "",
  parent_name: "", parent_contact: "", parent_phone: "", parent_email: "",
  second_parent_name: "", second_parent_contact: "",
  date_of_birth: "", gender: "", pesel: "", address: "",
  health_notes: "", hobbies: "", notes: "",
};

function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState("sort_order");
  const [reorderOpen, setReorderOpen] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*").order("sort_order").order("first_name")).data ?? [],
  });

  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))) as string[], [students]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students
      .filter(s => !q || fullName(s).toLowerCase().includes(q) || String(s.journal_no ?? "").includes(q))
      .filter(s => classFilter === "all" || s.class_name === classFilter)
      .sort((a, b) => {
        if (sort === "behavior_points") return b.behavior_points - a.behavior_points;
        if (sort === "last_name") return (a.last_name ?? "").localeCompare(b.last_name ?? "");
        if (sort === "class_name") return (a.class_name ?? "").localeCompare(b.class_name ?? "");
        if (sort === "first_name") return (a.first_name ?? "").localeCompare(b.first_name ?? "");
        if (sort === "journal_no") return (a.journal_no ?? 0) - (b.journal_no ?? 0);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [students, search, classFilter, sort]);

  const upsert = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("students").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Zaktualizowano" : "Uczeń dodany");
      qc.invalidateQueries({ queryKey: ["students"] });
      setForm(emptyForm); setEditId(null); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("students").delete().eq("id", id); },
    onSuccess: () => { toast.success("Usunięto"); qc.invalidateQueries({ queryKey: ["students"] }); },
  });

  const swapOrder = useMutation({
    mutationFn: async ({ a, b }: { a: any; b: any }) => {
      await supabase.from("students").update({ sort_order: -1 }).eq("id", a.id);
      await supabase.from("students").update({ sort_order: a.sort_order }).eq("id", b.id);
      await supabase.from("students").update({ sort_order: b.sort_order }).eq("id", a.id);
      // Renumeruj nr w dzienniku zgodnie z nową kolejnością
      await supabase.rpc("renumber_students_journal");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });

  const renumber = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("renumber_students_journal"); if (error) throw error; },
    onSuccess: () => { toast.success("Przenumerowano uczniów"); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      first_name: s.first_name ?? "", last_name: s.last_name ?? "", class_name: s.class_name ?? "",
      parent_name: s.parent_name ?? "", parent_contact: s.parent_contact ?? "", notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const ordered = [...students].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div>
      <PageHeader title="Uczniowie" description="Zarządzanie uczniami, nr w dzienniku i kolejnością." actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReorderOpen(true)}><ListOrdered className="w-4 h-4 mr-1" />Kolejność</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(emptyForm); }}}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Dodaj ucznia</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edytuj ucznia" : "Nowy uczeń"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Imię</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
                <div><Label>Nazwisko</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
                <div><Label>Klasa</Label><Input value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})} /></div>
                <div><Label>Rodzic</Label><Input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} /></div>
                <div className="col-span-2"><Label>Kontakt do rodzica</Label><Input value={form.parent_contact} onChange={e => setForm({...form, parent_contact: e.target.value})} /></div>
                <div className="col-span-2"><Label>Notatki</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <Button onClick={() => upsert.mutate()} disabled={!form.first_name || !form.last_name}>{editId ? "Zapisz zmiany" : "Zapisz"}</Button>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <div className="p-8 space-y-4">
        <Card className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Szukaj</Label><Input placeholder="Imię, nazwisko, nr dziennika…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="w-40"><Label className="text-xs">Klasa</Label>
            <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="w-44"><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="sort_order">Kolejność systemowa</SelectItem>
              <SelectItem value="journal_no">Nr w dzienniku</SelectItem>
              <SelectItem value="first_name">Imię (A-Z)</SelectItem>
              <SelectItem value="last_name">Nazwisko (A-Z)</SelectItem>
              <SelectItem value="class_name">Klasa</SelectItem>
              <SelectItem value="behavior_points">Pkt zach. ↓</SelectItem>
            </SelectContent></Select>
          </div>
        </Card>
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3 w-12">Nr</th><th className="text-left p-3">Uczeń</th><th className="text-left p-3">Klasa</th><th className="text-left p-3">Rodzic</th><th className="text-right p-3">Pkt zach.</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-muted-foreground">{s.journal_no ?? "—"}</td>
                  <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="p-3">{s.class_name ?? "—"}</td>
                  <td className="p-3">{s.parent_name ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{s.behavior_points}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link to="/app/uczniowie/$id" params={{ id: s.id }}>
                        <Button size="sm" variant="outline"><FolderOpen className="w-3.5 h-3.5 mr-1" />Kartoteka</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Usunąć ${s.first_name} ${s.last_name}?`)) del.mutate(s.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak uczniów.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kolejność uczniów w systemie</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Wpływa na kolejność we wszystkich modułach. Nr w dzienniku jest aktualizowany automatycznie według kolejności.</p>
          <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => renumber.mutate()}>Przenumeruj wg kolejności</Button></div>
          <div className="space-y-1">
            {ordered.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                <span className="font-mono text-xs text-muted-foreground w-6">{idx + 1}.</span>
                <span className="flex-1">{s.first_name} {s.last_name}</span>
                <span className="text-xs text-muted-foreground">nr {s.journal_no ?? "—"}</span>
                <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => swapOrder.mutate({ a: s, b: ordered[idx - 1] })}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" disabled={idx === ordered.length - 1} onClick={() => swapOrder.mutate({ a: s, b: ordered[idx + 1] })}><ArrowDown className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
