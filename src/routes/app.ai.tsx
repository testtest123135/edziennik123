import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/ai.functions";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ai")({ component: AIPage });

function AIPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendChatMessage);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: chats = [] } = useQuery({ queryKey: ["ai_chats"], queryFn: async () => (await supabase.from("ai_chats").select("*").order("updated_at", { ascending: false })).data ?? [] });
  const { data: messages = [] } = useQuery({
    queryKey: ["ai_messages", activeId],
    queryFn: async () => activeId ? ((await supabase.from("ai_messages").select("*").eq("chat_id", activeId).order("created_at")).data ?? []) : [],
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId && chats.length > 0) setActiveId(chats[0].id);
  }, [chats, activeId]);

  const newChat = async () => {
    const { data } = await supabase.from("ai_chats").insert({ title: "Nowy chat" }).select().single();
    if (data) { setActiveId(data.id); qc.invalidateQueries({ queryKey: ["ai_chats"] }); }
  };

  const delChat = useMutation({
    mutationFn: async (id: string) => { await supabase.from("ai_chats").delete().eq("id", id); },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["ai_chats"] });
      if (activeId === id) setActiveId(null);
    },
  });

  const submit = async () => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    const msg = input; const img = imageUrl;
    setInput(""); setImageUrl("");
    try {
      await send({ data: { chatId: activeId, userMessage: msg, imageUrl: img || undefined } });
      qc.invalidateQueries({ queryKey: ["ai_messages", activeId] });
      qc.invalidateQueries({ queryKey: ["ai_chats"] });
    } catch (e: any) {
      toast.error(e.message ?? "Błąd AI");
    } finally { setSending(false); inputRef.current?.focus(); }
  };

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="AI — Asystent nauczyciela" description="Chat z pamięcią. Załączaj obrazy do analizy (Vision)." actions={
        <Button onClick={newChat}><Plus className="w-4 h-4 mr-1" />Nowy chat</Button>
      } />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-border bg-card overflow-y-auto p-2 space-y-1">
          {chats.map(c => (
            <div key={c.id} className={cn("flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer", activeId === c.id ? "bg-secondary" : "hover:bg-muted")}>
              <button onClick={() => setActiveId(c.id)} className="flex-1 text-left truncate">{c.title}</button>
              <button onClick={() => delChat.mutate(c.id)} className="opacity-60 hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          ))}
          {!chats.length && <p className="text-xs text-muted-foreground p-4 text-center">Brak chatów. Utwórz nowy.</p>}
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(messages as any[]).map(m => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-2xl rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
                  {m.image_url && <img src={m.image_url} alt="" className="rounded mb-2 max-w-xs" />}
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-sm text-muted-foreground animate-pulse">AI myśli…</div>}
            {!activeId && <p className="text-center text-muted-foreground text-sm mt-12">Utwórz lub wybierz chat aby zacząć.</p>}
          </div>
          {activeId && (
            <div className="border-t border-border p-4 space-y-2">
              {imageUrl && <div className="flex items-center gap-2 text-xs"><ImageIcon className="w-3 h-3" /><span className="truncate flex-1">{imageUrl}</span><button onClick={() => setImageUrl("")} className="text-destructive">usuń</button></div>}
              <div className="flex gap-2">
                <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Napisz wiadomość… (Shift+Enter = nowa linia)"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }}}
                  className="resize-none" rows={2} />
                <div className="flex flex-col gap-2">
                  <Button size="icon" variant="outline" onClick={() => { const u = prompt("URL obrazu (Vision):"); if (u) setImageUrl(u); }}><ImageIcon className="w-4 h-4" /></Button>
                  <Button size="icon" onClick={submit} disabled={!input.trim() || sending}><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
