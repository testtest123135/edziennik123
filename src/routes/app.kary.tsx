import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PUNISHMENT_TYPES, arrestExpired, arrestEndsAt } from "@/lib/grade-utils";
import { Plus, Trash2, Gavel, Wallet, CheckCircle2, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/kary")({ component: PunishmentsPage });

function PunishmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { student_id: "", type: "pouczenie", reason: "", details: "", expires_at: "", amount: "", pay_due_date: "", installments_allowed: false, degree: "", work_hours_required: "", work_due_date: "", hours: "", penalty_points: "" };
  const newItem = (type: string) => ({ type, reason: "", details: "", expires_at: "", amount: "", pay_due_date: "", installments_allowed: false, degree: "", work_hours_required: "", work_due_date: "", hours: "", penalty_points: "" });
  const [form, setForm] = useState<any>(emptyForm);
  const [multiStudent, setMultiStudent] = useState<string>("");
  const [multiItems, setMultiItems] = useState<any[]>([newItem("pouczenie")]);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [actionPunishment, setActionPunishment] = useState<any>(null);

  const [fStudent, setFStudent] = useState("all");
  const [fType, setFType] = useState("all");
  const [fActive, setFActive] = useState("all"); // all | active | done
  const [sort, setSort] = useState("date_desc");

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("sort_order").order("journal_no")).data ?? [] });
  const { data: items = [] } = useQuery({ queryKey: ["punishments"], queryFn: async () => (await supabase.from("punishments").select("*, students(first_name, last_name, journal_no)").order("created_at", { ascending: false })).data ?? [] });

  // Auto-cleanup wygasłych ostrzeżeń (1-3) na każdym wejściu w moduł
  useEffect(() => {
    supabase.rpc("cleanup_expired_punishments").then(({ data }) => {
      if (data && Number(data) > 0) { toast.info(`Usunięto wygasłych ostrzeżeń: ${data}`); qc.invalidateQueries({ queryKey: ["punishments"] }); qc.invalidateQueries({ queryKey: ["students"] }); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeMeta = PUNISHMENT_TYPES.find(t => t.value === form.type);

  const isActive = (p: any) => {
    const paidFully = p.amount && (p.amount_paid ?? 0) >= p.amount;
    const workedFully = p.work_hours_required && (p.work_hours_done ?? 0) >= p.work_hours_required;
    const expired = p.expires_at && new Date(p.expires_at) < new Date();
    const arrestDone = arrestExpired(p);
    if (paidFully || workedFully || expired || arrestDone) return false;
    return true;
  };

  const activeByStudent = useMemo(() => {
    const map = new Map<string, { student: any; count: number }>();
    for (const p of items as any[]) {
      if (!isActive(p)) continue;
      const key = p.student_id;
      const cur = map.get(key) ?? { student: p.students, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => (a.student?.journal_no ?? 0) - (b.student?.journal_no ?? 0));
  }, [items]);

  const filtered = useMemo(() => (items as any[])
    .filter(p => fStudent === "all" || p.student_id === fStudent)
    .filter(p => fType === "all" || p.type === fType)
    .filter(p => fActive === "all" || (fActive === "active" ? isActive(p) : !isActive(p)))
    .sort((a, b) => sort === "date_asc" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)),
    [items, fStudent, fType, fActive, sort]);

  const buildPayload = (it: any, studentId: string) => {
    const meta = PUNISHMENT_TYPES.find(t => t.value === it.type);
    const p: any = { student_id: studentId, type: it.type, reason: it.reason, details: it.details || null };
    p.expires_at = it.expires_at ? new Date(it.expires_at).toISOString() : null;
    p.amount = meta?.needsPayment ? (Number(it.amount) || null) : null;
    p.pay_due_date = meta?.needsPayment ? (it.pay_due_date || null) : null;
    p.installments_allowed = meta?.needsPayment ? !!it.installments_allowed : false;
    p.degree = meta?.needsDegree ? (Number(it.degree) || null) : null;
    p.work_hours_required = meta?.needsWork ? (Number(it.work_hours_required) || null) : null;
    p.work_due_date = meta?.needsWorkDueDate ? (it.work_due_date || null) : null;
    p.hours = meta?.needsHours ? Math.min(168, Number(it.hours) || 0) : null;
    p.penalty_points = Math.max(0, Number(it.penalty_points) || 0);
    return { payload: p, meta };
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { payload } = buildPayload(form, form.student_id);
        const { error } = await supabase.from("punishments").update(payload).eq("id", editing.id); if (error) throw error;
        return 1;
      }
      if (!multiStudent) throw new Error("Wybierz ucznia");
      if (!multiItems.length) throw new Error("Dodaj co najmniej jedną karę");
      const rows = multiItems.map(it => {
        if (!it.reason?.trim()) throw new Error(`Podaj powód dla: ${PUNISHMENT_TYPES.find(t => t.value === it.type)?.label}`);
        const { payload, meta } = buildPayload(it, multiStudent);
        if (meta?.needsHours) payload.arrest_started_at = new Date().toISOString();
        return payload;
      });
      const { error } = await supabase.from("punishments").insert(rows); if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(editing ? "Zaktualizowano" : `Nałożono kar: ${n}`); qc.invalidateQueries({ queryKey: ["punishments"] }); qc.invalidateQueries({ queryKey: ["students"] }); setOpen(false); setEditing(null); setForm(emptyForm); setMultiStudent(""); setMultiItems([newItem("pouczenie")]); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("punishments").delete().eq("id", id); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["punishments"] }); qc.invalidateQueries({ queryKey: ["students"] }); } });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      student_id: p.student_id, type: p.type, reason: p.reason ?? "", details: p.details ?? "",
      expires_at: p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : "",
      amount: p.amount ?? "", pay_due_date: p.pay_due_date ?? "", installments_allowed: !!p.installments_allowed,
      degree: p.degree ?? "", work_hours_required: p.work_hours_required ?? "", work_due_date: p.work_due_date ?? "",
      hours: p.hours ?? "", penalty_points: p.penalty_points ?? "",
    });
    setOpen(true);
  };
  const openNew = () => { setEditing(null); setForm(emptyForm); setMultiStudent(""); setMultiItems([newItem("pouczenie")]); setOpen(true); };

  const updateItem = (idx: number, patch: any) => setMultiItems(arr => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const toggleType = (typeValue: string) => {
    setMultiItems(arr => {
      const exists = arr.find(it => it.type === typeValue);
      if (exists) return arr.filter(it => it.type !== typeValue);
      return [...arr, newItem(typeValue)];
    });
  };
  const removeItem = (typeValue: string) => setMultiItems(arr => arr.filter(it => it.type !== typeValue));

  const renderItemFields = (it: any, idx: number, onChange: (patch: any) => void) => {
    const meta = PUNISHMENT_TYPES.find(t => t.value === it.type);
    return (
      <div className="space-y-2">
        <div><Label className="text-xs">Powód *</Label><Textarea rows={2} value={it.reason} onChange={e => onChange({ reason: e.target.value })} /></div>
        <div><Label className="text-xs">Dodatkowe dane / opis</Label><Textarea rows={2} value={it.details} onChange={e => onChange({ details: e.target.value })} /></div>
        {meta?.needsExpiry && <div><Label className="text-xs">Wygasa (data i godzina)</Label><Input type="datetime-local" value={it.expires_at} onChange={e => onChange({ expires_at: e.target.value })} /></div>}
        {meta?.needsPayment && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Kwota (zł)</Label><Input type="number" step="0.01" value={it.amount} onChange={e => onChange({ amount: e.target.value })} /></div>
              <div><Label className="text-xs">Termin zapłaty</Label><Input type="date" value={it.pay_due_date} onChange={e => onChange({ pay_due_date: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={it.installments_allowed} onCheckedChange={(v) => onChange({ installments_allowed: v })} /><Label className="text-xs">Możliwe raty</Label></div>
          </>
        )}
        {meta?.needsDegree && <div><Label className="text-xs">Stopień (1–20)</Label><Input type="number" min="1" max="20" value={it.degree} onChange={e => onChange({ degree: e.target.value })} /></div>}
        {meta?.needsWork && <div><Label className="text-xs">Wymagane godziny pracy</Label><Input type="number" step="0.5" value={it.work_hours_required} onChange={e => onChange({ work_hours_required: e.target.value })} /></div>}
        {meta?.needsWorkDueDate && <div><Label className="text-xs">Termin wykonania pracy</Label><Input type="date" value={it.work_due_date} onChange={e => onChange({ work_due_date: e.target.value })} /></div>}
        {meta?.needsHours && <div><Label className="text-xs">Godziny aresztu (max 168 = 7 dni)</Label><Input type="number" max="168" value={it.hours} onChange={e => onChange({ hours: e.target.value })} /><p className="text-[11px] text-muted-foreground mt-1">Areszt liczony od momentu nałożenia. Po upływie godzin sam wygasa, ale zostaje w kartotece.</p></div>}
        <div><Label className="text-xs">Punkty minusowe z zachowania</Label><Input type="number" min="0" placeholder="0 = brak" value={it.penalty_points} onChange={e => onChange({ penalty_points: e.target.value })} /></div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Kary" description="Kary dla uczniów (osobno od punktów zachowania)." actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); setMultiStudent(""); setMultiItems([newItem("pouczenie")]); } }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nowa kara</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edytuj karę" : `Nałóż kary${multiItems.length > 1 ? ` (${multiItems.length})` : ""}`}</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Uczeń</Label>
                  <Select value={form.student_id} onValueChange={(v) => setForm({...form, student_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                    <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.journal_no}. {s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Rodzaj kary</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PUNISHMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {renderItemFields(form, 0, (patch) => setForm({ ...form, ...patch }))}
                <Button onClick={() => save.mutate()} disabled={!form.student_id || !form.reason} className="w-full">Zapisz zmiany</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div><Label>Uczeń</Label>
                  <Select value={multiStudent} onValueChange={setMultiStudent}>
                    <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                    <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.journal_no}. {s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Rodzaj kar (możesz wybrać kilka)</Label>
                  <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <span className="truncate text-left">
                          {multiItems.length === 0 ? <span className="text-muted-foreground">Wybierz kary</span> : `Zaznaczono: ${multiItems.length}`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-1 max-h-72 overflow-y-auto" align="start">
                      {PUNISHMENT_TYPES.map(t => {
                        const checked = !!multiItems.find(it => it.type === t.value);
                        return (
                          <button type="button" key={t.value} onClick={() => toggleType(t.value)} className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent text-left">
                            <Checkbox checked={checked} onCheckedChange={() => toggleType(t.value)} />
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                  {multiItems.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {multiItems.map(it => {
                        const m = PUNISHMENT_TYPES.find(t => t.value === it.type);
                        return (
                          <span key={it.type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs">
                            {m?.label}
                            <button type="button" onClick={() => removeItem(it.type)}><X className="w-3 h-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {multiItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Wybierz co najmniej jedną karę.</p>}
                {multiItems.map((it, idx) => {
                  const meta = PUNISHMENT_TYPES.find(t => t.value === it.type);
                  return (
                    <Card key={it.type} className="p-3 space-y-2 border-l-4 border-l-destructive">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm flex items-center gap-2"><Gavel className="w-4 h-4 text-destructive" />{meta?.label}</h4>
                        <button type="button" onClick={() => removeItem(it.type)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></button>
                      </div>
                      {renderItemFields(it, idx, (patch) => updateItem(idx, patch))}
                    </Card>
                  );
                })}
                <Button onClick={() => save.mutate()} disabled={!multiStudent || multiItems.length === 0} className="w-full">
                  Nałóż {multiItems.length > 1 ? `${multiItems.length} kary` : "karę"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      } />
      <div className="p-4 sm:p-6 lg:p-8 space-y-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-semibold text-sm">Uczniowie z aktywnymi karami ({activeByStudent.length})</h2>
            {activeByStudent.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setFActive("active")}>Pokaż wszystkie aktywne</Button>
            )}
          </div>
          {activeByStudent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nikt obecnie nie ma aktywnej kary. 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeByStudent.map(({ student, count }) => (
                <button
                  key={student?.id}
                  onClick={() => { setFStudent(student.id); setFActive("active"); }}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 font-medium"
                >
                  {student?.journal_no}. {student?.first_name} {student?.last_name}
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">{count}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div><Label className="text-xs">Uczeń</Label>
            <Select value={fStudent} onValueChange={setFStudent}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszyscy</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Rodzaj kary</Label>
            <Select value={fType} onValueChange={setFType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Wszystkie</SelectItem>{PUNISHMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label className="text-xs">Status</Label>
            <Select value={fActive} onValueChange={setFActive}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="active">Tylko aktywne</SelectItem>
              <SelectItem value="done">Wykonane / wygasłe</SelectItem>
            </SelectContent></Select>
          </div>
          <div><Label className="text-xs">Sortuj</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date_desc">Data ↓</SelectItem><SelectItem value="date_asc">Data ↑</SelectItem></SelectContent></Select>
          </div>
        </Card>
        {filtered.map(p => {
          const meta = PUNISHMENT_TYPES.find(t => t.value === p.type);
          const paidFully = p.amount && (p.amount_paid ?? 0) >= p.amount;
          const workedFully = p.work_hours_required && (p.work_hours_done ?? 0) >= p.work_hours_required;
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <Gavel className="w-5 h-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{meta?.label ?? p.type}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary">{p.students?.journal_no}. {p.students?.first_name} {p.students?.last_name}</span>
                    {(paidFully || workedFully) && <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Wykonana</span>}
                    {arrestExpired(p) && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Areszt zakończony</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(p.created_at).toLocaleString("pl")}</span>
                  </div>
                  <p className="text-sm mt-1"><strong>Powód:</strong> {p.reason}</p>
                  {p.details && <p className="text-xs text-muted-foreground mt-1">{p.details}</p>}
                  <div className="flex gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                    {p.expires_at && (() => { const d = new Date(p.expires_at); const expired = d < new Date(); return <span className={expired ? "text-destructive font-medium" : ""}>Wygasa: {d.toLocaleString("pl", { dateStyle: "short", timeStyle: "short" })}{expired ? " (wygasła)" : ""}</span>; })()}
                    {p.amount && <span>Kwota: {p.amount} zł {p.installments_allowed && "(raty)"} • do {p.pay_due_date} • opł.: {p.amount_paid ?? 0} zł</span>}
                    {p.degree && <span>Stopień: {p.degree}</span>}
                    {p.work_hours_required && <span>Praca: {p.work_hours_done ?? 0}/{p.work_hours_required} h{p.work_due_date ? ` • do ${p.work_due_date}` : ""}</span>}
                    {p.hours && (() => { const end = arrestEndsAt(p); return <span>{p.hours} h aresztu{end ? ` • do ${end.toLocaleString("pl", { dateStyle: "short", timeStyle: "short" })}` : ""}{arrestExpired(p) ? " (zakończony)" : ""}</span>; })()}
                    {p.penalty_points > 0 && <span className="text-destructive font-semibold">−{p.penalty_points} pkt zach.</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {(meta?.needsPayment || meta?.needsWork) && (
                    <Button size="sm" variant="outline" onClick={() => setActionPunishment(p)}>
                      <Wallet className="w-3.5 h-3.5 mr-1" />{meta?.needsPayment ? "Opłać" : "Wpisz wykonanie"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edytuj</Button>
                  <button onClick={() => { if (window.confirm("Usunąć karę?")) del.mutate(p.id); }}><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              </div>
            </Card>
          );
        })}
        {!filtered.length && <Card className="p-8 text-center text-muted-foreground">Brak kar.</Card>}
      </div>

      <PaymentDialog punishment={actionPunishment} onClose={() => setActionPunishment(null)} />
    </div>
  );
}

function PaymentDialog({ punishment, onClose }: { punishment: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");

  const { data: payments = [] } = useQuery({
    queryKey: ["punishment_payments", punishment?.id],
    queryFn: async () => punishment ? (await supabase.from("punishment_payments").select("*").eq("punishment_id", punishment.id).order("paid_at", { ascending: false })).data ?? [] : [],
    enabled: !!punishment,
  });

  const meta = PUNISHMENT_TYPES.find(t => t.value === punishment?.type);
  const isMoney = !!meta?.needsPayment;
  const remaining = isMoney ? Math.max(0, (punishment?.amount ?? 0) - (punishment?.amount_paid ?? 0)) : Math.max(0, (punishment?.work_hours_required ?? 0) - (punishment?.work_hours_done ?? 0));

  const pay = useMutation({
    mutationFn: async ({ full }: { full: boolean }) => {
      if (!punishment) return;
      const row: any = { punishment_id: punishment.id, note: note || null };
      if (isMoney) {
        row.kind = "payment";
        row.amount = full ? remaining : Number(amount);
        if (!row.amount || row.amount <= 0) throw new Error("Podaj kwotę");
      } else {
        row.kind = "work_hours";
        row.hours = full ? remaining : Number(hours);
        if (!row.hours || row.hours <= 0) throw new Error("Podaj liczbę godzin");
      }
      const { error } = await supabase.from("punishment_payments").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zapisano");
      qc.invalidateQueries({ queryKey: ["punishments"] });
      qc.invalidateQueries({ queryKey: ["punishment_payments", punishment?.id] });
      setAmount(""); setHours(""); setNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delPay = useMutation({
    mutationFn: async (id: string) => { await supabase.from("punishment_payments").delete().eq("id", id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["punishments"] });
      qc.invalidateQueries({ queryKey: ["punishment_payments", punishment?.id] });
    },
  });

  return (
    <Dialog open={!!punishment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isMoney ? "Opłata kary grzywny" : "Wykonanie pracy"}</DialogTitle></DialogHeader>
        {punishment && (
          <div className="space-y-3">
            <div className="text-sm bg-muted p-3 rounded">
              <p><strong>{punishment.students?.first_name} {punishment.students?.last_name}</strong> — {meta?.label}</p>
              {isMoney ? (
                <p className="text-xs mt-1">Łącznie: <strong>{punishment.amount} zł</strong> • Opłacono: {punishment.amount_paid ?? 0} zł • Pozostało: <strong className="text-destructive">{remaining.toFixed(2)} zł</strong>{punishment.installments_allowed && " • Raty dozwolone"}</p>
              ) : (
                <p className="text-xs mt-1">Wymagane: <strong>{punishment.work_hours_required} h</strong> • Wykonano: {punishment.work_hours_done ?? 0} h • Pozostało: <strong className="text-destructive">{remaining} h</strong></p>
              )}
            </div>

            {remaining > 0 && (
              <>
                {isMoney ? (
                  <div><Label>Kwota wpłaty (zł)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={punishment.installments_allowed ? "rata, np. 50" : String(remaining)} /></div>
                ) : (
                  <div><Label>Godziny wykonane</Label><Input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} /></div>
                )}
                <div><Label>Notatka</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="opcjonalnie" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => pay.mutate({ full: false })}>Zapisz {isMoney ? "wpłatę" : "godziny"}</Button>
                  <Button variant="outline" onClick={() => pay.mutate({ full: true })}>Zapłać całość ({remaining.toFixed(isMoney ? 2 : 1)})</Button>
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Historia</Label>
              <div className="border rounded max-h-48 overflow-y-auto divide-y">
                {payments.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Brak wpisów.</p>}
                {(payments as any[]).map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 text-xs">
                    <span className="font-mono">{new Date(p.paid_at).toLocaleDateString("pl")}</span>
                    <span className="font-semibold">{p.kind === "payment" ? `${p.amount} zł` : `${p.hours} h`}</span>
                    {p.note && <span className="text-muted-foreground flex-1 truncate">{p.note}</span>}
                    <button onClick={() => delPay.mutate(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
