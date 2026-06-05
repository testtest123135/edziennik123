import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/kalendarz")({ component: CalendarPage });

const TYPES = ["wycieczka", "sprawdzian", "kartkowka", "odpowiedz_ustna", "uroczystosc", "inne"];
const TYPE_COLOR: Record<string, string> = {
  wycieczka: "bg-primary/15 text-primary",
  sprawdzian: "bg-destructive/15 text-destructive",
  kartkowka: "bg-warning/15 text-warning",
  odpowiedz_ustna: "bg-accent/15 text-accent",
  uroczystosc: "bg-success/15 text-success",
  inne: "bg-muted text-muted-foreground",
};

const emptyForm = { title: "", description: "", event_type: "inne", event_date: new Date().toISOString().slice(0,10), event_time: "" };

function CalendarPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [fType, setFType] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: async () => (await supabase.from("calendar_events").select("*").order("event_date")).data ?? [] });

  const filtered = useMemo(() => (events as any[])
    .filter(e => fType === "all" || e.event_type === fType)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase())),
    [events, fType, search]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, event_time: form.event_time || null };
      if (editing) { const { error } = await supabase.from("calendar_events").update(payload).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("calendar_events").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success(editing ? "Zapisano" : "Dodano"); qc.invalidateQueries({ queryKey: ["events"] }); setOpen(false); setEditing(null); setForm(emptyForm); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("calendar_events").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }) });

  const openNew = (date?: string) => { setEditing(null); setForm({ ...emptyForm, event_date: date ?? emptyForm.event_date }); setOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ title: e.title ?? "", description: e.description ?? "", event_type: e.event_type, event_date: e.event_date, event_time: e.event_time ?? "" }); setOpen(true); };

  // Month grid
  const monthLabel = cursor.toLocaleString("pl", { month: "long", year: "numeric" });
  const toLocalISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const grid = useMemo(() => {
    const firstDow = (cursor.getDay() + 6) % 7; // mon=0
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: string | null; isToday?: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null });
    const today = toLocalISO(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = toLocalISO(new Date(cursor.getFullYear(), cursor.getMonth(), d));
      cells.push({ date: ds, isToday: ds === today });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of filtered) { const a = m.get(e.event_date) ?? []; a.push(e); m.set(e.event_date, a); }
    return m;
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Kalendarz" description="Wycieczki, sprawdziany, kartkówki i więcej." actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button onClick={() => openNew()}><Plus className="w-4 h-4 mr-1" />Wydarzenie</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edytuj wydarzenie" : "Nowe wydarzenie"}</DialogTitle></DialogHeader>
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
              <Button onClick={() => save.mutate()} disabled={!form.title} className="w-full">{editing ? "Zapisz zmiany" : "Dodaj"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Card className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex gap-1">
            <Button size="sm" variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>Miesiąc</Button>
            <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>Lista</Button>
          </div>
          <div className="flex-1 min-w-[180px]"><Label className="text-xs">Szukaj</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="tytuł…" /></div>
          <div className="w-44"><Label className="text-xs">Typ</Label>
            <Select value={fType} onValueChange={setFType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{TYPES.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent></Select>
          </div>
        </Card>

        {view === "month" && (
          <Card className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <h3 className="font-semibold capitalize">{monthLabel}</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Dziś</Button>
                <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {["Pon","Wt","Śr","Czw","Pt","Sob","Nd"].map(d => <div key={d} className="text-center font-medium text-muted-foreground p-1">{d}</div>)}
              {grid.map((c, i) => (
                <div key={i} className={cn("min-h-[80px] sm:min-h-[100px] rounded border p-1 flex flex-col gap-1", c.date ? "bg-card" : "bg-muted/30 border-transparent", c.isToday && "ring-2 ring-primary")}>
                  {c.date && (
                    <>
                      <button className="text-left text-xs font-mono text-muted-foreground hover:text-foreground" onClick={() => openNew(c.date!)}>{Number(c.date.slice(-2))}</button>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {(byDate.get(c.date) ?? []).slice(0, 3).map(e => (
                          <button key={e.id} onClick={() => openEdit(e)} className={cn("text-[10px] sm:text-xs px-1 py-0.5 rounded truncate text-left", TYPE_COLOR[e.event_type] ?? "bg-muted")} title={`${e.event_time ?? ""} ${e.title}`}>
                            {e.event_time?.slice(0,5) ? `${e.event_time.slice(0,5)} ` : ""}{e.title}
                          </button>
                        ))}
                        {(byDate.get(c.date) ?? []).length > 3 && <span className="text-[10px] text-muted-foreground px-1">+{(byDate.get(c.date) ?? []).length - 3}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {view === "list" && (
          <Card>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="text-left p-3">Data</th><th className="text-left p-3">Godz.</th><th className="text-left p-3">Typ</th><th className="text-left p-3">Tytuł</th><th className="text-left p-3">Opis</th><th></th></tr></thead>
              <tbody>
                {filtered.slice().sort((a, b) => a.event_date.localeCompare(b.event_date)).map(e => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3">{e.event_date}</td><td className="p-3">{e.event_time ?? "—"}</td>
                    <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded", TYPE_COLOR[e.event_type] ?? "bg-muted")}>{e.event_type}</span></td>
                    <td className="p-3 font-medium">{e.title}</td><td className="p-3 text-muted-foreground">{e.description ?? "—"}</td>
                    <td className="p-3 flex gap-2"><button onClick={() => openEdit(e)}><Pencil className="w-4 h-4 text-muted-foreground" /></button><button onClick={() => del.mutate(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></button></td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak wydarzeń.</td></tr>}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
