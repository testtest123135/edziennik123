import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Heart, BookOpen,
  Calendar, MessageSquare, Megaphone, Bot, Clock, BookMarked, Activity,
  Gavel, Settings as SettingsIcon, LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "Pulpit" },
  { to: "/app/uczniowie", icon: Users, label: "Uczniowie" },
  { to: "/app/oceny", icon: GraduationCap, label: "Oceny" },
  { to: "/app/frekwencja", icon: CalendarCheck, label: "Frekwencja" },
  { to: "/app/zachowanie", icon: Heart, label: "Zachowanie" },
  { to: "/app/tematy", icon: BookOpen, label: "Tematy zajęć" },
  { to: "/app/kalendarz", icon: Calendar, label: "Kalendarz" },
  { to: "/app/wiadomosci", icon: MessageSquare, label: "Wiadomości" },
  { to: "/app/ogloszenia", icon: Megaphone, label: "Ogłoszenia" },
  { to: "/app/ai", icon: Bot, label: "AI" },
  { to: "/app/plan", icon: Clock, label: "Plan lekcji" },
  { to: "/app/lekcja", icon: BookMarked, label: "Lekcja" },
  { to: "/app/zajecia", icon: Activity, label: "Zajęcia dodatkowe" },
  { to: "/app/kary", icon: Gavel, label: "Kary" },
  { to: "/app/ustawienia", icon: SettingsIcon, label: "Ustawienia" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouterState();
  const navigate = useNavigate();
  const path = router.location.pathname;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="text-lg font-bold tracking-tight">e-Dziennik</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">Panel nauczyciela</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = to === "/app" ? path === "/app" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" /> Wyloguj
        </button>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-card px-8 py-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
