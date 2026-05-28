import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  chatId: z.string().uuid(),
  userMessage: z.string().min(1).max(8000),
  imageUrl: z.string().url().optional(),
});

const SYSTEM_PROMPT = `Jesteś asystentem AI nauczyciela w polskim e-dzienniku szkolnym. Pomagasz w przygotowaniu materiałów, sprawdzaniu prac, ocenie postępów uczniów, formułowaniu uwag i komunikacji z rodzicami. Odpowiadasz po polsku, krótko i konkretnie. Możesz analizować załączone obrazy (np. zdjęcia prac uczniów). Jeśli nauczyciel prosi o sprawdzenie pracy, oceniaj rzeczowo i wskazuj błędy oraz mocne strony.`;

async function callLovableAI(messages: any[], model: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY nie skonfigurowane.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Limit zapytań AI przekroczony. Spróbuj za chwilę.");
    if (res.status === 402) throw new Error("Brak środków AI w portfelu. Doładuj w Ustawieniach.");
    throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGroq(messages: any[], model: string, apiKey: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const provider = settings?.ai_provider ?? "lovable";
    const model = settings?.ai_model ?? "google/gemini-3-flash-preview";

    const userContent: any = data.imageUrl
      ? [
          { type: "text", text: data.userMessage },
          { type: "image_url", image_url: { url: data.imageUrl } },
        ]
      : data.userMessage;

    await supabase.from("ai_messages").insert({
      chat_id: data.chatId, role: "user", content: data.userMessage,
      image_url: data.imageUrl ?? null,
    });

    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content, image_url")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: true })
      .limit(50);

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const m of (history ?? []).slice(0, -1)) {
      messages.push({ role: m.role, content: m.content });
    }
    messages.push({ role: "user", content: userContent });

    let assistantText: string;
    if (provider === "groq") {
      const groqKey = process.env.AI || process.env.GROQ_API_KEY;
      if (!groqKey) throw new Error("Brak klucza AI w sekretach Cloud (oczekiwana nazwa: AI).");
      assistantText = await callGroq(messages, model || "meta-llama/llama-4-scout-17b-16e-instruct", groqKey);
    } else {
      assistantText = await callLovableAI(messages, model);
    }

    await supabase.from("ai_messages").insert({
      chat_id: data.chatId, role: "assistant", content: assistantText,
    });
    await supabase.from("ai_chats").update({ updated_at: new Date().toISOString() }).eq("id", data.chatId);

    return { reply: assistantText };
  });

const ReplyInput = z.object({ messageId: z.string().uuid() });

export const generateParentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReplyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msg } = await supabase.from("messages").select("*, students(first_name, last_name, parent_name)").eq("id", data.messageId).single();
    if (!msg) throw new Error("Wiadomość nie znaleziona");

    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const model = settings?.ai_model ?? "google/gemini-3-flash-preview";

    const prompt = `Wcielasz się w rolę rodzica ucznia ${msg.students?.first_name ?? ""} ${msg.students?.last_name ?? ""}. Nauczyciel napisał do Ciebie poniższą wiadomość. Napisz krótką, naturalną i grzeczną odpowiedź rodzica (2-4 zdania). Bez nagłówków, bez podpisu.

Temat: ${msg.subject ?? "(brak)"}
Wiadomość: ${msg.body}`;

    const reply = await callLovableAI(
      [{ role: "system", content: "Symulujesz odpowiedź rodzica ucznia. Pisz po polsku, krótko i grzecznie." },
       { role: "user", content: prompt }],
      model,
    );

    await supabase.from("messages").insert({
      student_id: msg.student_id,
      direction: "ai_reply",
      subject: msg.subject ? `Re: ${msg.subject}` : null,
      body: reply,
      reply_to: msg.id,
    });
    await supabase.from("messages").update({ ai_replied: true }).eq("id", msg.id);
    return { ok: true };
  });
