import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Heart, BookOpen,
  Calendar, MessageSquare, Megaphone, Bot, Clock, BookMarked, Activity,
  Gavel, Settings as SettingsIcon, LogOut, Menu, X,
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [path]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const SidebarBody = (
    <>
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">e-Dziennik</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-0.5">Panel nauczyciela</p>
        </div>
        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/50" aria-label="Zamknij menu">
          <X className="w-5 h-5" />
        </button>
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
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 lg:w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border shrink-0">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border animate-in slide-in-from-left">
            {SidebarBody}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Menu">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold tracking-tight">e-Dziennik</h1>
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-card px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h2>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
