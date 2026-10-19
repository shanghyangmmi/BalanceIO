# deploy.ps1
# Usage: ./deploy.ps1 -SourcePath "D:\Actions-Runner\_work\BalanceIO\BalanceIO"
# Rollback: Re-run a previous successful GitHub Actions workflow run.

param (
    [string]$SourcePath = "."
)

$ErrorActionPreference = "Stop"
$WWWRoot = "C:\inetpub\wwwroot\BalanceIO"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "Starting Deployment..."

# 1. Stop App via App_Offline.htm (No IIS Admin Privileges Required)
Write-Host "Stopping App via App_Offline.htm..."
$AppOfflineContent = "<html><head><title>Updating</title></head><body><h1>System Updating...</h1></body></html>"
$AppOfflinePath = "$WWWRoot\api\app_offline.htm"
if (Test-Path "$WWWRoot\api") {
    Set-Content -Path $AppOfflinePath -Value $AppOfflineContent
}

# Wait for ASP.NET Core to detect the file and release locks
Write-Host "Waiting 15 seconds for shutdown..."
Start-Sleep -Seconds 15
    
try {
    # 2. Copy Backend Files (With Retry Logic)
    Write-Host "Deploying Backend..."

    # --- CRITICAL: PREVENT OVERWRITE OF PRODUCTION SECRETS ---
    $ProdConfigDest = "$WWWRoot\api\appsettings.Production.json"
    $ProdConfigSource = "$SourcePath\publish\api\appsettings.Production.json"

    if (Test-Path $ProdConfigDest) {
        Write-Host "Found existing appsettings.Production.json on server. Preserving it."
        if (Test-Path $ProdConfigSource) {
            Remove-Item -Path $ProdConfigSource -Force
            Write-Host "Removed placeholder config from deployment source to prevent overwrite."
        }
    }

    # Copy SQL scripts to server for easy execution
    $ScriptsDir = "$WWWRoot\scripts"
    if (!(Test-Path $ScriptsDir)) { New-Item -ItemType Directory -Path $ScriptsDir }
    if (Test-Path "$SourcePath\scripts\*.sql") {
        Copy-Item -Path "$SourcePath\scripts\*.sql" -Destination $ScriptsDir -Force
        Write-Host "Copied SQL scripts to $ScriptsDir"
    }
    if (Test-Path "$SourcePath\scripts\*.exe") {
        Copy-Item -Path "$SourcePath\scripts\*.exe" -Destination $ScriptsDir -Force
        Write-Host "Copied Executables to $ScriptsDir"
    }
    # ---------------------------------------------------------
    $MaxRetries = 5
    $RetryCount = 0
    $BackendDeployed = $false

    while (-not $BackendDeployed -and $RetryCount -lt $MaxRetries) {
        try {
            Copy-Item -Path "$SourcePath\publish\api\*" -Destination "$WWWRoot\api" -Recurse -Force -ErrorAction Stop
            $BackendDeployed = $true
            Write-Host "Backend Deployed Successfully."
        }
        catch {
            $RetryCount++
            Write-Warning "Attempt $RetryCount failed: $_."
            
            # --- NUCLEAR RENAME STRATEGY ---
            Write-Warning "Bulk copy failed. Attempting to rename ALL existing binaries to bypass locks..."
            
            try {
                $DestFiles = Get-ChildItem -Path "$WWWRoot\api" -Include *.dll, *.pdb, *.exe -Recurse -ErrorAction SilentlyContinue
                foreach ($File in $DestFiles) {
                    try {
                        if ($File.Extension -notmatch ".old_") {
                            $OldName = $File.FullName + ".old_$Timestamp"
                            Move-Item -LiteralPath $File.FullName -Destination $OldName -Force -ErrorAction SilentlyContinue
                        }
                    }
                    catch { }
                }
                Write-Host "Binaries renamed. Retrying copy..."
            }
            catch {
                Write-Warning "Error during nuclear rename: $_"
            }
            # ----------------------------------

            Write-Warning "Retrying in 5 seconds..."
            Start-Sleep -Seconds 5
        }
    }

    if (-not $BackendDeployed) {
        throw "Failed to deploy Backend after $MaxRetries attempts. Files are locked."
    }

    # 3. Copy Frontend Files
    Write-Host "Deploying Frontend..."
    Copy-Item -Path "$SourcePath\publish\client\*" -Destination "$WWWRoot\client" -Recurse -Force

    Write-Host "Deployment Files Copied."

    # 4. Grant Permissions for Restart Feature
    Write-Host "Configuring permissions for Restart feature..."
    $TriggerFile = "$WWWRoot\api\restart.trigger"
    if (Test-Path "$WWWRoot\api") {
        try {
            if (!(Test-Path $TriggerFile)) { New-Item -Path $TriggerFile -ItemType File -Force }
            icacls "$WWWRoot\api" /grant "IIS_IUSRS:(OI)(CI)M" /T
            Write-Host "Granted Modify access to IIS_IUSRS on API folder."
        }
        catch {
            Write-Warning "Failed to set permissions: $_"
        }
    }

    # 5. Create Helper Script for Manual Migration
    $MigrationScriptPath = "$ScriptsDir\run_migration.bat"
    $MigrationContent = "@echo off`r`n" +
    "echo [INFO] Running Database Migration for Production Environment...`r`n" +
    "set ASPNETCORE_ENVIRONMENT=Production`r`n" +
    "cd /d ""$WWWRoot\api""`r`n" +
    "..\scripts\efbundle.exe`r`n" +
    "if %errorlevel% neq 0 (`r`n" +
    "    echo [ERROR] Migration Failed!`r`n" +
    ") else (`r`n" +
    "    echo [SUCCESS] Database Up to Date.`r`n" +
    ")`r`n" +
    "pause"
    Set-Content -Path $MigrationScriptPath -Value $MigrationContent
    Write-Host "Created migration helper script: $MigrationScriptPath"

}
catch {
    Write-Error "Deployment Failed! Error: $_"
}
finally {
    # 5. Remove App_Offline.htm to Start App
    Write-Host "Starting App..."
    if (Test-Path $AppOfflinePath) {
        Remove-Item -Path $AppOfflinePath -Force
    }
    Write-Host "Deployment Complete."
}
