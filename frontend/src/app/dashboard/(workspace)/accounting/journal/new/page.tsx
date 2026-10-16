import { JournalForm } from "@/components/accounting/journal-form";

export default function NewJournalPage() {
  return (
    <div className="flex-1 space-y-0 p-0">
      {/* Header Removed */}

      <div className="bg-card text-card-foreground">
        <JournalForm />
      </div>
    </div>
  );
}
