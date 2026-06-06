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
  const [form, setForm] = useState<any>(emptyForm);
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

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { student_id: form.student_id, type: form.type, reason: form.reason, details: form.details || null };
      payload.expires_at = form.expires_at ? new Date(form.expires_at).toISOString() : null;
      payload.amount = typeMeta?.needsPayment ? (Number(form.amount) || null) : null;
      payload.pay_due_date = typeMeta?.needsPayment ? (form.pay_due_date || null) : null;
      payload.installments_allowed = typeMeta?.needsPayment ? !!form.installments_allowed : false;
      payload.degree = typeMeta?.needsDegree ? (Number(form.degree) || null) : null;
      payload.work_hours_required = typeMeta?.needsWork ? (Number(form.work_hours_required) || null) : null;
      payload.work_due_date = typeMeta?.needsWorkDueDate ? (form.work_due_date || null) : null;
      payload.hours = typeMeta?.needsHours ? Math.min(168, Number(form.hours) || 0) : null;
      payload.penalty_points = Math.max(0, Number(form.penalty_points) || 0);
      if (editing) {
        const { error } = await supabase.from("punishments").update(payload).eq("id", editing.id); if (error) throw error;
      } else {
        if (typeMeta?.needsHours) payload.arrest_started_at = new Date().toISOString();
        const { error } = await supabase.from("punishments").insert(payload); if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Zaktualizowano" : "Kara nałożona"); qc.invalidateQueries({ queryKey: ["punishments"] }); qc.invalidateQueries({ queryKey: ["students"] }); setOpen(false); setEditing(null); setForm(emptyForm); },
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
  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  return (
    <div>
      <PageHeader title="Kary" description="Kary dla uczniów (osobno od punktów zachowania)." actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nowa kara</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edytuj karę" : "Nałóż karę"}</DialogTitle></DialogHeader>
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
              <div><Label>Powód *</Label><Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} /></div>
              <div><Label>Dodatkowe dane / opis</Label><Textarea value={form.details} onChange={e => setForm({...form, details: e.target.value})} /></div>
              {typeMeta?.needsExpiry && <div><Label>Wygasa (data)</Label><Input type="datetime-local" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} /></div>}
              {typeMeta?.needsPayment && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Kwota (zł)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                    <div><Label>Termin zapłaty</Label><Input type="date" value={form.pay_due_date} onChange={e => setForm({...form, pay_due_date: e.target.value})} /></div>
                  </div>
                  <div className="flex items-center gap-2"><Switch checked={form.installments_allowed} onCheckedChange={(v) => setForm({...form, installments_allowed: v})} /><Label>Możliwe raty</Label></div>
                </>
              )}
              {typeMeta?.needsDegree && <div><Label>Stopień (1–20)</Label><Input type="number" min="1" max="20" value={form.degree} onChange={e => setForm({...form, degree: e.target.value})} /></div>}
              {typeMeta?.needsWork && <div><Label>Wymagane godziny pracy</Label><Input type="number" step="0.5" value={form.work_hours_required} onChange={e => setForm({...form, work_hours_required: e.target.value})} /></div>}
              {typeMeta?.needsWorkDueDate && <div><Label>Termin wykonania pracy</Label><Input type="date" value={form.work_due_date} onChange={e => setForm({...form, work_due_date: e.target.value})} /></div>}
              {typeMeta?.needsHours && <div><Label>Godziny aresztu (max 168 = 7 dni)</Label><Input type="number" max="168" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} /><p className="text-xs text-muted-foreground mt-1">Areszt liczony od momentu nałożenia. Po upływie godzin sam wygasa, ale zostaje w kartotece.</p></div>}
              <div><Label>Punkty minusowe z zachowania</Label><Input type="number" min="0" placeholder="0 = brak" value={form.penalty_points} onChange={e => setForm({...form, penalty_points: e.target.value})} /><p className="text-xs text-muted-foreground mt-1">Tyle punktów odejmie od zachowania ucznia. Wróci, gdy karę usuniesz.</p></div>
              <Button onClick={() => save.mutate()} disabled={!form.student_id || !form.reason} className="w-full">{editing ? "Zapisz zmiany" : "Nałóż karę"}</Button>
            </div>
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
