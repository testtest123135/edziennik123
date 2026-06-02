export const GRADE_OPTIONS = [
  "1", "1+", "2-", "2", "2+", "3-", "3", "3+",
  "4-", "4", "4+", "5-", "5", "5+", "6-", "6",
] as const;

export type GradeStr = typeof GRADE_OPTIONS[number];

export function gradeToValue(g: string): number | null {
  const m: Record<string, number> = {
    "1": 1, "1+": 1.5,
    "2-": 1.75, "2": 2, "2+": 2.5,
    "3-": 2.75, "3": 3, "3+": 3.5,
    "4-": 3.75, "4": 4, "4+": 4.5,
    "5-": 4.75, "5": 5, "5+": 5.5,
    "6-": 5.75, "6": 6,
  };
  return m[g] ?? null;
}

export function weightedAverage(grades: { grade_value: number | null; weight: number }[]): number | null {
  const valid = grades.filter(g => g.grade_value !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, g) => acc + (g.grade_value! * g.weight), 0);
  const totalW = valid.reduce((acc, g) => acc + g.weight, 0);
  return totalW > 0 ? sum / totalW : null;
}

export const ATTENDANCE_STATUSES = [
  { value: "obecny", label: "Obecny", color: "bg-success text-success-foreground" },
  { value: "nieobecny", label: "Nieobecny", color: "bg-destructive text-destructive-foreground" },
  { value: "spozniony", label: "Spóźniony", color: "bg-warning text-warning-foreground" },
  { value: "usprawiedliwiony", label: "Usprawiedliwiony", color: "bg-accent text-accent-foreground" },
  { value: "zwolniony", label: "Zwolniony", color: "bg-muted text-muted-foreground" },
  { value: "wycieczka", label: "Wycieczka", color: "bg-primary text-primary-foreground" },
  { value: "dzien_wolny", label: "Dzień wolny", color: "bg-secondary text-secondary-foreground" },
] as const;

type PunishmentType = {
  value: string;
  label: string;
  needsExpiry?: boolean;
  needsPayment?: boolean;
  needsDegree?: boolean;
  needsWork?: boolean;
  needsWorkDueDate?: boolean;
  needsHours?: boolean;
  autoExpire?: boolean; // sam się usuwa po expires_at
};

export const PUNISHMENT_TYPES: readonly PunishmentType[] = [
  { value: "pouczenie", label: "1. Pouczenie słowne", needsExpiry: true, autoExpire: true },
  { value: "ostrzezenie_slowne", label: "2. Ostrzeżenie słowne", needsExpiry: true, autoExpire: true },
  { value: "ostrzezenie_pisemne", label: "3. Ostrzeżenie pisemne", needsExpiry: true, autoExpire: true },
  { value: "grzywna", label: "4. Kara grzywny", needsPayment: true },
  { value: "ograniczenie_praw", label: "5. Ograniczenie praw", needsDegree: true, needsExpiry: true },
  { value: "prace_szkolne", label: "6. Prace szkolne", needsWork: true, needsWorkDueDate: true },
  { value: "ograniczenie_wolnosci", label: "7. Ograniczenie wolności", needsDegree: true, needsExpiry: true },
  { value: "areszt", label: "8. Areszt tymczasowy", needsHours: true },
];

export const DAYS_OF_WEEK = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

export function fullName(s?: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!s) return "";
  return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
}

export function attendancePct(rows: { status: string }[]): number {
  if (!rows.length) return 0;
  const present = rows.filter(r => ["obecny", "spozniony", "usprawiedliwiony", "wycieczka"].includes(r.status)).length;
  return Math.round((present / rows.length) * 100);
}
