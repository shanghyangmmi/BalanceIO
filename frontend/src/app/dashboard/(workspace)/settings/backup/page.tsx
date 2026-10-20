"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Download,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { PageHeading } from "@/components/dashboard/page-heading";

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false);

  const handleBackup = async () => {
    setDownloading(true);
    try {
      await apiClient.downloadBackup();
      toast.success("Backup downloaded successfully");
    } catch (error) {
      toast.error("Failed to download backup");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeading
        eyebrow="Settings"
        title="Data backup"
        lede="Download a complete snapshot of this company's data as JSON. Keep it somewhere you control; UU KUP Pasal 28 requires books to be retained for ten years."
      />

      <Card className="border-emerald-100 dark:border-emerald-900/30">
        <CardHeader>
          <CardTitle className="text-emerald-700 dark:text-emerald-500">
            Export Data
          </CardTitle>
          <CardDescription>
            Download a ZIP file containing JSON exports of Companies, Accounts, Contacts, Products, Invoices, Bills, and Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleBackup}
            disabled={downloading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Backup (.zip)
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-100 dark:border-amber-900/30">
        <CardHeader>
          <CardTitle className="text-amber-700 dark:text-amber-500">
            Restore Data
          </CardTitle>
          <CardDescription>
            The restore functionality is currently handled by the system administrator manually for security reasons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              To restore data from a backup, please contact the support team with your backup file.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
