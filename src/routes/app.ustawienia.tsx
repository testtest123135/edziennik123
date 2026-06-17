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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ustawienia")({ component: SettingsPage });

const LOVABLE_MODELS = [
  { v: "google/gemini-3-flash", l: "Gemini 3 Flash (szybki, Vision)" },
  { v: "google/gemini-3-flash-lite", l: "Gemini 3 Flash Lite (najszybszy)" },
  { v: "google/gemini-2.5-pro", l: "Gemini 2.5 Pro (mocny, Vision)" },
  { v: "openai/gpt-5", l: "GPT-5 (premium)" },
  { v: "openai/gpt-5-mini", l: "GPT-5 Mini" },
];

const GOOGLE_MODELS = [
  { v: "gemini-3.5-flash", l: "Gemini 3.5 Flash (zalecany)" },
  { v: "gemini-3.5-flash-lite", l: "Gemini 3.5 Flash Lite" },
  { v: "gemini-2.5-flash", l: "Gemini 2.5 Flash" },
  { v: "gemini-2.5-pro", l: "Gemini 2.5 Pro" },
  { v: "gemini-2.0-flash", l: "Gemini 2.0 Flash" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).single()).data });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("grade_categories").select("*")).data ?? [] });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await supabase.from("subjects").select("*")).data ?? [] });

  const [catName, setCatName] = useState(""); const [catWeight, setCatWeight] = useState("1");
  const [subjName, setSubjName] = useState("");

  const updateSettings = useMutation({
    mutationFn: async (patch: any) => { const { error } = await supabase.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1); if (error) throw error; },
    onSuccess: () => { toast.success("Zapisano"); qc.invalidateQueries({ queryKey: ["settings"] }); },
  });

  const addCat = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("grade_categories").insert({ name: catName, weight: Number(catWeight) }); if (error) throw error; },
    onSuccess: () => { setCatName(""); setCatWeight("1"); qc.invalidateQueries({ queryKey: ["categories"] }); },
  });
  const delCat = useMutation({ mutationFn: async (id: string) => { await supabase.from("grade_categories").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }) });
  const addSubj = useMutation({ mutationFn: async () => { await supabase.from("subjects").insert({ name: subjName }); }, onSuccess: () => { setSubjName(""); qc.invalidateQueries({ queryKey: ["subjects"] }); }});
  const delSubj = useMutation({ mutationFn: async (id: string) => { await supabase.from("subjects").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }) });

  if (!settings) return <div className="p-8 text-muted-foreground">Ładowanie…</div>;

  return (
    <div>
      <PageHeader title="Ustawienia" description="Konfiguracja systemu, AI, kategorii ocen i przedmiotów." />
      <div className="p-8 space-y-6 max-w-4xl">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Dane szkoły</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Nazwa szkoły</Label><Input defaultValue={settings.school_name ?? ""} onBlur={e => updateSettings.mutate({ school_name: e.target.value })} /></div>
            <div><Label>Imię i nazwisko nauczyciela</Label><Input defaultValue={settings.teacher_name ?? ""} onBlur={e => updateSettings.mutate({ teacher_name: e.target.value })} /></div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-1">Sztuczna inteligencja</h3>
          <p className="text-sm text-muted-foreground mb-4">Lovable AI działa od razu (bez konfiguracji). Możesz też podłączyć Google AI Studio (Gemini).</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dostawca AI</Label>
              <Select value={settings.ai_provider} onValueChange={(v) => updateSettings.mutate({ ai_provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI (domyślny)</SelectItem>
                  <SelectItem value="google">Google AI Studio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model AI</Label>
              {settings.ai_provider === "google" ? (
                <Select value={settings.ai_model || "gemini-3.5-flash"} onValueChange={(v) => updateSettings.mutate({ ai_model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GOOGLE_MODELS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Select value={settings.ai_model} onValueChange={(v) => updateSettings.mutate({ ai_model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOVABLE_MODELS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center gap-3"><Switch checked={settings.ai_vision_enabled ?? true} onCheckedChange={(v) => updateSettings.mutate({ ai_vision_enabled: v })} /><Label>Vision (analiza obrazu)</Label></div>
          </div>
          {settings.ai_provider === "google" && (
            <div className="mt-3 space-y-2">
              <div>
                <Label>Klucz API Google AI Studio</Label>
                <Input
                  type="password"
                  placeholder="Wpisz klucz API..."
                  defaultValue={settings.google_ai_key ?? ""}
                  onBlur={e => updateSettings.mutate({ google_ai_key: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">Pobierz klucz z <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="underline">Google AI Studio</a>. Polecane: <code>gemini-3.5-flash</code>.</p>
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-2 text-sm">Lokalny model GGUF (zaawansowane)</h4>
            <p className="text-xs text-muted-foreground mb-3">Podaj URL własnego endpointu llama.cpp / Ollama dla pełnej prywatności.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nazwa modelu GGUF</Label><Input defaultValue={settings.gguf_model_name ?? ""} onBlur={e => updateSettings.mutate({ gguf_model_name: e.target.value })} placeholder="np. llama-3-8b-instruct.Q4_K_M.gguf" /></div>
              <div><Label>Endpoint GGUF</Label><Input defaultValue={settings.gguf_endpoint ?? ""} onBlur={e => updateSettings.mutate({ gguf_endpoint: e.target.value })} placeholder="http://localhost:8080/v1" /></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Kategorie ocen i wagi</h3>
          <div className="space-y-2 mb-4">
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{c.name}</span>
                <span className="text-muted-foreground">waga: {c.weight}</span>
                <button onClick={() => delCat.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nazwa kategorii" value={catName} onChange={e => setCatName(e.target.value)} />
            <Input type="number" step="0.5" placeholder="Waga" value={catWeight} onChange={e => setCatWeight(e.target.value)} className="w-24" />
            <Button onClick={() => addCat.mutate()} disabled={!catName}><Plus className="w-4 h-4" /></Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Przedmioty</h3>
          <div className="space-y-2 mb-4">
            {subjects.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{s.name}</span>
                <button onClick={() => delSubj.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nazwa przedmiotu" value={subjName} onChange={e => setSubjName(e.target.value)} />
            <Button onClick={() => addSubj.mutate()} disabled={!subjName}><Plus className="w-4 h-4" /></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
