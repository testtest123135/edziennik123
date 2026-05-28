import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateParentReply } from "@/lib/ai.functions";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Bot, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/wiadomosci")({ component: MessagesPage });

function MessagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", subject: "", body: "" });
  const genReply = useServerFn(generateParentReply);

  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("last_name")).data ?? [] });
  const { data: msgs = [] } = useQuery({ queryKey: ["messages"], queryFn: async () => (await supabase.from("messages").select("*, students(first_name, last_name, parent_name)").order("created_at", { ascending: false }).limit(100)).data ?? [] });

  const send = useMutation({
    mutationFn: async () => {
      const delayMin = 5 + Math.floor(Math.random() * 85);
      const scheduled = new Date(Date.now() + delayMin * 60_000).toISOString();
      const { error } = await supabase.from("messages").insert({ ...form, direction: "outgoing", ai_scheduled_for: scheduled });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Wysłano. AI odpowie w ciągu 5-90 min."); qc.invalidateQueries({ queryKey: ["messages"] }); setOpen(false); setForm({ student_id: "", subject: "", body: "" }); },
  });

  const triggerAI = async (id: string) => {
    try { await genReply({ data: { messageId: id } }); toast.success("Odpowiedź wygenerowana"); qc.invalidateQueries({ queryKey: ["messages"] }); }
    catch (e: any) { toast.error(e.message); }
  };

  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("messages").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }) });

  return (
    <div>
      <PageHeader title="Wiadomości" description="Korespondencja z rodzicami. AI symuluje odpowiedź rodzica (5 min – 1,5 h)." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nowa wiadomość</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Wiadomość do rodzica</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Uczeń</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({...form, student_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name} {s.parent_name && `(${s.parent_name})`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Temat</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>
              <div><Label>Treść</Label><Textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={5} /></div>
              <Button onClick={() => send.mutate()} disabled={!form.student_id || !form.body} className="w-full">Wyślij</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 space-y-3">
        {(msgs as any[]).map(m => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className={`px-2 py-0.5 rounded ${m.direction === "outgoing" ? "bg-primary/10 text-primary" : m.direction === "ai_reply" ? "bg-accent/10 text-accent" : "bg-secondary"}`}>
                    {m.direction === "outgoing" ? "→ Do rodzica" : m.direction === "ai_reply" ? "← AI (rodzic)" : "← Przychodząca"}
                  </span>
                  <span>{new Date(m.created_at).toLocaleString("pl")}</span>
                  <span className="ml-auto">{m.students?.last_name} {m.students?.first_name}</span>
                </div>
                {m.subject && <p className="font-semibold text-sm">{m.subject}</p>}
                <p className="text-sm whitespace-pre-wrap mt-1">{m.body}</p>
              </div>
              <div className="flex flex-col gap-1">
                {m.direction === "outgoing" && !m.ai_replied && (
                  <Button size="sm" variant="outline" onClick={() => triggerAI(m.id)}><Bot className="w-3.5 h-3.5 mr-1" />Wygeneruj odp.</Button>
                )}
                <button onClick={() => del.mutate(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            </div>
          </Card>
        ))}
        {!msgs.length && <Card className="p-8 text-center text-muted-foreground">Brak wiadomości.</Card>}
      </div>
    </div>
  );
}
