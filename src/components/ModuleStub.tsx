import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ModuleStub({ title, description, features }: { title: string; description: string; features: string[] }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="p-8">
        <Card className="p-8 text-center">
          <Construction className="w-12 h-12 mx-auto text-accent mb-3" />
          <h3 className="font-semibold mb-2">Moduł gotowy do rozbudowy</h3>
          <p className="text-sm text-muted-foreground mb-4">Baza danych dla tego modułu jest już utworzona. UI z pełnym CRUD zostanie dodane w kolejnej iteracji.</p>
          <div className="text-left max-w-md mx-auto">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Planowane funkcje:</p>
            <ul className="text-sm space-y-1">
              {features.map((f, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{f}</li>)}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
