import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ogloszenia")({ component: AnnouncementsPage });

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "wszyscy", pinned: false });
  const { data: items = [] } = useQuery({ queryKey: ["announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false })).data ?? [] });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("announcements").insert(form); if (error) throw error; },
    onSuccess: () => { toast.success("Opublikowano"); qc.invalidateQueries({ queryKey: ["announcements"] }); setOpen(false); setForm({ title: "", body: "", audience: "wszyscy", pinned: false }); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("announcements").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }) });
  return (
    <div>
      <PageHeader title="Ogłoszenia" description="Dla uczniów i rodziców. AI tu nie odpowiada." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Nowe ogłoszenie</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nowe ogłoszenie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tytuł</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div><Label>Adresaci</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({...form, audience: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="wszyscy">Wszyscy</SelectItem><SelectItem value="uczniowie">Uczniowie</SelectItem><SelectItem value="rodzice">Rodzice</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Treść</Label><Textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={5} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.pinned} onCheckedChange={(v) => setForm({...form, pinned: v})} /><Label>Przypnij na górze</Label></div>
              <Button onClick={() => add.mutate()} disabled={!form.title || !form.body} className="w-full">Opublikuj</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-8 space-y-3">
        {(items as any[]).map(a => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {a.pinned && <Pin className="w-3.5 h-3.5 text-accent" />}
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary">{a.audience}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleString("pl")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{a.body}</p>
              </div>
              <button onClick={() => del.mutate(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </Card>
        ))}
        {!items.length && <Card className="p-8 text-center text-muted-foreground">Brak ogłoszeń.</Card>}
      </div>
    </div>
  );
}
