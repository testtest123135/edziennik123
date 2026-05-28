import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ATTENDANCE_STATUSES } from "@/lib/grade-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/frekwencja")({ component: AttendancePage });

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await supabase.from("students").select("*").order("last_name")).data ?? [] });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("date", date)).data ?? [],
  });

  const set = useMutation({
    mutationFn: async ({ student_id, status }: { student_id: string; status: string }) => {
      const existing = attendance.find((a: any) => a.student_id === student_id);
      if (existing) {
        const { error } = await supabase.from("attendance").update({ status }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert({ student_id, status, date, subject_id: null });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", date] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Frekwencja" description="Sprawdź obecność konkretnego dnia." actions={
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
      } />
      <div className="p-8">
        <Card className="p-4 space-y-2">
          {students.map(s => {
            const cur = (attendance as any[]).find(a => a.student_id === s.id)?.status ?? "";
            return (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-48 font-medium text-sm">{s.last_name} {s.first_name}</div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {ATTENDANCE_STATUSES.map(st => (
                    <Button key={st.value} size="sm" variant={cur === st.value ? "default" : "outline"}
                      className={cn("text-xs", cur === st.value && st.color)}
                      onClick={() => set.mutate({ student_id: s.id, status: st.value })}>
                      {st.label}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {!students.length && <p className="p-6 text-center text-muted-foreground text-sm">Dodaj najpierw uczniów w module "Uczniowie".</p>}
        </Card>
      </div>
    </div>
  );
}
