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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GRADE_OPTIONS, gradeToValue, fullName } from "@/lib/grade-utils";
import { Plus, Trash2, Pencil, Star, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/oceny")({ component: GradesPage });

function GradesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Wspólne pola dla obu trybów
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [subjectId, setSubjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [weight, setWeight] = useState("1");
  const [description, setDescription] = useState("");
  const [noCorrection, setNoCorrection] = useState(false);

  // Tryb „taka sama ocena dla wielu"
  const [grade, setGrade] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // Tryb „inna ocena dla każdego ucznia"
  const [perStudent, setPerStudent] = useState<Record<string, string>>({});
  const [perNoCorr, setPerNoCorr] = useState<Record<string, boolean>>({});

  // Edycja
  const [editing, setEditing] = useState<any>(null);

  // Popraw
  const [correctOf, setCorrectOf] = useState<any>(null);
  const [correctGrade, setCorrectGrade] = useState("");

  // Historia
  const [historyOf, setHistoryOf] = useState<any>(null);

  // Filtry
  const [fStudent, setFStudent] = useState("all");
  const [fSubject, setFSubject] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [sort, setSort] = useState("date_desc");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("sort_order").order("journal_no")).data ?? [] });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("grade_categories").select("*")).data ?? [] });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: async () => (await supabase.from("grades").select("*, students(first_name, last_name), grade_categories(name), subjects(name)").order("date", { ascending: false }).limit(1000)).data ?? [],
  });

  // Mapowanie korekt: zbiór id ocen, które mają swoją poprawkę (czyli są „starymi")
  const replacedIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of grades as any[]) if (g.original_grade_id) s.add(g.original_grade_id);
    return s;
  }, [grades]);

  const filtered = useMemo(() => {
    return (grades as any[])
      // ukryj oryginały, które mają korektę (pokazujemy tylko aktualną wersję w łańcuchu)
      .filter(g => !replacedIds.has(g.id))
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
        if (sort === "subject") return (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? "");
        if (sort === "weight_desc") return Number(b.weight) - Number(a.weight);
        return b.date.localeCompare(a.date);
      });
  }, [grades, replacedIds, fStudent, fSubject, fCategory, fFrom, fTo, sort]);

  const resetForm = () => {
    setGrade(""); setDescription(""); setSelected([]); setPerStudent({}); setPerNoCorr({}); setNoCorrection(false);
  };

  const addSame = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error("Wybierz przynajmniej jednego ucznia");
      if (!grade) throw new Error("Wybierz ocenę");
      const cat = categories.find(c => c.id === categoryId);
      const rows = selected.map(sid => ({
        student_id: sid, subject_id: subjectId || null, category_id: categoryId || null,
        grade, grade_value: gradeToValue(grade), weight: Number(weight) || (cat?.weight ?? 1),
        description: description || null, date, no_correction: noCorrection,
      }));
      const { error } = await supabase.from("grades").insert(rows); if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`Wystawiono ocen: ${n}`); qc.invalidateQueries({ queryKey: ["grades"] }); setOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addPer = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(perStudent).filter(([, g]) => g && g.trim());
      if (entries.length === 0) throw new Error("Wpisz ocenę przynajmniej jednemu uczniowi");
      const cat = categories.find(c => c.id === categoryId);
      const rows = entries.map(([sid, g]) => ({
        student_id: sid, subject_id: subjectId || null, category_id: categoryId || null,
        grade: g, grade_value: gradeToValue(g), weight: Number(weight) || (cat?.weight ?? 1),
        description: description || null, date, no_correction: noCorrection,
      }));
      const { error } = await supabase.from("grades").insert(rows); if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`Wystawiono ocen: ${n}`); qc.invalidateQueries({ queryKey: ["grades"] }); setOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("grades").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Usunięto"); qc.invalidateQueries({ queryKey: ["grades"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateGrade = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { id, grade, weight, description, date, subject_id, category_id } = editing;
      const { error } = await supabase.from("grades").update({
        grade, grade_value: gradeToValue(grade), weight: Number(weight) || 1,
        description: description || null, date, subject_id: subject_id || null, category_id: category_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Zaktualizowano"); qc.invalidateQueries({ queryKey: ["grades"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const submitCorrection = useMutation({
    mutationFn: async () => {
      if (!correctOf || !correctGrade) throw new Error("Wybierz nową ocenę");
      // Znajdź źródło łańcucha (jeśli klikany element jest już korektą, „cofnij" do oryginału)
      // Tu zezwalamy tylko jednorazowo: jeśli ten id jest już oryginałem czyjejś korekty → blokujemy
      if (replacedIds.has(correctOf.id)) throw new Error("Ta ocena była już raz poprawiana.");
      if (correctOf.no_correction) throw new Error("Ta ocena jest oznaczona jako nie do poprawy.");
      const { error } = await supabase.from("grades").insert({
        student_id: correctOf.student_id,
        subject_id: correctOf.subject_id,
        category_id: correctOf.category_id,
        weight: correctOf.weight,
        description: correctOf.description,
        date: new Date().toISOString().slice(0, 10),
        grade: correctGrade,
        grade_value: gradeToValue(correctGrade),
        original_grade_id: correctOf.id,
        is_correction: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Poprawka zapisana"); qc.invalidateQueries({ queryKey: ["grades"] }); setCorrectOf(null); setCorrectGrade(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const getHistory = (g: any): any[] => {
    // Zbierz łańcuch: oryginał → kolejne korekty (max 1 wg reguły, ale uogólnijmy)
    const all = grades as any[];
    const chain: any[] = [];
    // Jeśli g jest korektą — znajdź oryginał
    let cur: any = g;
    while (cur?.original_grade_id) {
      const prev = all.find(x => x.id === cur.original_grade_id);
      if (!prev) break;
      cur = prev;
    }
    chain.push(cur); // oryginał
    // Idź do przodu po korektach
    let nxt = all.find(x => x.original_grade_id === cur.id);
    while (nxt) {
      chain.push(nxt);
      nxt = all.find(x => x.original_grade_id === nxt.id);
    }
    return chain;
  };

  return (
    <div>
      <PageHeader title="Oceny" description="Wystawiaj seryjnie z tą samą oceną lub z różnymi. Każdą ocenę można jednorazowo poprawić." actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Wystaw oceny</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nowe oceny</DialogTitle></DialogHeader>

            {/* Wspólne pola */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label>Przedmiot</Label>
                <Select value={subjectId} onValueChange={setSubjectId}><SelectTrigger><SelectValue placeholder="(opcjonalnie)" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Kategoria</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); const c = categories.find(x => x.id === v); if (c) setWeight(String(c.weight)); }}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (waga {c.weight})</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Waga</Label><Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></div>
              <div className="col-span-2"><Label>Opis (opcjonalnie)</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div className="col-span-2 flex items-center gap-2 p-2 rounded border bg-muted/30">
                <Checkbox id="no-correction" checked={noCorrection} onCheckedChange={(v) => setNoCorrection(!!v)} />
                <Label htmlFor="no-correction" className="cursor-pointer">Nie można poprawić tej oceny</Label>
              </div>
            </div>

            <Tabs defaultValue="same" className="mt-2">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="same">Ta sama ocena dla wielu</TabsTrigger>
                <TabsTrigger value="per">Inna ocena dla każdego</TabsTrigger>
              </TabsList>

              <TabsContent value="same" className="space-y-3">
                <div><Label>Ocena</Label>
                  <Select value={grade} onValueChange={setGrade}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <Label>Uczniowie ({selected.length} zaznaczonych)</Label>
                  <div className="border rounded-md max-h-56 overflow-y-auto p-2 space-y-1">
                    <label className="flex items-center gap-2 px-2 py-1 text-sm font-medium border-b mb-1">
                      <Checkbox checked={selected.length === students.length && students.length > 0} onCheckedChange={(v) => setSelected(v ? students.map(s => s.id) : [])} />Wszyscy
                    </label>
                    {students.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded text-sm cursor-pointer">
                        <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => setSelected(v ? [...selected, s.id] : selected.filter(x => x !== s.id))} />
                        <span className="font-mono text-xs text-muted-foreground w-6">{s.journal_no ?? "—"}</span>
                        {s.first_name} {s.last_name}
                      </label>
                    ))}
                  </div>
                </div>
                <Button onClick={() => addSame.mutate()} disabled={!grade || selected.length === 0} className="w-full">Wystaw {selected.length} ocen</Button>
              </TabsContent>

              <TabsContent value="per" className="space-y-3">
                <p className="text-xs text-muted-foreground">Wpisz indywidualną ocenę przy uczniach. Puste pola = bez oceny.</p>
                <div className="border rounded-md max-h-72 overflow-y-auto p-2 space-y-1">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded text-sm">
                      <span className="font-mono text-xs text-muted-foreground w-6">{s.journal_no ?? "—"}</span>
                      <span className="flex-1">{s.first_name} {s.last_name}</span>
                      <Select value={perStudent[s.id] ?? ""} onValueChange={(v) => setPerStudent({ ...perStudent, [s.id]: v })}>
                        <SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value=" ">— brak —</SelectItem>
                          {GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <Button onClick={() => addPer.mutate()} disabled={Object.values(perStudent).filter(v => v && v.trim()).length === 0} className="w-full">
                  Wystaw {Object.values(perStudent).filter(v => v && v.trim()).length} ocen
                </Button>
              </TabsContent>
            </Tabs>
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
              <SelectItem value="student">Uczeń</SelectItem><SelectItem value="subject">Przedmiot</SelectItem>
              <SelectItem value="weight_desc">Waga ↓</SelectItem>
            </SelectContent></Select>
          </div>
        </Card>

        <Card>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Ocena</th><th className="text-left p-3">Uczeń</th><th className="text-left p-3">Przedmiot</th><th className="text-left p-3">Kategoria</th><th className="text-left p-3">Waga</th><th className="text-left p-3">Opis</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((g: any) => {
                const isCorrected = !!g.original_grade_id;
                const alreadyCorrectedOnce = isCorrected; // jednorazowo
                return (
                  <tr key={g.id} className="border-t border-border">
                    <td className="p-3">{g.date}</td>
                    <td className="p-3">
                      <span className="relative inline-block">
                        <span className="font-bold text-accent">{g.grade}</span>
                        {isCorrected && <Star className="absolute -top-2 -right-3 w-3 h-3 fill-warning text-warning" />}
                      </span>
                    </td>
                    <td className="p-3">{g.students?.first_name} {g.students?.last_name}</td>
                    <td className="p-3">{g.subjects?.name ?? "—"}</td>
                    <td className="p-3">{g.grade_categories?.name ?? "—"}</td>
                    <td className="p-3">{g.weight}</td>
                    <td className="p-3 text-muted-foreground">{g.description ?? "—"}{g.no_correction && <span className="ml-1 text-xs text-destructive">• bez poprawy</span>}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {g.no_correction ? (
                          <Button size="sm" variant="ghost" disabled title="Tej oceny nie można poprawić">Brak poprawy</Button>
                        ) : alreadyCorrectedOnce ? (
                          <Button size="sm" variant="ghost" title="Pokaż historię" onClick={() => setHistoryOf(g)}><History className="w-3.5 h-3.5 mr-1" />Popraw</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => { setCorrectOf(g); setCorrectGrade(""); }}><RotateCcw className="w-3.5 h-3.5 mr-1" />Popraw</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ ...g })}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Usunąć ocenę?")) del.mutate(g.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Brak ocen.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Edycja oceny */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edytuj ocenę</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} /></div>
              <div><Label>Ocena</Label>
                <Select value={editing.grade} onValueChange={(v) => setEditing({ ...editing, grade: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Przedmiot</Label>
                <Select value={editing.subject_id ?? ""} onValueChange={(v) => setEditing({ ...editing, subject_id: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Kategoria</Label>
                <Select value={editing.category_id ?? ""} onValueChange={(v) => setEditing({ ...editing, category_id: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Waga</Label><Input type="number" step="0.1" value={editing.weight} onChange={e => setEditing({ ...editing, weight: e.target.value })} /></div>
              <div className="col-span-2"><Label>Opis</Label><Input value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            </div>
          )}
          <Button onClick={() => updateGrade.mutate()}>Zapisz zmiany</Button>
        </DialogContent>
      </Dialog>

      {/* Popraw */}
      <Dialog open={!!correctOf} onOpenChange={(v) => !v && setCorrectOf(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Popraw ocenę</DialogTitle></DialogHeader>
          {correctOf && (
            <div className="space-y-3">
              <p className="text-sm">Stara ocena: <span className="font-bold text-accent">{correctOf.grade}</span> ({correctOf.students?.first_name} {correctOf.students?.last_name}, {correctOf.date})</p>
              <p className="text-xs text-muted-foreground">Poprawa jest jednorazowa. Do średniej ważonej liczy się tylko nowa ocena. Stara pozostaje widoczna w historii.</p>
              <div><Label>Nowa ocena</Label>
                <Select value={correctGrade} onValueChange={setCorrectGrade}><SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger><SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select>
              </div>
              <Button onClick={() => submitCorrection.mutate()} disabled={!correctGrade} className="w-full">Zapisz poprawkę</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Historia */}
      <Dialog open={!!historyOf} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Historia oceny</DialogTitle></DialogHeader>
          {historyOf && (
            <div className="space-y-2">
              {getHistory(historyOf).map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 p-2 border rounded">
                  <span className="text-xs text-muted-foreground w-20">{i === 0 ? "Oryginał" : `Poprawka ${i}`}</span>
                  <span className="font-bold text-accent text-lg">{h.grade}</span>
                  <span className="text-xs text-muted-foreground">{h.date}</span>
                  <span className="text-xs text-muted-foreground flex-1">{h.description ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
