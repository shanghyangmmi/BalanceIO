"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Activity,
  ShieldAlert,
  FileText,
  Settings,
  UserPlus,
  LogIn,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

// Mock Data for Audit Logs
const auditLogs = [
  {
    id: "AL-1092",
    action: "Create Invoice",
    details:
      "Created invoice #INV-2024-001 for PT Maju Jaya with total Rp 15,000,000",
    user: { name: "Sam", role: "Admin", initials: "SM" },
    timestamp: new Date("2024-01-28T14:30:00"),
    module: "Sales",
    severity: "normal",
  },
  {
    id: "AL-1091",
    action: "Update Tax Rate",
    details: "Changed PPN Rate from 11% to 12%",
    user: { name: "Maria", role: "Manager", initials: "MR" },
    timestamp: new Date("2024-01-28T11:15:00"),
    module: "Settings",
    severity: "critical",
  },
  {
    id: "AL-1090",
    action: "User Login",
    details: "Successful login from IP 192.168.1.55",
    user: { name: "Sam", role: "Admin", initials: "SM" },
    timestamp: new Date("2024-01-28T09:00:00"),
    module: "Auth",
    severity: "low",
  },
  {
    id: "AL-1089",
    action: "Delete Journal",
    details: "Deleted Draft Journal #DR-005",
    user: { name: "Budi", role: "Accountant", initials: "BD" },
    timestamp: new Date("2024-01-27T16:45:00"),
    module: "Accounting",
    severity: "high",
  },
  {
    id: "AL-1088",
    action: "New Asset",
    details: "Registered new asset: MacBook Pro M3",
    user: { name: "Sam", role: "Admin", initials: "SM" },
    timestamp: new Date("2024-01-27T10:20:00"),
    module: "Assets",
    severity: "normal",
  },
];

const getIcon = (module: string) => {
  switch (module) {
    case "Sales":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "Settings":
      return <Settings className="h-4 w-4 text-orange-500" />;
    case "Auth":
      return <LogIn className="h-4 w-4 text-green-500" />;
    case "Accounting":
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    case "Assets":
      return <Activity className="h-4 w-4 text-purple-500" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

export default function AuditLogPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">Audit Log</h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Recent system activities ordered by time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-8">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex">
                  <div className="flex flex-col items-center mr-4">
                    <div className="h-full w-px bg-zinc-200 dark:bg-zinc-800" />
                    <div className="absolute mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 ring-4 ring-white dark:ring-zinc-950">
                      {getIcon(log.module)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 pt-1 ml-4 border-b border-zinc-100 dark:border-zinc-800 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {log.action}
                        </span>
                        {log.severity === "critical" && (
                          <Badge
                            variant="destructive"
                            className="h-5 text-[10px]"
                          >
                            Critical
                          </Badge>
                        )}
                        {log.severity === "high" && (
                          <Badge
                            variant="destructive"
                            className="bg-orange-500 h-5 text-[10px]"
                          >
                            High
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] text-zinc-500"
                        >
                          {log.module}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(log.timestamp, "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {log.details}
                    </p>
                    <div className="flex items-center pt-2">
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage
                          src={`https://avatar.vercel.sh/${log.user.name}`}
                        />
                        <AvatarFallback>{log.user.initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        By {log.user.name} ({log.user.role})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
