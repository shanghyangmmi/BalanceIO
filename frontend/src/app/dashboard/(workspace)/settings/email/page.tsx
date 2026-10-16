"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Loader2, Save, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    senderEmail: "",
    senderName: "",
    enableSsl: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.getEmailSettings();
      // Ensure defaults
      setSettings({
        smtpHost: data.smtpHost || "",
        smtpPort: data.smtpPort || 587,
        smtpUsername: data.smtpUsername || "",
        smtpPassword: "", // Don't show existing password
        senderEmail: data.senderEmail || "",
        senderName: data.senderName || "",
        enableSsl: data.enableSsl ?? true
      });
    } catch (error) {
      toast.error("Failed to load email settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.saveEmailSettings(settings);
      toast.success("Email settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.smtpHost || !settings.senderEmail) {
      toast.error("Please configure Host and Sender Email first");
      return;
    }
    setTesting(true);
    try {
      await apiClient.testEmailConnection(settings);
      toast.success("Connection successful! Test email sent.");
    } catch (error: any) {
      toast.error(error.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Email Configuration (SMTP)</h3>
        <p className="text-sm text-muted-foreground">
          Configure the email server used for sending invoices and notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMTP Server Settings</CardTitle>
          <CardDescription>Enter your email provider details (e.g., Gmail, Outlook, AWS SES).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input
                  placeholder="smtp.gmail.com"
                  value={settings.smtpHost}
                  onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  placeholder="587"
                  value={settings.smtpPort}
                  onChange={e => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="user@example.com"
                  value={settings.smtpUsername}
                  onChange={e => setSettings({ ...settings, smtpUsername: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={settings.smtpPassword}
                  onChange={e => setSettings({ ...settings, smtpPassword: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Leave blank to keep existing password</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ssl"
                checked={settings.enableSsl}
                onCheckedChange={(checked) => setSettings({ ...settings, enableSsl: checked as boolean })}
              />
              <Label htmlFor="ssl">Enable SSL/TLS</Label>
            </div>

            <div className="border-t my-4 py-4 space-y-4">
              <h4 className="font-medium text-sm">Sender Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sender Email</Label>
                  <Input
                    type="email"
                    placeholder="billing@yourcompany.com"
                    value={settings.senderEmail}
                    onChange={e => setSettings({ ...settings, senderEmail: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sender Name</Label>
                  <Input
                    placeholder="FidaCount Billing"
                    value={settings.senderName}
                    onChange={e => setSettings({ ...settings, senderName: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing || saving}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
              <Button type="submit" disabled={saving || testing}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
