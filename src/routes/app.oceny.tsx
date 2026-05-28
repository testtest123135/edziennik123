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
import { GRADE_OPTIONS, gradeToValue, fullName } from "@/lib/grade-utils";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/oceny")({ component: GradesPage });

function GradesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [weight, setWeight] = useState("1");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [subjectId, setSubjectId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // filters
  const [fStudent, setFStudent] = useState("all");
  const [fSubject, setFSubject] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [sort, setSort] = useState("date_desc");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("first_name")).data ?? [] });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("grade_categories").select("*")).data ?? [] });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => (await supabase.from("grades").select("*, students(first_name, last_name), grade_categories(name), subjects(name)").order("date", { ascending: false }).limit(500)).data ?? [],
  });

  const filtered = useMemo(() => {
    return (grades as any[])
      .filter(g => fStudent === "all" || g.student_id === fStudent)
      .filter(g => fSubject === "all" || g.subject_id === fSubject)
      .filter(g => fCategory === "all" || g.category_id === fCategory)
      .filter(g => !fFrom || g.date >= fFrom)
      .filter(g => !fTo || g.date <= fTo)
      .sort((a, b) => {
        if (sort === "date_asc") return a.date.localeCompare(b.date);
        if (sort === "grade_desc") return (b.grade_value ?? 0) - (a.grade_value ?? 0);
        if (sort === "grade_asc") return (a.grade_value ?? 0) - (b.grade_value ?? 0);
        if (sort === "student") return fullName(a.students).localeCompare(fullName(b.students));
        return b.date.localeCompare(a.date);
      });
  }, [grades, fStudent, fSubject, fCategory, fFrom, fTo, sort]);

  const add = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error("Wybierz przynajmniej jednego ucznia");
      const cat = categories.find(c => c.id === categoryId);
      const rows = selected.map(sid => ({
        student_id: sid, subject_id: subjectId || null, category_id: categoryId || null,
        grade, grade_value: gradeToValue(grade), weight: Number(weight) || (cat?.weight ?? 1),
        description: description || null, date,
      }));
      const { error } = await supabase.from("grades").insert(rows); if (error) throw error;
    },
    onSuccess: () => { toast.success(`Wystawiono ocen: ${selected.length}`); qc.invalidateQueries({ queryKey: ["grades"] }); setOpen(false); setSelected([]); setGrade(""); setDescription(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("grades").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }) });

  return (
    <div>
      <PageHeader title="Oceny" description="Wystawiaj oceny pojedynczo lub seryjnie." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Wystaw oceny</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nowa ocena (seryjnie)</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label>Ocena</Label>
                <Select value={grade} onValueChange={setGrade}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Przedmiot</Label>
                <Select value={subjectId} onValueChange={setSubjectId}><SelectTrigger><SelectValue placeholder="(opcjonalnie)" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); const c = categories.find(x => x.id === v); if (c) setWeight(String(c.weight)); }}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (waga {c.weight})</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Waga</Label><Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></div>
              <div className="col-span-2"><Label>Opis (opcjonalnie)</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            </div>
            <div>
              <Label>Uczniowie ({selected.length} zaznaczonych)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                <label className="flex items-center gap-2 px-2 py-1 text-sm font-medium border-b mb-1">
                  <Checkbox checked={selected.length === students.length && students.length > 0} onCheckedChange={(v) => setSelected(v ? students.map(s => s.id) : [])} />Wszyscy
                </label>
                {students.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer">
                    <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => setSelected(v ? [...selected, s.id] : selected.filter(x => x !== s.id))} />
                    {s.first_name} {s.last_name}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={() => add.mutate()} disabled={!grade || selected.length === 0}>Wystaw {selected.length} ocen</Button>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 space-y-4">
        <Card className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div><Label className="text-xs">Uczeń</Label>
            <Select value={fStudent} onValueChange={setFStudent}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszyscy</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Przedmiot</Label>
            <Select value={fSubject} onValueChange={setFSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Kategoria</Label>
            <Select value={fCategory} onValueChange={setFCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Od</Label><Input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Do</Label><Input type="date" value={fTo} onChange={e => setFTo(e.target.value)} /></div>
          <div><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="date_desc">Data ↓</SelectItem><SelectItem value="date_asc">Data ↑</SelectItem>
              <SelectItem value="grade_desc">Ocena ↓</SelectItem><SelectItem value="grade_asc">Ocena ↑</SelectItem>
              <SelectItem value="student">Uczeń</SelectItem>
            </SelectContent></Select>
          </div>
        </Card>
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Ocena</th><th className="text-left p-3">Uczeń</th><th className="text-left p-3">Przedmiot</th><th className="text-left p-3">Kategoria</th><th className="text-left p-3">Waga</th><th className="text-left p-3">Opis</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((g: any) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="p-3">{g.date}</td>
                  <td className="p-3"><span className="font-bold text-accent">{g.grade}</span></td>
                  <td className="p-3">{g.students?.first_name} {g.students?.last_name}</td>
                  <td className="p-3">{g.subjects?.name ?? "—"}</td>
                  <td className="p-3">{g.grade_categories?.name ?? "—"}</td>
                  <td className="p-3">{g.weight}</td>
                  <td className="p-3 text-muted-foreground">{g.description ?? "—"}</td>
                  <td className="p-3"><button onClick={() => del.mutate(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Brak ocen.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
