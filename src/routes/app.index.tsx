import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Users, GraduationCap, Heart, CalendarCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, grades, events, today] = await Promise.all([
        supabase.from("students").select("id, behavior_points"),
        supabase.from("grades").select("id"),
        supabase.from("calendar_events").select("id, title, event_date").gte("event_date", new Date().toISOString().slice(0,10)).order("event_date").limit(5),
        supabase.from("attendance").select("id").eq("date", new Date().toISOString().slice(0, 10)),
      ]);
      const avgBehavior = students.data?.length
        ? Math.round(students.data.reduce((a, s) => a + (s.behavior_points || 0), 0) / students.data.length)
        : 0;
      return {
        studentsCount: students.data?.length ?? 0,
        gradesCount: grades.data?.length ?? 0,
        avgBehavior,
        todayAttendance: today.data?.length ?? 0,
        upcoming: events.data ?? [],
      };
    },
  });

  return (
    <div>
      <PageHeader title="Pulpit" description="Witaj w panelu nauczyciela. Oto szybki przegląd." />
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Uczniowie" value={stats?.studentsCount ?? "—"} to="/app/uczniowie" />
          <StatCard icon={GraduationCap} label="Wystawione oceny" value={stats?.gradesCount ?? "—"} to="/app/oceny" />
          <StatCard icon={Heart} label="Średnie zachowanie" value={stats?.avgBehavior ?? "—"} suffix=" pkt" to="/app/zachowanie" />
          <StatCard icon={CalendarCheck} label="Frekwencja dziś" value={stats?.todayAttendance ?? "—"} to="/app/frekwencja" />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Najbliższe wydarzenia</h3>
            {stats?.upcoming?.length ? (
              <ul className="space-y-2">
                {stats.upcoming.map((e: any) => (
                  <li key={e.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span>{e.title}</span>
                    <span className="text-muted-foreground">{e.event_date}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Brak nadchodzących wydarzeń.</p>}
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Szybki dostęp</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/app/oceny" className="text-sm px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80">Dodaj ocenę</Link>
              <Link to="/app/frekwencja" className="text-sm px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80">Sprawdź obecność</Link>
              <Link to="/app/ai" className="text-sm px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Chat z AI</Link>
              <Link to="/app/ogloszenia" className="text-sm px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80">Nowe ogłoszenie</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix = "", to }: any) {
  return (
    <Link to={to}>
      <Card className="p-5 hover:border-accent transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}{suffix}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
