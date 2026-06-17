import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  chatId: z.string().uuid(),
  userMessage: z.string().min(1).max(8000),
  imageUrl: z.string().url().optional(),
  fileText: z.string().max(30000).optional(),
  fileName: z.string().max(255).optional(),
});

const SYSTEM_PROMPT = `Jesteś zaawansowanym asystentem AI nauczyciela w polskim e-dzienniku szkolnym. Jesteś ekspertem analityczny — potrafisz analizować dane, wyliczać średnie, prognozować, doradzać. Odpowiadasz po polsku, krótko i konkretnie.

MASZ DWA RODZAJE NARZĘDZI:

1. NARZĘDZIA ZAPISU (wymagają zatwierdzenia przez nauczyciela w UI):
   add_grade, add_attendance, add_behavior, add_punishment, add_lesson_topic, send_message
   Każda akcja wymaga kliknięcia "Zatwierdź" przez nauczyciela. Po wywołaniu napisz krótkie podsumowanie co proponujesz.

2. NARZĘDZIA ODCZYTU (wykonują się automatycznie, wynik wraca do Ciebie):
   student_grades, student_attendance, student_behavior, student_punishments, student_details,
   class_average, missing_grades, improvable_grades, raise_average, class_attendance

   ZAWSZE najpierw użyj narzędzi odczytu aby pobrać aktualne dane ZANIM odpowiesz na pytanie analityczne. NIE zgaduj średnich ani frekwencji — oblicz je z realnych danych. NIE wymyślaj UUID — używaj z kontekstu poniżej.

PRZYKŁADOWE PYTANIA I PODEJŚCIE:
- "Kto nie ma oceny ze sprawdzianu?" → użyj missing_grades(category_name="sprawdzian")
- "Jaką średnią ma klasa z matematyki?" → użyj class_average(subject_name="matematyka")
- "Kto może poprawić ocenę?" → użyj improvable_grades()
- "Jak podnieść Kowalskiemu średnią do 4.5?" → użyj raise_average(student_name="Kowalski", target=4.5)
- "Jak wygląda frekwencja w klasie?" → użyj class_attendance()
- "Podsumuj situation ucznia" → użyj student_grades + student_attendance + student_behavior + student_punishments

Możesz łączyć wiele narzędzi odczytu w jednej odpowiedzi. Zawsze podawaj konkretne liczby i nazwiska.`;

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

// ---- Read-only tool schemas ----
const READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "student_grades",
      description: "Pobiera wszystkie oceny ucznia ze średnią ważoną per przedmiot i ogólną. Zwraca też info o poprawkach.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia (częściowe OK)" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "student_attendance",
      description: "Pobiera statystyki frekwencji ucznia: ogólny %, rozkład statusów, ostatnie nieobecności.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "student_behavior",
      description: "Pobiera punkty zachowania ucznia z historią wpisów.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "student_punishments",
      description: "Pobiera aktywne i historyczne kary ucznia.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "student_details",
      description: "Pobiera dane osobowe ucznia: klasa, rodzice, kontakty, PESEL, uwagi zdrowotne.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia" },
        },
        required: ["student_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "class_average",
      description: "Oblicza średnią ważoną ocen dla całej klasy (lub konkretnego przedmiotu). Zwraca ranking uczniów ze średnimi.",
      parameters: {
        type: "object",
        properties: {
          subject_name: { type: "string", description: "Nazwa przedmiotu (opcjonalnie, bez = wszystkie)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "missing_grades",
      description: "Znajduje uczniów bez oceny z danej kategorii (np. sprawdzian, kartkówka). Zwraca listę braków.",
      parameters: {
        type: "object",
        properties: {
          category_name: { type: "string", description: "Nazwa kategorii np. 'sprawdzian', 'kartkówka'" },
          subject_name: { type: "string", description: "Nazwa przedmiotu (opcjonalnie)" },
        },
        required: ["category_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "improvable_grades",
      description: "Znajduje oceny, które można poprawić (nie mają poprawki i nie są oznaczone 'bez poprawy'). Zwraca listę z propozycjami jak poprawić średnią.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia (opcjonalnie, bez = wszyscy)" },
          subject_name: { type: "string", description: "Nazwa przedmiotu (opcjonalnie)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "raise_average",
      description: "Oblicza jaka ocena (lub zestaw ocen) jest potrzebna aby podnieść średnią ucznia do podanego celu. Zwraca konkretną strategię.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Imię i/lub nazwisko ucznia" },
          target: { type: "number", description: "Docelowa średnia np. 4.5" },
          subject_name: { type: "string", description: "Nazwa przedmiotu (opcjonalnie, bez = ogólna)" },
        },
        required: ["student_name", "target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "class_attendance",
      description: "Oblicza statystyki frekwencji dla całej klasy: ranking uczniów, % obecności, najczęstsze statusy.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

const ALL_TOOLS = [...TOOLS, ...READ_TOOLS];

// ---- Read tool executor ----
const GRADE_MAP: Record<string, number> = {
  "1": 1, "1+": 1.5, "2-": 1.75, "2": 2, "2+": 2.5,
  "3-": 2.75, "3": 3, "3+": 3.5, "4-": 3.75, "4": 4, "4+": 4.5,
  "5-": 4.75, "5": 5, "5+": 5.5, "6-": 5.75, "6": 6,
};

function findStudent(students: any[], name: string): any | null {
  const q = name.toLowerCase().trim();
  let s = students.find(x => `${x.first_name} ${x.last_name}`.toLowerCase() === q);
  if (!s) s = students.find(x => `${x.first_name} ${x.last_name}`.toLowerCase().includes(q));
  if (!s) s = students.find(x => x.last_name.toLowerCase().includes(q) || x.first_name.toLowerCase().includes(q));
  return s ?? null;
}

function findSubject(subjects: any[], name: string): any | null {
  const q = name.toLowerCase().trim();
  return subjects.find(x => x.name.toLowerCase() === q) ?? subjects.find(x => x.name.toLowerCase().includes(q)) ?? null;
}

function findCategory(categories: any[], name: string): any | null {
  const q = name.toLowerCase().trim();
  return categories.find(x => x.name.toLowerCase() === q) ?? categories.find(x => x.name.toLowerCase().includes(q)) ?? null;
}

function calcWeightedAvg(grades: any[]): { avg: number | null; count: number; totalWeight: number } {
  const valid = grades.filter(g => g.grade_value != null || GRADE_MAP[g.grade] != null);
  if (!valid.length) return { avg: null, count: 0, totalWeight: 0 };
  let sum = 0, tw = 0;
  for (const g of valid) {
    const v = g.grade_value ?? GRADE_MAP[g.grade] ?? null;
    if (v == null) continue;
    const w = g.weight ?? 1;
    sum += v * w;
    tw += w;
  }
  return { avg: tw > 0 ? Math.round((sum / tw) * 100) / 100 : null, count: valid.length, totalWeight: tw };
}

async function executeReadTool(supabase: any, name: string, args: any): Promise<string> {
  const [{ data: students }, { data: subjects }, { data: categories }] = await Promise.all([
    supabase.from("students").select("*").order("sort_order").order("journal_no"),
    supabase.from("subjects").select("*").order("name"),
    supabase.from("grade_categories").select("*").order("name"),
  ]);
  const allStudents = students ?? [];
  const allSubjects = subjects ?? [];
  const allCategories = categories ?? [];

  switch (name) {
    case "student_grades": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const { data: grades } = await supabase.from("grades").select("*, subjects(name), grade_categories(name)").eq("student_id", s.id).order("date", { ascending: false });
      const gList = grades ?? [];
      const replacedIds = new Set(gList.filter(g => g.original_grade_id).map(g => g.original_grade_id));
      const active = gList.filter(g => !replacedIds.has(g.id) && !g.is_correction);
      const bySubject = new Map<string, any[]>();
      for (const g of active) {
        const key = g.subjects?.name ?? "Bez przedmiotu";
        const arr = bySubject.get(key) ?? [];
        arr.push(g);
        bySubject.set(key, arr);
      }
      const lines: string[] = [`OCENY: ${s.first_name} ${s.last_name} (klasa ${s.class_name ?? "—"})`];
      let totalSum = 0, totalW = 0;
      for (const [subj, gs] of bySubject) {
        const { avg, count, totalWeight } = calcWeightedAvg(gs);
        if (avg != null) { totalSum += avg * totalWeight; totalW += totalWeight; }
        lines.push(`\n${subj}: średnia ${avg?.toFixed(2) ?? "—"} (${count} ocen, waga łączna ${totalWeight})`);
        for (const g of gs.slice(0, 15))
          lines.push(`  ${g.date} | ${g.grade} (w${g.weight}) ${g.grade_categories?.name ?? ""} ${g.description ?? ""} ${g.no_correction ? "[BEZ POPRAWY]" : ""}`);
        if (gs.length > 15) lines.push(`  ... i ${gs.length - 15} więcej`);
      }
      const overall = totalW > 0 ? (totalSum / totalW).toFixed(2) : "—";
      lines.push(`\nŚREDNIA OGÓLNA: ${overall}`);
      const corrections = gList.filter(g => g.is_correction);
      if (corrections.length) lines.push(`Poprawki: ${corrections.length} ocen poprawionych`);
      return lines.join("\n");
    }

    case "student_attendance": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const { data: att } = await supabase.from("attendance").select("*").eq("student_id", s.id).order("date", { ascending: false });
      const rows = att ?? [];
      const statusCounts: Record<string, number> = {};
      for (const a of rows) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
      const presentStatuses = ["obecny", "spozniony", "spóźniony", "wycieczka"];
      const present = rows.filter(r => presentStatuses.includes(r.status)).length;
      const pct = rows.length ? Math.round((present / rows.length) * 100) : 0;
      const absences = rows.filter(r => ["nieobecny", "usprawiedliwiony"].includes(r.status)).slice(0, 10);
      const lines = [
        `FREKWENCJA: ${s.first_name} ${s.last_name}`,
        `Łącznie wpisów: ${rows.length} | Obecność: ${pct}%`,
        `Rozkład: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      ];
      if (absences.length) {
        lines.push("Ostatnie nieobecności/usprawiedliwienia:");
        for (const a of absences) lines.push(`  ${a.date} — ${a.status}${a.note ? ` (${a.note})` : ""}`);
      }
      return lines.join("\n");
    }

    case "student_behavior": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const { data: beh } = await supabase.from("behavior_entries").select("*").eq("student_id", s.id).order("created_at", { ascending: false });
      const entries = beh ?? [];
      const plus = entries.filter(e => e.points > 0);
      const minus = entries.filter(e => e.points < 0);
      const totalPlus = plus.reduce((a, e) => a + e.points, 0);
      const totalMinus = minus.reduce((a, e) => a + e.points, 0);
      const lines = [
        `ZACHOWANIE: ${s.first_name} ${s.last_name}`,
        `Aktualne saldo: ${s.behavior_points} pkt (start 50)`,
        `Suma plusów: +${totalPlus} (${plus.length} wpisów) | Suma minusów: ${totalMinus} (${minus.length} wpisów)`,
      ];
      lines.push("Ostatnie wpisy:");
      for (const e of entries.slice(0, 15))
        lines.push(`  ${e.date} | ${e.points > 0 ? "+" : ""}${e.points} pkt — ${e.reason ?? "(brak powodu)"}`);
      if (entries.length > 15) lines.push(`  ... i ${entries.length - 15} więcej`);
      return lines.join("\n");
    }

    case "student_punishments": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const { data: pun } = await supabase.from("punishments").select("*").eq("student_id", s.id).order("created_at", { ascending: false });
      const puns = pun ?? [];
      const active = puns.filter(p => {
        if (p.amount && (p.amount_paid ?? 0) >= p.amount) return false;
        if (p.work_hours_required && (p.work_hours_done ?? 0) >= p.work_hours_required) return false;
        if (p.expires_at && new Date(p.expires_at) < new Date()) return false;
        return true;
      });
      const lines = [
        `KARY: ${s.first_name} ${s.last_name}`,
        `Aktywne: ${active.length} | Wszystkie: ${puns.length}`,
      ];
      if (active.length) {
        lines.push("Aktywne kary:");
        for (const p of active)
          lines.push(`  ${p.type} — ${p.reason}${p.amount ? ` (${p.amount} zł, opłacono ${p.amount_paid ?? 0})` : ""}${p.work_hours_required ? ` (praca: ${p.work_hours_done ?? 0}/${p.work_hours_required} h)` : ""}`);
      }
      if (puns.length > active.length) {
        lines.push("Historia wykonanych/wygasłych:");
        for (const p of puns.filter(p => !active.includes(p)).slice(0, 5))
          lines.push(`  ${p.type} — ${p.reason} [zakończona]`);
      }
      return lines.join("\n");
    }

    case "student_details": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const lines = [
        `DANE UCZNIA: ${s.first_name} ${s.last_name}`,
        `Klasa: ${s.class_name ?? "—"} | Nr w dzienniku: ${s.journal_no ?? "—"}`,
        `Data ur.: ${s.date_of_birth ?? "—"} | Płeć: ${s.gender ?? "—"} | PESEL: ${s.pesel ?? "—"}`,
        `Adres: ${s.address ?? "—"}`,
        `Rodzic 1: ${s.parent_name ?? "—"} | kontakt: ${s.parent_contact ?? "—"} | tel: ${s.parent_phone ?? "—"} | email: ${s.parent_email ?? "—"}`,
        `Rodzic 2: ${s.second_parent_name ?? "—"} | kontakt: ${s.second_parent_contact ?? "—"}`,
        `Zdrowie: ${s.health_notes ?? "—"}`,
        `Hobby: ${s.hobbies ?? "—"}`,
        `Notatki: ${s.notes ?? "—"}`,
      ];
      return lines.join("\n");
    }

    case "class_average": {
      const subjectFilter = args.subject_name ? findSubject(allSubjects, args.subject_name) : null;
      if (args.subject_name && !subjectFilter) return `Nie znaleziono przedmiotu "${args.subject_name}"`;
      const subjectId = subjectFilter?.id ?? null;
      const { data: grades } = await supabase.from("grades").select("student_id, grade, grade_value, weight, is_correction, original_grade_id, subjects(name)").is("is_correction", false);
      const gList = (grades ?? []) as any[];
      const replacedIds = new Set(gList.filter(g => g.original_grade_id).map(g => g.original_grade_id));
      const active = gList.filter(g => !replacedIds.has(g.id) && (subjectId ? g.subject_id === subjectId : true));
      const byStudent = new Map<string, { name: string; grades: any[] }>();
      for (const g of active) {
        if (!byStudent.has(g.student_id)) {
          const st = allStudents.find((s: any) => s.id === g.student_id);
          byStudent.set(g.student_id, { name: st ? `${st.first_name} ${st.last_name}` : g.student_id, grades: [] });
        }
        byStudent.get(g.student_id)!.grades.push(g);
      }
      const results: { name: string; avg: number; count: number }[] = [];
      for (const [, v] of byStudent) {
        const { avg, count } = calcWeightedAvg(v.grades);
        if (avg != null) results.push({ name: v.name, avg, count });
      }
      results.sort((a, b) => b.avg - a.avg);
      const classAvg = results.length ? (results.reduce((a, r) => a + r.avg, 0) / results.length).toFixed(2) : "—";
      const lines = [
        `ŚREDNIA KLASY${subjectFilter ? ` Z ${subjectFilter.name.toUpperCase()}` : ""}: ${classAvg}`,
        `Uczniów z ocenami: ${results.length}/${allStudents.length}`,
        "",
        "Ranking uczniów:",
      ];
      for (const r of results) lines.push(`  ${r.name}: ${r.avg.toFixed(2)} (${r.count} ocen)`);
      const noGrades = allStudents.filter((s: any) => !byStudent.has(s.id));
      if (noGrades.length) {
        lines.push(`\nBez ocen: ${noGrades.map((s: any) => `${s.first_name} ${s.last_name}`).join(", ")}`);
      }
      return lines.join("\n");
    }

    case "missing_grades": {
      const catFilter = findCategory(allCategories, args.category_name);
      if (!catFilter) return `Nie znaleziono kategorii "${args.category_name}". Dostępne: ${allCategories.map(c => c.name).join(", ")}`;
      const subjectFilter = args.subject_name ? findSubject(allSubjects, args.subject_name) : null;
      if (args.subject_name && !subjectFilter) return `Nie znaleziono przedmiotu "${args.subject_name}"`;
      const subjectId = subjectFilter?.id ?? null;
      const { data: grades } = await supabase.from("grades").select("student_id").eq("category_id", catFilter.id);
      const studentsWithGrade = new Set((grades ?? []).map((g: any) => g.student_id));
      const targetStudents = subjectId
        ? allStudents // Can't easily filter students by subject; list all missing
        : allStudents;
      const missing = targetStudents.filter((s: any) => !studentsWithGrade.has(s.id));
      if (!missing.length) return `Wszyscy uczniowie mają ocenę z kategorii "${catFilter.name}"${subjectFilter ? ` z ${subjectFilter.name}` : ""}.`;
      const lines = [
        `BRAK OCENY z kategorii "${catFilter.name}"${subjectFilter ? ` (${subjectFilter.name})` : ""}:`,
        `Brakuje ${missing.length} z ${allStudents.length} uczniów`,
        "",
      ];
      for (const s of missing) lines.push(`  ${s.journal_no ?? "?"}. ${s.first_name} ${s.last_name} (klasa ${s.class_name ?? "—"})`);
      return lines.join("\n");
    }

    case "improvable_grades": {
      const studentFilter = args.student_name ? findStudent(allStudents, args.student_name) : null;
      if (args.student_name && !studentFilter) return `Nie znaleziono ucznia "${args.student_name}"`;
      const subjectFilter = args.subject_name ? findSubject(allSubjects, args.subject_name) : null;
      if (args.subject_name && !subjectFilter) return `Nie znaleziono przedmiotu "${args.subject_name}"`;

      let query = supabase.from("grades").select("*, students(first_name, last_name), subjects(name), grade_categories(name)");
      if (studentFilter) query = query.eq("student_id", studentFilter.id);
      const { data: grades } = await query.order("date", { ascending: false });
      const gList = grades ?? [];
      const replacedIds = new Set(gList.filter((g: any) => g.original_grade_id).map((g: any) => g.original_grade_id));
      // Grades that: are original (not corrections), have not been corrected yet, not marked "no_correction"
      const improvable = gList.filter((g: any) =>
        !g.is_correction && !g.no_correction && !replacedIds.has(g.id) &&
        (!subjectFilter || g.subject_id === subjectFilter.id)
      );
      if (!improvable.length) return "Brak ocen do poprawy" + (studentFilter ? ` dla ${studentFilter.first_name} ${studentFilter.last_name}` : "") + ".";

      const lines = ["OCENY DO POPRAWY:"];
      for (const g of improvable.slice(0, 30)) {
        const gv = g.grade_value ?? GRADE_MAP[g.grade] ?? null;
        const currentAvg = gv != null ? gv : "—";
        lines.push(`  ${g.students?.first_name} ${g.students?.last_name} | ${g.subjects?.name ?? "—"} | ${g.grade} (${currentAvg}) w${g.weight} ${g.grade_categories?.name ?? ""} | ${g.date}`);
      }
      if (improvable.length > 30) lines.push(`  ... i ${improvable.length - 30} więcej`);
      return lines.join("\n");
    }

    case "raise_average": {
      const s = findStudent(allStudents, args.student_name);
      if (!s) return `Nie znaleziono ucznia "${args.student_name}"`;
      const target = args.target;
      const subjectFilter = args.subject_name ? findSubject(allSubjects, args.subject_name) : null;

      let query = supabase.from("grades").select("*, subjects(name)").eq("student_id", s.id).is("is_correction", false);
      if (subjectFilter) query = query.eq("subject_id", subjectFilter.id);
      const { data: grades } = await query;
      const gList = grades ?? [];
      const replacedIds = new Set(gList.filter((g: any) => g.original_grade_id).map((g: any) => g.original_grade_id));
      const active = gList.filter((g: any) => !replacedIds.has(g.id));

      const { avg: currentAvg, totalWeight } = calcWeightedAvg(active);
      if (currentAvg == null) return `${s.first_name} ${s.last_name} nie ma ocen${subjectFilter ? ` z ${subjectFilter.name}` : ""}.`;

      const diff = target - currentAvg;
      if (diff <= 0) return `Średnia ${s.first_name} ${s.last_name} to już ${currentAvg.toFixed(2)} — cel ${target} osiągnięty!`;

      const lines = [
        `PODNIESIENIE ŚREDNIEJ: ${s.first_name} ${s.last_name}`,
        `Obecna średnia: ${currentAvg.toFixed(2)} | Cel: ${target} | Brakuje: ${diff.toFixed(2)}`,
        `Łączna waga ocen: ${totalWeight}`,
        "",
      ];

      // Calculate what grade at what weight would raise the average
      // (currentAvg * totalWeight + newGrade * newWeight) / (totalWeight + newWeight) >= target
      // newGrade * newWeight >= target * (totalWeight + newWeight) - currentAvg * totalWeight
      const strategies: string[] = [];
      for (const newWeight of [1, 2, 3]) {
        const needed = target * (totalWeight + newWeight) - currentAvg * totalWeight;
        const neededGrade = needed / newWeight;
        if (neededGrade <= 6) {
          const gradeStr = neededGrade <= 1 ? "1" : neededGrade <= 1.5 ? "1+" : neededGrade <= 2 ? "2" :
            neededGrade <= 2.5 ? "2+" : neededGrade <= 3 ? "3" : neededGrade <= 3.5 ? "3+" :
            neededGrade <= 4 ? "4" : neededGrade <= 4.5 ? "4+" : neededGrade <= 5 ? "5" :
            neededGrade <= 5.5 ? "5+" : "6";
          strategies.push(`Ocena ${gradeStr} (wartość ${neededGrade.toFixed(2)}) z wagą ${newWeight} → nowa średnia ≈ ${target.toFixed(2)}`);
        }
      }
      // Also: two grades
      for (const w1 of [1, 2]) {
        for (const w2 of [1, 2]) {
          const totalW2 = totalWeight + w1 + w2;
          const needed2 = target * totalW2 - currentAvg * totalWeight;
          const perGrade = needed2 / 2;
          if (perGrade <= 6 && perGrade > 0) {
            strategies.push(`Dwie oceny po ${perGrade.toFixed(2)} (wagi ${w1}+${w2}) → średnia ≈ ${target.toFixed(2)}`);
          }
        }
      }

      if (strategies.length) {
        lines.push("Możliwe strategie:");
        for (const st of strategies) lines.push(`  • ${st}`);
      } else {
        lines.push(`Różnica ${diff.toFixed(2)} jest zbyt duża by ją pokryć pojedynczymi ocenami (max 6). Potrzeba wielu wysokich ocen lub zwolnienia niskich.`);
      }

      // Also show which low grades could be improved
      const lowGrades = active.filter((g: any) => {
        const v = g.grade_value ?? GRADE_MAP[g.grade] ?? 0;
        return v < target && !g.no_correction && !replacedIds.has(g.id);
      }).sort((a: any, b: any) => {
        const va = a.grade_value ?? GRADE_MAP[a.grade] ?? 0;
        const vb = b.grade_value ?? GRADE_MAP[b.grade] ?? 0;
        return va - vb;
      });
      if (lowGrades.length) {
        lines.push("\nNajniższe oceny do poprawy:");
        for (const g of lowGrades.slice(0, 8))
          lines.push(`  ${g.grade} (w${g.weight}) z ${g.subjects?.name ?? "—"} — ${g.date}`);
      }

      return lines.join("\n");
    }

    case "class_attendance": {
      const { data: att } = await supabase.from("attendance").select("student_id, status, date").order("date", { ascending: false });
      const rows = att ?? [];
      const byStudent = new Map<string, { name: string; total: number; present: number; absences: number }>();
      for (const a of rows) {
        if (!byStudent.has(a.student_id)) {
          const st = allStudents.find((s: any) => s.id === a.student_id);
          byStudent.set(a.student_id, { name: st ? `${st.first_name} ${st.last_name}` : a.student_id, total: 0, present: 0, absences: 0 });
        }
        const entry = byStudent.get(a.student_id)!;
        entry.total++;
        if (["obecny", "spozniony", "spóźniony", "wycieczka"].includes(a.status)) entry.present++;
        if (["nieobecny"].includes(a.status)) entry.absences++;
      }
      const results: { name: string; pct: number; total: number; absences: number }[] = [];
      for (const [, v] of byStudent) {
        results.push({ name: v.name, pct: v.total ? Math.round((v.present / v.total) * 100) : 0, total: v.total, absences: v.absences });
      }
      results.sort((a, b) => a.pct - b.pct);
      const classPct = results.length ? Math.round(results.reduce((a, r) => a + r.pct, 0) / results.length) : 0;
      const lines = [
        `FREKWENCJA KLASY: średnio ${classPct}%`,
        `Uczniów z danymi: ${results.length}/${allStudents.length}`,
        "",
      ];
      lines.push("Ranking (od najgorszej):");
      for (const r of results) lines.push(`  ${r.name}: ${r.pct}% (${r.total} wpisów, ${r.absences} nieobecności)`);
      const noData = allStudents.filter((s: any) => !byStudent.has(s.id));
      if (noData.length) lines.push(`\nBez danych frekwencji: ${noData.map((s: any) => s.first_name + " " + s.last_name).join(", ")}`);
      return lines.join("\n");
    }

    default:
      return `Nieznane narzędzie odczytu: ${name}`;
  }
}

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

async function callGoogleAI(body: any, apiKey: string) {
  const model = body.model || "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert OpenAI format to Google AI format
  const contents: any[] = [];
  let systemInstruction = "";

  for (const msg of body.messages || []) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
    } else if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: msg.content }] });
    } else if (msg.role === "tool") {
      // Tool results are appended as user messages with the result
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    }
  }

  // Convert tools to Google's format
  const functionDeclarations = (body.tools || [])
    .filter((t: any) => t.type === "function")
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));

  const googleBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  };

  if (systemInstruction) {
    googleBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (functionDeclarations.length > 0) {
    googleBody.tools = [{ functionDeclarations }];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(googleBody),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google AI error ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();

  // Convert Google AI response to OpenAI format
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || "";

  // Handle function calls
  const functionCall = candidate?.content?.parts?.[0]?.functionCall;
  let toolCalls: any[] = [];

  if (functionCall) {
    toolCalls = [{
      id: `call_${crypto.randomUUID?.() || Date.now()}`,
      type: "function",
      function: {
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.args || {}),
      },
    }];
  }

  return {
    choices: [{
      message: {
        content,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
    }],
  };
}

const PROVIDER_MODELS: Record<string, { default: string; options: { v: string; l: string }[] }> = {
  lovable: {
    default: "google/gemini-3-flash",
    options: [
      { v: "google/gemini-3-flash", l: "Gemini 3 Flash (szybki, Vision)" },
      { v: "google/gemini-3-flash-lite", l: "Gemini 3 Flash Lite (najszybszy)" },
      { v: "google/gemini-2.5-pro", l: "Gemini 2.5 Pro (mocny, Vision)" },
      { v: "openai/gpt-5", l: "GPT-5 (premium)" },
      { v: "openai/gpt-5-mini", l: "GPT-5 Mini" },
    ],
  },
  google: {
    default: "gemini-3.5-flash",
    options: [
      { v: "gemini-3.5-flash", l: "Gemini 3.5 Flash (zalecany)" },
      { v: "gemini-3.5-flash-lite", l: "Gemini 3.5 Flash Lite" },
      { v: "gemini-2.5-flash", l: "Gemini 2.5 Flash" },
      { v: "gemini-2.5-pro", l: "Gemini 2.5 Pro" },
      { v: "gemini-2.0-flash", l: "Gemini 2.0 Flash" },
    ],
  },
};

function pickModel(provider: string, raw?: string | null): string {
  const config = PROVIDER_MODELS[provider];
  if (!config) return PROVIDER_MODELS.lovable.default;
  const m = (raw ?? "").trim();
  if (!m || m.startsWith("meta-llama") || m.includes("llama-4") || m.startsWith("llama-")) return config.default;
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
    const googleApiKey = settings?.google_ai_key || process.env.GOOGLE_AI_KEY || process.env.AI;
    const ctxText = await buildContext(supabase);

    const userParts: any[] = [{ type: "text", text: data.userMessage }];
    if (data.fileText) {
      userParts.push({ type: "text", text: `[Załączony plik: ${data.fileName ?? "dokument"}]\n${data.fileText}` });
    }
    if (data.imageUrl) {
      userParts.push({ type: "image_url", image_url: { url: data.imageUrl } });
    }
    const userContent: any = userParts.length === 1 ? userParts[0].text : userParts;

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

    const body: any = { model, messages, tools: ALL_TOOLS, tool_choice: "auto" };
    const READ_TOOL_NAMES = new Set(READ_TOOLS.map(t => t.function.name));

    const callAI = (b: any) => {
      if (provider === "google") {
        if (!googleApiKey) throw new Error("Brak klucza Google AI. Dodaj klucz w Ustawieniach lub skonfiguruj sekret GOOGLE_AI_KEY.");
        return callGoogleAI(b, googleApiKey);
      }
      return callLovableAI(b);
    };

    // Tool-call loop: automatically execute read tools and feed results back
    let loopMessages = [...messages];
    let pendingActions: any[] = [];
    let finalText = "";
    const MAX_ITERATIONS = 6;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const json = await callAI({ ...body, messages: loopMessages });
      const msg = json.choices?.[0]?.message ?? {};
      const text: string = msg.content ?? "";
      const toolCalls = msg.tool_calls ?? [];

      if (!toolCalls.length) {
        finalText = text;
        break;
      }

      // Separate read tools from action tools
      const readCalls: any[] = [];
      const actionCalls: any[] = [];
      for (const tc of toolCalls) {
        if (READ_TOOL_NAMES.has(tc.function?.name)) {
          readCalls.push(tc);
        } else {
          actionCalls.push(tc);
        }
      }

      // Execute read tools and collect results
      if (readCalls.length) {
        const toolResults: any[] = [];
        for (const tc of readCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
          const result = await executeReadTool(supabase, tc.function.name, args);
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        // Add assistant message with tool_calls + tool results to loop
        loopMessages.push({
          role: "assistant",
          content: text || null,
          tool_calls: readCalls.map(tc => ({
            id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });
        for (const tr of toolResults) loopMessages.push(tr);
        // If there were also action calls, collect them but don't loop further for those
        if (actionCalls.length) {
          for (const tc of actionCalls) {
            let args: any = {};
            try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
            pendingActions.push({ id: tc.id ?? crypto.randomUUID(), name: tc.function?.name, args });
          }
          finalText = text;
          break;
        }
        // Continue loop — AI will see read results and generate final response
        continue;
      }

      // Only action tools — collect them, this is the final response
      if (actionCalls.length) {
        for (const tc of actionCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
          pendingActions.push({ id: tc.id ?? crypto.randomUUID(), name: tc.function?.name, args });
        }
        finalText = text;
        break;
      }

      // No tools at all — just text
      finalText = text;
      break;
    }

    if (!finalText && !pendingActions.length) finalText = "(brak odpowiedzi)";

    let stored = finalText || (pendingActions.length ? "Proponuję wykonać poniższe akcje:" : "");
    if (pendingActions.length) {
      stored = `__ACTIONS__${JSON.stringify(pendingActions)}\n${stored}`;
    }

    await supabase.from("ai_messages").insert({
      chat_id: data.chatId, role: "assistant", content: stored || "(brak odpowiedzi)",
    });
    await supabase.from("ai_chats").update({ updated_at: new Date().toISOString() }).eq("id", data.chatId);

    return { reply: finalText, pendingActions };
  });

// ---- Execute approved action ----
const ActionInput = z.object({
  name: z.enum(["add_grade", "add_attendance", "add_behavior", "add_punishment", "add_lesson_topic", "send_message"]),
  args: z.record(z.any()),
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
    const { error } = await (supabase.from(table as any).insert(payload as any));
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

    const TONES = [
      { key: "przychylny", desc: "Życzliwy, wspierający rodzic. Dziękuje za informację, deklaruje współpracę." },
      { key: "neutralny", desc: "Rzeczowy, krótki ton. Potwierdza przyjęcie informacji bez emocji." },
      { key: "zaniepokojony", desc: "Zmartwiony rodzic, prosi o więcej szczegółów i sugeruje spotkanie." },
      { key: "sceptyczny", desc: "Wątpi w wersję nauczyciela, prosi o przedstawienie sytuacji z perspektywy ucznia." },
      { key: "obronny", desc: "Broni dziecka, sugeruje że to nie jego wina lub że nauczyciel przesadza. Grzecznie, ale stanowczo." },
      { key: "roszczeniowy", desc: "Niezadowolony, lekko pretensjonalny. Kwestionuje metody nauczyciela lub ocenianie." },
      { key: "zirytowany", desc: "Wyraźnie zdenerwowany, krótki i ostry ton. Zarzuca nauczycielowi czepialstwo lub niesprawiedliwość. Bez wulgaryzmów." },
      { key: "konfrontacyjny", desc: "Bardzo krytyczny, grozi zgłoszeniem do dyrekcji lub kuratorium. Stanowczy, oskarżycielski. Bez wulgaryzmów i gróźb przemocy." },
      { key: "lekceważący", desc: "Bagatelizuje sprawę, sugeruje że nauczyciel zawraca głowę drobiazgami." },
      { key: "zapracowany", desc: "Krótko, zdawkowo, ma mało czasu. Obieca tylko 'porozmawiać z dzieckiem'." },
      { key: "usprawiedliwiający", desc: "Tłumaczy zachowanie/wyniki dziecka problemami domowymi, zdrowotnymi lub przeciążeniem nauką." },
      { key: "wdzięczny", desc: "Bardzo wdzięczny i ciepły, dziękuje za zaangażowanie nauczyciela." },
    ];
    const tone = TONES[Math.floor(Math.random() * TONES.length)];

    const prompt = `Wcielasz się w rolę rodzica ucznia ${msg.students?.first_name ?? ""} ${msg.students?.last_name ?? ""}. Nauczyciel napisał do Ciebie poniższą wiadomość. Napisz odpowiedź rodzica (2-5 zdań) w tonie: ${tone.key.toUpperCase()}.

CHARAKTERYSTYKA TONU: ${tone.desc}

Pisz naturalnie, po polsku, bez nagłówków i podpisu. Nie każdy rodzic musi być miły — odpowiedź ma brzmieć autentycznie dla wybranego tonu. Nie używaj wulgaryzmów ani gróźb przemocy.

Temat: ${msg.subject ?? "(brak)"}
Wiadomość: ${msg.body}`;

    const json = await callLovableAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `Symulujesz odpowiedź rodzica ucznia w polskim e-dzienniku. Pisz po polsku, naturalnie i zgodnie z określonym tonem emocjonalnym. Rodzice bywają różni — od wdzięcznych po konfrontacyjnych. Aktualny ton: ${tone.key}.` },
        { role: "user", content: prompt },
      ],
    });
    const reply = json.choices?.[0]?.message?.content ?? "(brak odpowiedzi)";
    const finalBody = `[Ton rodzica: ${tone.key}]\n\n${reply}`;

    const { error: insErr } = await supabase.from("messages").insert({
      student_id: msg.student_id,
      direction: "ai_reply",
      subject: msg.subject ? `Re: ${msg.subject}` : null,
      body: finalBody,
      reply_to: msg.id,
    });

    if (insErr) throw new Error("Nie zapisano odpowiedzi: " + insErr.message);
    await supabase.from("messages").update({ ai_replied: true }).eq("id", msg.id);
    return { ok: true, reply };
  });
