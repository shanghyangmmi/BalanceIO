"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    Terminal,
    FileCode2,
    Trash2,
    HardDrive,
    Play,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Server,
    Clock
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { siteConfig } from "@/config/site";

interface SqlScript {
    fileName: string;
    size: number;
    lastModified: string;
}

interface OldFile {
    path: string;
    size: number;
    created: string;
}

interface DriveInfo {
    name: string;
    totalGb: number;
    freeGb: number;
    usedGb: number;
    usedPercent: number;
}

interface ServerInfo {
    server: {
        machineName: string;
        os: string;
        runtime: string;
        uptime: string;
    };
    drives: DriveInfo[];
}

function getAdminToken() {
    return localStorage.getItem("adminToken") || "";
}

async function adminFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${siteConfig.api.baseUrl}/admin/system${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAdminToken()}`,
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.details || res.statusText);
    }
    return res.json();
}

export default function ServerActionsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Server Actions</h1>
                <p className="text-muted-foreground">Run SQL scripts, manage disk space, and view server info.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <SqlScriptRunner />
                <div className="space-y-6">
                    <ServerInfoCard />
                    <OldFilesCleaner />
                </div>
            </div>
        </div>
    );
}

// ===================================================================
// SQL SCRIPT RUNNER
// ===================================================================

function SqlScriptRunner() {
    const [scripts, setScripts] = useState<SqlScript[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState<string | null>(null);
    const [confirmScript, setConfirmScript] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

    const fetchScripts = async () => {
        setLoading(true);
        try {
            const data = await adminFetch("/sql-scripts");
            setScripts(data.scripts || []);
        } catch (err: any) {
            toast.error("Failed to load scripts", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    const runScript = async (fileName: string) => {
        setRunning(fileName);
        setConfirmScript(null);
        try {
            const data = await adminFetch("/sql-scripts/run", {
                method: "POST",
                body: JSON.stringify({ fileName }),
            });
            setResults(prev => ({
                ...prev,
                [fileName]: { success: true, message: data.message || `Affected ${data.rowsAffected} rows` }
            }));
            toast.success("Script Executed", { description: `${fileName} — ${data.rowsAffected} rows affected` });
        } catch (err: any) {
            setResults(prev => ({
                ...prev,
                [fileName]: { success: false, message: err.message }
            }));
            toast.error("Script Failed", { description: err.message });
        } finally {
            setRunning(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    return (
        <Card className="lg:row-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileCode2 className="h-5 w-5 text-blue-500" />
                            SQL Script Runner
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Execute SQL migration scripts deployed to the server.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchScripts} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Loading scripts...
                    </div>
                ) : scripts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Terminal className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>No SQL scripts found on the server.</p>
                        <p className="text-xs mt-1">Deploy .sql files to the scripts/ directory.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {scripts.map((script) => (
                            <div
                                key={script.fileName}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <FileCode2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="font-mono text-sm truncate">{script.fileName}</span>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {formatBytes(script.size)}
                                        </Badge>
                                    </div>
                                    {results[script.fileName] && (
                                        <div className={`mt-1 ml-6 text-xs flex items-center gap-1 ${results[script.fileName].success ? "text-green-600" : "text-red-500"}`}>
                                            {results[script.fileName].success
                                                ? <CheckCircle2 className="h-3 w-3" />
                                                : <AlertTriangle className="h-3 w-3" />}
                                            {results[script.fileName].message}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="ml-2 shrink-0"
                                    disabled={running !== null}
                                    onClick={() => setConfirmScript(script.fileName)}
                                >
                                    {running === script.fileName ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Play className="h-3 w-3 mr-1" />
                                            Run
                                        </>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <AlertDialog open={!!confirmScript} onOpenChange={() => setConfirmScript(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Execute SQL Script?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You are about to run <span className="font-mono font-bold text-foreground">{confirmScript}</span> on the production database.
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => confirmScript && runScript(confirmScript)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Execute Script
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}

// ===================================================================
// SERVER INFO
// ===================================================================

function ServerInfoCard() {
    const [info, setInfo] = useState<ServerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const data = await adminFetch("/server-info");
                setInfo(data);
            } catch (err: any) {
                toast.error("Failed to load server info", { description: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground">Loading server info...</span>
                </CardContent>
            </Card>
        );
    }

    if (!info) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Server className="h-5 w-5 text-emerald-500" />
                    Server Info
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Machine:</span>
                        <span className="font-mono">{info.server.machineName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtime:</span>
                        <span className="font-mono text-xs">{info.server.runtime}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Uptime:
                        </span>
                        <span className="font-mono">{info.server.uptime}</span>
                    </div>
                </div>

                <Separator />

                {info.drives.map((drive) => (
                    <div key={drive.name} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                                Drive {drive.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {drive.freeGb} GB free / {drive.totalGb} GB
                            </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${drive.usedPercent > 90
                                    ? "bg-red-500"
                                    : drive.usedPercent > 70
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                style={{ width: `${drive.usedPercent}%` }}
                            />
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                            {drive.usedPercent}% used
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

// ===================================================================
// OLD FILES CLEANER
// ===================================================================

function OldFilesCleaner() {
    const [oldFiles, setOldFiles] = useState<OldFile[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalSizeMb, setTotalSizeMb] = useState(0);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const fetchOldFiles = async () => {
        setLoading(true);
        try {
            const data = await adminFetch("/old-files");
            setOldFiles(data.files || []);
            setTotalCount(data.totalCount || 0);
            setTotalSizeMb(data.totalSizeMb || 0);
        } catch (err: any) {
            toast.error("Failed to scan old files", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOldFiles();
    }, []);

    const cleanFiles = async () => {
        setCleaning(true);
        setShowConfirm(false);
        try {
            const data = await adminFetch("/old-files", { method: "DELETE" });
            toast.success("Cleanup Complete", {
                description: `Deleted ${data.deleted} files, freed ${data.freedMb} MB`
            });
            await fetchOldFiles();
        } catch (err: any) {
            toast.error("Cleanup Failed", { description: err.message });
        } finally {
            setCleaning(false);
        }
    };

    return (
        <Card className={totalCount > 0 ? "border-amber-500/30" : ""}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Trash2 className={`h-5 w-5 ${totalCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                            Deploy Artifacts
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Leftover .old_ files from deployment.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchOldFiles} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Scanning...
                    </div>
                ) : totalCount === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        <p className="text-sm">No leftover files. Disk is clean!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                            <div>
                                <p className="font-semibold text-amber-600">{totalCount} files</p>
                                <p className="text-xs text-muted-foreground">Taking up {totalSizeMb} MB</p>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={cleaning}
                                onClick={() => setShowConfirm(true)}
                            >
                                {cleaning ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-1" />
                                )}
                                Clean All
                            </Button>
                        </div>

                        {oldFiles.length > 0 && (
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {oldFiles.slice(0, 10).map((file, i) => (
                                    <div key={i} className="text-xs font-mono text-muted-foreground truncate px-1">
                                        {file.path}
                                    </div>
                                ))}
                                {oldFiles.length > 10 && (
                                    <div className="text-xs text-muted-foreground px-1">
                                        ...and {oldFiles.length - 10} more files
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete All Deploy Artifacts?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete <span className="font-bold text-foreground">{totalCount} files</span> ({totalSizeMb} MB)
                                of leftover .old_ deployment artifacts. These files are no longer needed.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={cleanFiles} className="bg-red-600 hover:bg-red-700">
                                Yes, Delete All
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
