import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage, executeAiAction } from "@/lib/ai.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Send, Image as ImageIcon, Check, X, Sparkles, GraduationCap, CalendarCheck, Heart, Gavel, BookOpen, MessageSquare, ChartBar as BarChart3, TrendingUp, TriangleAlert as AlertTriangle, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ai")({ component: AIPage });

const DRAFT_KEY = (chatId: string | null) => `ai-draft:${chatId ?? "_"}`;
const IMG_KEY = (chatId: string | null) => `ai-img:${chatId ?? "_"}`;

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  add_grade:        { label: "Dodaj ocenę",                   icon: GraduationCap, color: "text-accent" },
  add_attendance:   { label: "Dodaj frekwencję",              icon: CalendarCheck, color: "text-primary" },
  add_behavior:     { label: "Dodaj punkty z zachowania",     icon: Heart,         color: "text-success" },
  add_punishment:   { label: "Dodaj karę",                    icon: Gavel,         color: "text-destructive" },
  add_lesson_topic: { label: "Dodaj temat lekcji",            icon: BookOpen,      color: "text-primary" },
  send_message:     { label: "Wyślij wiadomość do rodzica",   icon: MessageSquare, color: "text-accent" },
};

type QuickCmd = {
  id: string;
  label: string;
  icon: any;
  prompt: string;
  needsInput?: { key: string; label: string; placeholder: string }[];
  color: string;
};

const QUICK_COMMANDS: QuickCmd[] = [
  { id: "class_avg", label: "Średnia klasy", icon: BarChart3, prompt: "Jaka jest średnia ocen w klasie? Pokaż ranking uczniów ze średnimi.", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  { id: "subject_avg", label: "Średnia z przedmiotu", icon: TrendingUp, prompt: "Jaka jest średnia klasy z przedmiotu {subject}?", needsInput: [{ key: "subject", label: "Przedmiot", placeholder: "np. matematyka" }], color: "bg-accent/10 text-accent hover:bg-accent/20" },
  { id: "missing", label: "Braki ocen", icon: AlertTriangle, prompt: "Kto nie ma oceny z {category}?", needsInput: [{ key: "category", label: "Kategoria", placeholder: "np. sprawdzian, kartkówka" }], color: "bg-warning/10 text-warning hover:bg-warning/20" },
  { id: "improve", label: "Do poprawy", icon: TrendingUp, prompt: "Które oceny można poprawić? Pokaż listę z propozycjami.", color: "bg-success/10 text-success hover:bg-success/20" },
  { id: "attendance", label: "Frekwencja", icon: CalendarCheck, prompt: "Jak wygląda frekwencja w klasie? Kto ma najwięcej nieobecności?", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  { id: "student_summary", label: "Podsumowanie ucznia", icon: Users, prompt: "Podsumuj sytuację ucznia {student}: oceny, frekwencję, zachowanie, kary.", needsInput: [{ key: "student", label: "Uczeń", placeholder: "np. Jan Kowalski" }], color: "bg-accent/10 text-accent hover:bg-accent/20" },
  { id: "raise_avg", label: "Podnieś średnią", icon: TrendingUp, prompt: "Jak podnieść średnią ucznia {student} do {target}?", needsInput: [{ key: "student", label: "Uczeń", placeholder: "np. Jan Kowalski" }, { key: "target", label: "Docelowa średnia", placeholder: "np. 4.5" }], color: "bg-success/10 text-success hover:bg-success/20" },
  { id: "behavior_overview", label: "Zachowanie", icon: Heart, prompt: "Jak wygląda zachowanie w klasie? Kto ma najwięcej minusów?", color: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  { id: "punishments_active", label: "Aktywne kary", icon: Gavel, prompt: "Jakie są aktywne kary w klasie? Kto musi jeszcze odpracować lub zapłacić?", color: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
];

function parseStored(content: string): { actions: any[]; text: string } {
  if (!content.startsWith("__ACTIONS__")) return { actions: [], text: content };
  const nl = content.indexOf("\n");
  const json = content.slice("__ACTIONS__".length, nl >= 0 ? nl : content.length);
  const text = nl >= 0 ? content.slice(nl + 1) : "";
  try { return { actions: JSON.parse(json), text }; } catch { return { actions: [], text: content }; }
}

// ---------- Editable form for proposed action ----------
function ActionForm({
  name, initial, students, subjects, categories, onApprove, onReject, status,
}: {
  name: string;
  initial: any;
  students: any[];
  subjects: any[];
  categories: any[];
  status: "ok" | "rejected" | undefined;
  onApprove: (args: any) => void;
  onReject: () => void;
}) {
  const [args, setArgs] = useState<any>(() => ({ ...initial }));
  const set = (k: string, v: any) => setArgs((p: any) => ({ ...p, [k]: v }));
  const meta = ACTION_META[name] ?? { label: name, icon: Sparkles, color: "text-primary" };
  const Icon = meta.icon;
  const today = new Date().toISOString().slice(0, 10);

  const studentField = (
    <Field label="Uczeń">
      <Select value={args.student_id ?? ""} onValueChange={(v) => set("student_id", v)}>
        <SelectTrigger><SelectValue placeholder="Wybierz ucznia" /></SelectTrigger>
        <SelectContent>
          {students.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.journal_no ? `${s.journal_no}. ` : ""}{s.first_name} {s.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const subjectField = (
    <Field label="Przedmiot">
      <Select value={args.subject_id ?? "__none"} onValueChange={(v) => set("subject_id", v === "__none" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— brak —</SelectItem>
          {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );

  let body: React.ReactNode = null;
  if (name === "add_grade") {
    body = (
      <>
        {studentField}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ocena"><Input value={args.grade ?? ""} onChange={e => set("grade", e.target.value)} placeholder="np. 4+" /></Field>
          <Field label="Waga"><Input type="number" step="0.5" value={args.weight ?? 1} onChange={e => set("weight", Number(e.target.value))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {subjectField}
          <Field label="Kategoria">
            <Select value={args.category_id ?? "__none"} onValueChange={(v) => set("category_id", v === "__none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— brak —</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (×{c.weight})</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Data"><Input type="date" value={args.date ?? today} onChange={e => set("date", e.target.value)} /></Field>
        <Field label="Opis"><Input value={args.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="np. sprawdzian z ułamków" /></Field>
      </>
    );
  } else if (name === "add_attendance") {
    body = (
      <>
        {studentField}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data"><Input type="date" value={args.date ?? today} onChange={e => set("date", e.target.value)} /></Field>
          <Field label="Status">
            <Select value={args.status ?? "obecny"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["obecny","nieobecny","spóźniony","zwolniony","usprawiedliwiony"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {subjectField}
        <Field label="Notatka"><Input value={args.note ?? ""} onChange={e => set("note", e.target.value)} /></Field>
      </>
    );
  } else if (name === "add_behavior") {
    body = (
      <>
        {studentField}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Punkty"><Input type="number" value={args.points ?? 0} onChange={e => set("points", Number(e.target.value))} /></Field>
          <Field label="Data"><Input type="date" value={args.date ?? today} onChange={e => set("date", e.target.value)} /></Field>
        </div>
        <Field label="Powód"><Textarea rows={2} value={args.reason ?? ""} onChange={e => set("reason", e.target.value)} /></Field>
      </>
    );
  } else if (name === "add_punishment") {
    body = (
      <>
        {studentField}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Typ"><Input value={args.type ?? ""} onChange={e => set("type", e.target.value)} placeholder="grzywna / uwaga / prace" /></Field>
          <Field label="Stopień (1-5)"><Input type="number" min={1} max={5} value={args.degree ?? ""} onChange={e => set("degree", Number(e.target.value))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kwota (PLN)"><Input type="number" step="0.01" value={args.amount ?? ""} onChange={e => set("amount", Number(e.target.value))} /></Field>
          <Field label="Godziny pracy"><Input type="number" value={args.work_hours_required ?? ""} onChange={e => set("work_hours_required", Number(e.target.value))} /></Field>
        </div>
        <Field label="Powód"><Input value={args.reason ?? ""} onChange={e => set("reason", e.target.value)} /></Field>
        <Field label="Szczegóły"><Textarea rows={2} value={args.details ?? ""} onChange={e => set("details", e.target.value)} /></Field>
      </>
    );
  } else if (name === "add_lesson_topic") {
    body = (
      <>
        <div className="grid grid-cols-2 gap-2">
          {subjectField}
          <Field label="Data"><Input type="date" value={args.date ?? today} onChange={e => set("date", e.target.value)} /></Field>
        </div>
        <Field label="Temat"><Input value={args.topic ?? ""} onChange={e => set("topic", e.target.value)} /></Field>
        <Field label="Notatki"><Textarea rows={2} value={args.notes ?? ""} onChange={e => set("notes", e.target.value)} /></Field>
      </>
    );
  } else if (name === "send_message") {
    body = (
      <>
        {studentField}
        <Field label="Temat"><Input value={args.subject ?? ""} onChange={e => set("subject", e.target.value)} /></Field>
        <Field label="Treść"><Textarea rows={4} value={args.body ?? ""} onChange={e => set("body", e.target.value)} /></Field>
      </>
    );
  }

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 sm:p-4 space-y-3">
      <div className={cn("flex items-center gap-2 font-semibold text-sm", meta.color)}>
        <Icon className="w-4 h-4" /> {meta.label}
        <span className="text-xs font-normal text-muted-foreground ml-auto">Edytuj i zatwierdź</span>
      </div>
      <div className="space-y-2">{body}</div>
      {status === "ok" && <p className="text-xs text-success font-medium">✓ Zatwierdzono i zapisano</p>}
      {status === "rejected" && <p className="text-xs text-muted-foreground">✗ Odrzucono</p>}
      {!status && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onApprove(args)}><Check className="w-3.5 h-3.5 mr-1" />Zatwierdź</Button>
          <Button size="sm" variant="outline" onClick={onReject}><X className="w-3.5 h-3.5 mr-1" />Odrzuć</Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AIPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Record<string, "ok" | "rejected">>({});
  const [showSidebar, setShowSidebar] = useState(false);
  const [quickCmdOpen, setQuickCmdOpen] = useState<QuickCmd | null>(null);
  const [quickCmdInputs, setQuickCmdInputs] = useState<Record<string, string>>({});
  const send = useServerFn(sendChatMessage);
  const exec = useServerFn(executeAiAction);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: chats = [] } = useQuery({ queryKey: ["ai_chats"], queryFn: async () => (await supabase.from("ai_chats").select("*").order("updated_at", { ascending: false })).data ?? [] });
  const { data: messages = [] } = useQuery({
    queryKey: ["ai_messages", activeId],
    queryFn: async () => activeId ? ((await supabase.from("ai_messages").select("*").eq("chat_id", activeId).order("created_at")).data ?? []) : [],
    enabled: !!activeId,
  });
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("id, first_name, last_name, journal_no").order("sort_order").order("journal_no")).data ?? [] });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("id, name").order("name")).data ?? [] });
  const { data: categories = [] } = useQuery({ queryKey: ["grade_categories"], queryFn: async () => (await supabase.from("grade_categories").select("id, name, weight").order("name")).data ?? [] });

  useEffect(() => { if (!activeId && chats.length > 0) setActiveId(chats[0].id); }, [chats, activeId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setInput(localStorage.getItem(DRAFT_KEY(activeId)) ?? "");
    setImageUrl(localStorage.getItem(IMG_KEY(activeId)) ?? "");
  }, [activeId]);
  useEffect(() => {
    if (typeof window === "undefined" || !activeId) return;
    if (input) localStorage.setItem(DRAFT_KEY(activeId), input); else localStorage.removeItem(DRAFT_KEY(activeId));
  }, [input, activeId]);
  useEffect(() => {
    if (typeof window === "undefined" || !activeId) return;
    if (imageUrl) localStorage.setItem(IMG_KEY(activeId), imageUrl); else localStorage.removeItem(IMG_KEY(activeId));
  }, [imageUrl, activeId]);

  const newChat = async () => {
    const { data } = await supabase.from("ai_chats").insert({ title: "Nowy chat" }).select().single();
    if (data) { setActiveId(data.id); setShowSidebar(false); qc.invalidateQueries({ queryKey: ["ai_chats"] }); }
  };

  const delChat = useMutation({
    mutationFn: async (id: string) => { await supabase.from("ai_chats").delete().eq("id", id); },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["ai_chats"] });
      if (typeof window !== "undefined") { localStorage.removeItem(DRAFT_KEY(id)); localStorage.removeItem(IMG_KEY(id)); }
      if (activeId === id) setActiveId(null);
    },
  });

  const submit = async () => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    const msg = input; const img = imageUrl;
    setInput(""); setImageUrl("");
    if (typeof window !== "undefined") { localStorage.removeItem(DRAFT_KEY(activeId)); localStorage.removeItem(IMG_KEY(activeId)); }
    try {
      await send({ data: { chatId: activeId, userMessage: msg, imageUrl: img || undefined } });
      qc.invalidateQueries({ queryKey: ["ai_messages", activeId] });
      qc.invalidateQueries({ queryKey: ["ai_chats"] });
    } catch (e: any) {
      toast.error(e.message ?? "Błąd AI");
      setInput(msg); setImageUrl(img);
    } finally { setSending(false); inputRef.current?.focus(); }
  };

  const approve = async (key: string, name: string, args: any) => {
    try {
      // Clean empty strings to null for optional fields
      const cleaned = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v === "" ? null : v]));
      await exec({ data: { name: name as any, args: cleaned } });
      setDone(d => ({ ...d, [key]: "ok" }));
      toast.success("Wykonano: " + (ACTION_META[name]?.label ?? name));
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error("Błąd wykonania: " + (e.message ?? "nieznany"));
    }
  };
  const reject = (key: string) => { setDone(d => ({ ...d, [key]: "rejected" })); toast.message("Odrzucono"); };

  const runQuickCmd = (cmd: QuickCmd) => {
    if (cmd.needsInput) {
      setQuickCmdOpen(cmd);
      setQuickCmdInputs(Object.fromEntries(cmd.needsInput.map(f => [f.key, ""])));
    } else {
      sendPrompt(cmd.prompt);
    }
  };

  const submitQuickCmd = () => {
    if (!quickCmdOpen) return;
    let prompt = quickCmdOpen.prompt;
    for (const field of quickCmdOpen.needsInput ?? []) {
      const val = quickCmdInputs[field.key]?.trim();
      if (!val) { toast.error(`Uzupełnij: ${field.label}`); return; }
      prompt = prompt.replace(`{${field.key}}`, val);
    }
    setQuickCmdOpen(null);
    setQuickCmdInputs({});
    sendPrompt(prompt);
  };

  const sendPrompt = (prompt: string) => {
    if (!activeId || sending) return;
    setInput(prompt);
    // Use setTimeout to allow state to update before submit reads it
    setTimeout(async () => {
      setSending(true);
      try {
        await send({ data: { chatId: activeId!, userMessage: prompt, imageUrl: undefined } });
        qc.invalidateQueries({ queryKey: ["ai_messages", activeId!] });
        qc.invalidateQueries({ queryKey: ["ai_chats"] });
      } catch (e: any) {
        toast.error(e.message ?? "Błąd AI");
      } finally { setSending(false); setInput(""); inputRef.current?.focus(); }
    }, 50);
  };

  const Sidebar = (
    <aside className="w-64 border-r border-border bg-card overflow-y-auto p-2 space-y-1 shrink-0">
      <Button onClick={newChat} size="sm" className="w-full mb-2"><Plus className="w-4 h-4 mr-1" />Nowy chat</Button>
      {chats.map(c => (
        <div key={c.id} className={cn("flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer", activeId === c.id ? "bg-secondary" : "hover:bg-muted")}>
          <button onClick={() => { setActiveId(c.id); setShowSidebar(false); }} className="flex-1 text-left truncate">{c.title}</button>
          <button onClick={() => delChat.mutate(c.id)} className="opacity-60 hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
        </div>
      ))}
      {!chats.length && <p className="text-xs text-muted-foreground p-4 text-center">Brak chatów.</p>}
    </aside>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <PageHeader
        title="AI — Asystent nauczyciela"
        description="AI proponuje akcje w formie formularzy. Edytuj i zatwierdź, aby zapisać."
        actions={
          <>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowSidebar(s => !s)}>
              {showSidebar ? "Ukryj chaty" : "Chaty"}
            </Button>
            <Button onClick={newChat} size="sm"><Plus className="w-4 h-4 mr-1" />Nowy</Button>
          </>
        }
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden lg:flex">{Sidebar}</div>
        {showSidebar && <div className="lg:hidden absolute z-20 inset-y-0 left-0 mt-[140px] flex shadow-xl">{Sidebar}</div>}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
            {(messages as any[]).map(m => {
              const { actions, text } = m.role === "assistant" ? parseStored(m.content) : { actions: [], text: m.content };
              return (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[92%] sm:max-w-2xl rounded-2xl px-3 sm:px-4 py-2.5 text-sm whitespace-pre-wrap space-y-2 shadow-sm", m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm")}>
                    {m.image_url && <img src={m.image_url} alt="" className="rounded-lg mb-2 max-w-full sm:max-w-xs" />}
                    {text && <div>{text}</div>}
                    {actions.map((a: any) => {
                      const key = `${m.id}:${a.id}`;
                      return (
                        <ActionForm
                          key={key}
                          name={a.name}
                          initial={a.args}
                          students={students}
                          subjects={subjects}
                          categories={categories}
                          status={done[key]}
                          onApprove={(args) => approve(key, a.name, args)}
                          onReject={() => reject(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {sending && <div className="text-sm text-muted-foreground animate-pulse">AI myśli…</div>}
            {!activeId && <p className="text-center text-muted-foreground text-sm mt-12">Utwórz lub wybierz chat aby zacząć.</p>}
          </div>
          {activeId && (
            <div className="border-t border-border p-3 sm:p-4 space-y-2 bg-card">
              {/* Quick command buttons */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pl-0.5"><Zap className="w-3 h-3" />Szybkie:</span>
                {QUICK_COMMANDS.map(cmd => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => runQuickCmd(cmd)}
                      disabled={sending}
                      className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors shrink-0 border border-transparent hover:border-border", cmd.color, sending && "opacity-50 cursor-not-allowed")}
                    >
                      <Icon className="w-3 h-3" />{cmd.label}
                    </button>
                  );
                })}
              </div>

              {imageUrl && <div className="flex items-center gap-2 text-xs"><ImageIcon className="w-3 h-3" /><span className="truncate flex-1">{imageUrl}</span><button onClick={() => setImageUrl("")} className="text-destructive">usuń</button></div>}
              <div className="flex gap-2">
                <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Napisz wiadomość… np. „Dodaj Janowi Kowalskiemu ocenę 4 z matematyki, waga 2” albo użyj szybkich komend wyżej ↑"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }}}
                  className="resize-none flex-1" rows={2} />
                <div className="flex flex-col gap-1.5">
                  <input type="file" accept="image/*" id="ai-file" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
                    const { error } = await supabase.storage.from("ai-uploads").upload(path, f, { upsert: false });
                    if (error) { toast.error("Upload nieudany: " + error.message); return; }
                    const { data } = supabase.storage.from("ai-uploads").getPublicUrl(path);
                    setImageUrl(data.publicUrl); toast.success("Załączono obraz");
                  }} />
                  <Button size="icon" variant="outline" title="Załącz plik" onClick={() => document.getElementById("ai-file")?.click()}><ImageIcon className="w-4 h-4" /></Button>
                  <Button size="icon" onClick={submit} disabled={!input.trim() || sending}><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick command input modal */}
      <Dialog open={!!quickCmdOpen} onOpenChange={(v) => { if (!v) { setQuickCmdOpen(null); setQuickCmdInputs({}); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {quickCmdOpen && (() => { const Icon = quickCmdOpen.icon; return <Icon className="w-5 h-5" />; })()}
              {quickCmdOpen?.label}
            </DialogTitle>
          </DialogHeader>
          {quickCmdOpen && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{quickCmdOpen.prompt.replace(/\{[^}]+\}/g, "___")}</p>
              {(quickCmdOpen.needsInput ?? []).map(field => (
                <div key={field.key}>
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    value={quickCmdInputs[field.key] ?? ""}
                    onChange={e => setQuickCmdInputs({ ...quickCmdInputs, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    onKeyDown={e => { if (e.key === "Enter") submitQuickCmd(); }}
                    autoFocus
                  />
                </div>
              ))}
              <Button onClick={submitQuickCmd} className="w-full">
                <Zap className="w-4 h-4 mr-1" />Wyślij do AI
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
