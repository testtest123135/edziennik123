import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  chatId: z.string().uuid(),
  userMessage: z.string().min(1).max(8000),
  imageUrl: z.string().url().optional(),
});

const SYSTEM_PROMPT = `Jesteś asystentem AI nauczyciela w polskim e-dzienniku szkolnym. Pomagasz w przygotowaniu materiałów, sprawdzaniu prac, ocenie postępów uczniów, formułowaniu uwag i komunikacji z rodzicami. Odpowiadasz po polsku, krótko i konkretnie.

MOŻESZ wykonywać akcje w dzienniku przez dostępne narzędzia (tools): dodawać oceny, frekwencję, punkty z zachowania, kary, tematy lekcji oraz wiadomości do rodziców. ZAWSZE używaj prawidłowych UUID uczniów i przedmiotów z kontekstu podanego niżej. NIE wymyślaj UUID. Jeśli nie masz potrzebnych danych — zapytaj nauczyciela. Każda akcja wymaga zatwierdzenia przez nauczyciela (klika "Zatwierdź" w UI). Po wywołaniu narzędzia DODATKOWO napisz krótkie naturalne podsumowanie po polsku co proponujesz zrobić.`;

// ---- Tool schemas (OpenAI-compatible) ----
const TOOLS = [
  {
    type: "function",
    function: {
      name: "add_grade",
      description: "Dodaje ocenę uczniowi.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string", description: "UUID ucznia" },
          subject_id: { type: "string", description: "UUID przedmiotu (opcjonalnie)" },
          category_id: { type: "string", description: "UUID kategorii ocen (opcjonalnie)" },
          grade: { type: "string", description: "Ocena np. '4', '4+', '3-', '5'" },
          grade_value: { type: "number", description: "Wartość numeryczna oceny (1-6)" },
          weight: { type: "number", description: "Waga (domyślnie 1)" },
          date: { type: "string", description: "YYYY-MM-DD (domyślnie dziś)" },
          description: { type: "string" },
        },
        required: ["student_id", "grade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_attendance",
      description: "Dodaje wpis frekwencji.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          subject_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          status: { type: "string", enum: ["obecny", "nieobecny", "spóźniony", "zwolniony", "usprawiedliwiony"] },
          note: { type: "string" },
        },
        required: ["student_id", "date", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_behavior",
      description: "Dodaje wpis punktów z zachowania (dodatnie lub ujemne).",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          points: { type: "number", description: "Może być ujemne" },
          reason: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["student_id", "points", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_punishment",
      description: "Dodaje karę uczniowi.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          type: { type: "string", description: "np. 'uwaga', 'grzywna', 'prace społeczne', 'nagana'" },
          reason: { type: "string" },
          details: { type: "string" },
          amount: { type: "number", description: "Kwota grzywny (PLN)" },
          work_hours_required: { type: "number" },
          degree: { type: "number", description: "Stopień kary 1-5" },
        },
        required: ["student_id", "type", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_lesson_topic",
      description: "Dodaje temat lekcji.",
      parameters: {
        type: "object",
        properties: {
          subject_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          topic: { type: "string" },
          notes: { type: "string" },
        },
        required: ["date", "topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Wysyła wiadomość do rodzica ucznia.",
      parameters: {
        type: "object",
        properties: {
          student_id: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["student_id", "body"],
      },
    },
  },
];

async function callLovableAI(body: any) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY nie skonfigurowane w Cloud.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Limit zapytań AI przekroczony. Spróbuj za chwilę.");
    if (res.status === 402) throw new Error("Brak środków AI w portfelu. Doładuj w Ustawieniach.");
    throw new Error(`AI error ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function callGroq(body: any, apiKey: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq error ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

const BROKEN_MODELS = ["meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct"];
function pickModel(provider: string, raw?: string | null): string {
  const m = (raw ?? "").trim();
  if (!m || BROKEN_MODELS.includes(m) || m.includes("llama-4")) {
    return provider === "groq" ? "llama-3.3-70b-versatile" : "google/gemini-3-flash-preview";
  }
  return m;
}

async function buildContext(supabase: any): Promise<string> {
  const [students, subjects, categories] = await Promise.all([
    supabase.from("students").select("id, journal_no, first_name, last_name").order("sort_order").order("journal_no"),
    supabase.from("subjects").select("id, name"),
    supabase.from("grade_categories").select("id, name, weight"),
  ]);
  const lines: string[] = ["\n\n--- KONTEKST DZIENNIKA (użyj tych UUID w narzędziach) ---"];
  lines.push("UCZNIOWIE (nr | imię nazwisko | id):");
  for (const s of students.data ?? []) lines.push(`${s.journal_no ?? "?"} | ${s.first_name} ${s.last_name} | ${s.id}`);
  lines.push("\nPRZEDMIOTY (nazwa | id):");
  for (const s of subjects.data ?? []) lines.push(`${s.name} | ${s.id}`);
  lines.push("\nKATEGORIE OCEN (nazwa | waga | id):");
  for (const c of categories.data ?? []) lines.push(`${c.name} | ${c.weight} | ${c.id}`);
  lines.push(`\nDZIŚ: ${new Date().toISOString().slice(0, 10)}`);
  return lines.join("\n");
}

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const provider = settings?.ai_provider ?? "lovable";
    const model = pickModel(provider, settings?.ai_model);
    const ctxText = await buildContext(supabase);

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

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT + ctxText }];
    for (const m of (history ?? []).slice(0, -1)) {
      // Strip stored action payloads from prior assistant messages
      let c = m.content as string;
      if (m.role === "assistant" && c.startsWith("__ACTIONS__")) {
        const idx = c.indexOf("\n");
        c = idx >= 0 ? c.slice(idx + 1) : "";
      }
      messages.push({ role: m.role, content: c });
    }
    messages.push({ role: "user", content: userContent });

    const body: any = { model, messages, tools: TOOLS, tool_choice: "auto" };

    let json: any;
    if (provider === "groq") {
      const groqKey = process.env.AI || process.env.GROQ_API_KEY;
      if (!groqKey) throw new Error("Brak klucza Groq w sekretach (oczekiwana nazwa: AI).");
      json = await callGroq(body, groqKey);
    } else {
      json = await callLovableAI(body);
    }

    const msg = json.choices?.[0]?.message ?? {};
    const text: string = msg.content ?? "";
    const toolCalls = msg.tool_calls ?? [];

    let stored = text || (toolCalls.length ? "Proponuję wykonać poniższe akcje:" : "");
    let pendingActions: any[] = [];
    if (toolCalls.length) {
      pendingActions = toolCalls.map((tc: any) => {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
        return { id: tc.id ?? crypto.randomUUID(), name: tc.function?.name, args };
      });
      stored = `__ACTIONS__${JSON.stringify(pendingActions)}\n${stored}`;
    }

    await supabase.from("ai_messages").insert({
      chat_id: data.chatId, role: "assistant", content: stored || "(brak odpowiedzi)",
    });
    await supabase.from("ai_chats").update({ updated_at: new Date().toISOString() }).eq("id", data.chatId);

    return { reply: text, pendingActions };
  });

// ---- Execute approved action ----
const ActionInput = z.object({
  name: z.enum(["add_grade", "add_attendance", "add_behavior", "add_punishment", "add_lesson_topic", "send_message"]),
  args: z.record(z.string(), z.any()),
});

export const executeAiAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const a = data.args;
    let table = ""; let payload: any = {};
    switch (data.name) {
      case "add_grade":
        table = "grades";
        payload = {
          student_id: a.student_id, subject_id: a.subject_id ?? null, category_id: a.category_id ?? null,
          grade: String(a.grade), grade_value: a.grade_value ?? null, weight: a.weight ?? 1,
          date: a.date ?? new Date().toISOString().slice(0, 10), description: a.description ?? null,
        };
        break;
      case "add_attendance":
        table = "attendance";
        payload = { student_id: a.student_id, subject_id: a.subject_id ?? null, date: a.date, status: a.status, note: a.note ?? null };
        break;
      case "add_behavior":
        table = "behavior_entries";
        payload = { student_id: a.student_id, points: a.points, reason: a.reason ?? null, date: a.date ?? new Date().toISOString().slice(0, 10) };
        break;
      case "add_punishment":
        table = "punishments";
        payload = {
          student_id: a.student_id, type: a.type, reason: a.reason, details: a.details ?? null,
          amount: a.amount ?? null, work_hours_required: a.work_hours_required ?? null, degree: a.degree ?? null,
        };
        break;
      case "add_lesson_topic":
        table = "lesson_topics";
        payload = { subject_id: a.subject_id ?? null, date: a.date, topic: a.topic, notes: a.notes ?? null };
        break;
      case "send_message":
        table = "messages";
        payload = { student_id: a.student_id, direction: "outgoing", subject: a.subject ?? null, body: a.body };
        break;
    }
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Parent reply (always uses Lovable AI, robust) ----
const ReplyInput = z.object({ messageId: z.string().uuid() });

export const generateParentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReplyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("*, students(first_name, last_name, parent_name)")
      .eq("id", data.messageId)
      .single();
    if (msgErr || !msg) throw new Error("Wiadomość nie znaleziona");

    const prompt = `Wcielasz się w rolę rodzica ucznia ${msg.students?.first_name ?? ""} ${msg.students?.last_name ?? ""}. Nauczyciel napisał do Ciebie poniższą wiadomość. Napisz krótką, naturalną i grzeczną odpowiedź rodzica (2-4 zdania). Bez nagłówków, bez podpisu.

Temat: ${msg.subject ?? "(brak)"}
Wiadomość: ${msg.body}`;

    const json = await callLovableAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Symulujesz odpowiedź rodzica ucznia. Pisz po polsku, krótko i grzecznie." },
        { role: "user", content: prompt },
      ],
    });
    const reply = json.choices?.[0]?.message?.content ?? "(brak odpowiedzi)";

    const { error: insErr } = await supabase.from("messages").insert({
      student_id: msg.student_id,
      direction: "ai_reply",
      subject: msg.subject ? `Re: ${msg.subject}` : null,
      body: reply,
      reply_to: msg.id,
    });
    if (insErr) throw new Error("Nie zapisano odpowiedzi: " + insErr.message);
    await supabase.from("messages").update({ ai_replied: true }).eq("id", msg.id);
    return { ok: true, reply };
  });
