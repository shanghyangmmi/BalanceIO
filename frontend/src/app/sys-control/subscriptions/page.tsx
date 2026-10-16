"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    CreditCard,
    Users,
    Database,
    FileText,
    Settings,
    Activity,
    CheckCircle,
    XCircle,
    Save
} from "lucide-react";
import { adminApiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { motion } from "framer-motion";

// --- Types ---
interface Subscription {
    id: string;
    companyName: string;
    companyId: string;
    planName: string;
    status: string;
    startDate: string;
    endDate?: string;
    journalCount: number;
    storageUsedMB: number;
}

interface AuditLog {
    id: string;
    action: string;
    userName: string;
    ipAddress: string;
    device: string;
    operatingSystem: string;
    timestamp: string;
    details: string;
}

interface Plan {
    id: string;
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    maxUsers: number;
    maxCompanies: number;
    maxStorageMB: number;
    maxJournalEntries: number;
    features: string; // JSON string
    isActive: boolean;
    isPopular: boolean;
}

interface SystemSetting {
    key: string;
    value: string;
    description: string;
    dataType: string;
}

// --- Components ---

function SubscriptionsTable({ subscriptions, onSuspend }: { subscriptions: Subscription[], onSuspend: (id: string, currentStatus: string) => void }) {
    return (
        <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Company</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Plan</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Usage (MB)</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Journals</th>
                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {subscriptions.map((sub) => (
                            <tr key={sub.id} className="border-b transition-colors hover:bg-muted/50">
                                <td className="p-4 align-middle font-medium">{sub.companyName}</td>
                                <td className="p-4 align-middle"><Badge variant="outline">{sub.planName}</Badge></td>
                                <td className="p-4 align-middle">
                                    <Badge className={
                                        sub.status === 'Active' ? 'bg-emerald-600' :
                                            sub.status === 'Trial' ? 'bg-blue-600' :
                                                sub.status === 'Suspended' ? 'bg-red-600' : 'bg-zinc-500'
                                    }>{sub.status}</Badge>
                                </td>
                                <td className="p-4 align-middle">{sub.storageUsedMB.toFixed(1)}</td>
                                <td className="p-4 align-middle">{sub.journalCount}</td>
                                <td className="p-4 align-middle">
                                    <Button
                                        size="sm"
                                        variant={sub.status === 'Suspended' ? 'outline' : 'destructive'}
                                        onClick={() => onSuspend(sub.id, sub.status)}
                                    >
                                        {sub.status === 'Suspended' ? 'Activate' : 'Suspend'}
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LogViewer({ logs }: { logs: AuditLog[] }) {
    if (!logs || logs.length === 0) return <div className="p-4 text-center text-muted-foreground">No logs found</div>;

    return (
        <div className="rounded-md border">
            <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b hover:bg-muted/50">
                            <th className="h-12 px-4 font-medium text-muted-foreground">Time</th>
                            <th className="h-12 px-4 font-medium text-muted-foreground">User</th>
                            <th className="h-12 px-4 font-medium text-muted-foreground">Action</th>
                            <th className="h-12 px-4 font-medium text-muted-foreground">Device/IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b hover:bg-muted/50">
                                <td className="p-4">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-4">{log.userName}</td>
                                <td className="p-4"><Badge variant="secondary">{log.action}</Badge></td>
                                <td className="p-4 text-xs text-muted-foreground">
                                    {log.ipAddress}<br />{log.device} {log.operatingSystem}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PlanEditor({ plan, onSave }: { plan: Plan; onSave: (p: Plan) => void }) {
    const [edited, setEdited] = useState(plan);
    const [isDirty, setIsDirty] = useState(false);

    const handleChange = (field: keyof Plan, value: any) => {
        setEdited({ ...edited, [field]: value });
        setIsDirty(true);
    };

    const handleSave = () => {
        onSave(edited);
        setIsDirty(false);
    };

    return (
        <Card className="relative overflow-hidden">
            {plan.isPopular && <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-bl-lg">POPULAR</div>}
            <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Monthly ($)</Label>
                        <Input type="number" value={edited.priceMonthly} onChange={(e) => handleChange('priceMonthly', parseFloat(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Yearly ($)</Label>
                        <Input type="number" value={edited.priceYearly} onChange={(e) => handleChange('priceYearly', parseFloat(e.target.value))} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Max Users</Label>
                    <Input type="number" value={edited.maxUsers} onChange={(e) => handleChange('maxUsers', parseInt(e.target.value))} />
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Database className="h-4 w-4" /> Max Storage (MB)</Label>
                    <Input type="number" value={edited.maxStorageMB} onChange={(e) => handleChange('maxStorageMB', parseInt(e.target.value))} />
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Max Journal Entries</Label>
                    <Input type="number" value={edited.maxJournalEntries} onChange={(e) => handleChange('maxJournalEntries', parseInt(e.target.value))} />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <Label>Active Plan</Label>
                    <Switch checked={edited.isActive} onCheckedChange={(c) => handleChange('isActive', c)} />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSave} disabled={!isDirty} className="w-full" variant={isDirty ? "default" : "outline"}>
                    <Save className="h-4 w-4 mr-2" /> {isDirty ? "Save Changes" : "Saved"}
                </Button>
            </CardFooter>
        </Card>
    );
}

function SettingsEditor({ settings, onUpdate }: { settings: SystemSetting[], onUpdate: (k: string, v: string) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Feature Toggles</CardTitle>
                <CardDescription>Global system configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {settings.map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">{setting.key.replace(/_/g, ' ')}</Label>
                            <p className="text-sm text-muted-foreground">{setting.description}</p>
                        </div>
                        {setting.dataType === 'bool' ? (
                            <Switch
                                checked={setting.value === 'true'}
                                onCheckedChange={(c) => onUpdate(setting.key, String(c))}
                            />
                        ) : (
                            <Input
                                value={setting.value}
                                onChange={(e) => onUpdate(setting.key, e.target.value)}
                                className="w-48"
                            />
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

// --- Main Page ---

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [subsRes, plansRes, settingsRes, logsRes] = await Promise.all([
                adminApiClient.get<any>("/admin/subscriptions"),
                adminApiClient.get<Plan[]>("/admin/plans"),
                adminApiClient.get<SystemSetting[]>("/admin/settings"),
                adminApiClient.get<any>("/admin/audit-logs")
            ]);
            setSubscriptions(subsRes.data);
            setPlans(plansRes);
            setSettings(settingsRes);
            setLogs(logsRes.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Init settings if empty (first run)
        // We use .finally() to ensure we fetch data even if init fails (e.g. migration pending)
        adminApiClient.post("/admin/settings/init", {})
            .catch(err => console.warn("Settings init failed (likely already exists or DB issue):", err))
            .finally(() => fetchData());
    }, []);

    const handleUpdatePlan = async (updated: Plan) => {
        try {
            await adminApiClient.put(`/admin/plans/${updated.id}`, updated);
            toast.success("Plan updated");
            setPlans(plans.map(p => p.id === updated.id ? updated : p));
        } catch (error) {
            toast.error("Failed to update plan");
        }
    };

    const handleUpdateSetting = async (key: string, value: string) => {
        try {
            // Optimistic update
            setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
            await adminApiClient.post("/admin/settings", { key, value });
            toast.success("Setting updated");
        } catch (error) {
            toast.error("Failed to update setting");
            fetchData(); // Revert
        }
    };

    const handleSuspend = async (id: string, currentStatus: string) => {
        if (!confirm(`Are you sure you want to ${currentStatus === 'Suspended' ? 'activate' : 'suspend'} this subscription?`)) return;
        try {
            await adminApiClient.post(`/admin/subscriptions/${id}/suspend`, {});
            toast.success("Subscription status updated");
            fetchData();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const totalRevenue = subscriptions.reduce((acc, sub) => {
        const plan = plans.find(p => p.name === sub.planName);
        return acc + (plan ? plan.priceMonthly : 0);
    }, 0);

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Subscriptions & Billing</h2>
                    <p className="text-muted-foreground">Manage plans, limits, and system capabilities.</p>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="subscriptions">All Subscriptions</TabsTrigger>
                    <TabsTrigger value="plans">Plans & Limits</TabsTrigger>
                    <TabsTrigger value="settings">System Settings</TabsTrigger>
                    <TabsTrigger value="logs">Login History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue (Est)</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{subscriptions.filter(s => s.status === 'Active').length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Databases Created</CardTitle>
                                <Database className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{subscriptions.length}</div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="subscriptions">
                    <SubscriptionsTable subscriptions={subscriptions} onSuspend={handleSuspend} />
                </TabsContent>

                <TabsContent value="plans">
                    <div className="grid gap-6 md:grid-cols-3">
                        {plans.map(plan => (
                            <PlanEditor key={plan.id} plan={plan} onSave={handleUpdatePlan} />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings">
                    <SettingsEditor settings={settings} onUpdate={handleUpdateSetting} />
                </TabsContent>

                <TabsContent value="logs">
                    <LogViewer logs={logs} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
