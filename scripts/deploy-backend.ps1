# Deploy the PocketBase backend for the current commit.
#
#   ./scripts/deploy-backend.ps1 -Env staging -DryRun
#   ./scripts/deploy-backend.ps1 -Env staging
#   ./scripts/deploy-backend.ps1 -Env prod -Restart
#
# /opt/risev (prod) and /opt/risev-staging are not git repositories, so this
# copies the files from the working tree. Commit first: the script refuses a
# dirty tree unless -AllowDirty is passed, so what is deployed always matches a
# commit that can be reconstructed with `git show <sha>:pb_hooks/<file>`.

param(
    [Parameter(Mandatory = $true)][ValidateSet('staging', 'prod')][string]$Env,
    [string]$HostName = '166.88.35.57',
    [string]$User = 'root',
    [string]$IdentityFile = (Join-Path $HOME '.ssh\risev_deploy'),
    [switch]$DryRun,
    [switch]$AllowDirty,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$remoteDir = if ($Env -eq 'prod') { '/opt/risev' } else { '/opt/risev-staging' }
$container = if ($Env -eq 'prod') { 'risev-pocketbase' } else { 'risev-pocketbase-staging' }
$sshTarget = "$User@$HostName"

function Invoke-Remote([string]$command) {
    if ($DryRun) { Write-Host "[dry-run] ssh $sshTarget `"$command`""; return }
    & ssh -i $IdentityFile -o BatchMode=yes -o StrictHostKeyChecking=accept-new $sshTarget $command
    if ($LASTEXITCODE -ne 0) { throw "Remote command failed ($LASTEXITCODE): $command" }
}

$dirty = (& git status --porcelain) | Where-Object { $_ -match '^\s*[MADRCU]' }
if ($dirty -and -not $AllowDirty) {
    throw "Working tree has uncommitted changes. Commit them, or pass -AllowDirty (the checkout will no longer match what is deployed)."
}

$sha = (& git rev-parse --short HEAD).Trim()
Write-Host "Deploying $sha to $Env ($remoteDir)"

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Invoke-Remote "mkdir -p $remoteDir/pb_hooks $remoteDir/pb_migrations"
Invoke-Remote "tar czf /root/risev-$Env-backup-$stamp.tgz -C $remoteDir pb_hooks pb_migrations 2>/dev/null || true"

# PocketBase watches pb_hooks and restarts on every changed file, so copying a
# whole directory into a running container means dozens of restarts. Stop it
# first, copy, then start once (which also applies any new migrations).
if ($Restart -and -not $DryRun) {
    Write-Host "  stopping $container"
    Invoke-Remote "docker stop $container >/dev/null 2>&1 || true"
}

try {
    foreach ($dir in @('pb_hooks', 'pb_migrations')) {
        $files = Get-ChildItem -Path (Join-Path $repo $dir) -File | Where-Object { $_.Extension -in '.js', '.json' }
        if ($files.Count -eq 0) { throw "No files found in $dir" }
        Write-Host "  $dir : $($files.Count) file(s)"
        foreach ($file in $files) {
            if ($DryRun) {
                Write-Host "[dry-run] scp $($file.Name) -> ${sshTarget}:$remoteDir/$dir/"
                continue
            }
            & scp -q -i $IdentityFile -o BatchMode=yes -o StrictHostKeyChecking=accept-new $file.FullName "${sshTarget}:$remoteDir/$dir/"
            if ($LASTEXITCODE -ne 0) { throw "Failed to copy $($file.Name)" }
        }
    }
} finally {
    if ($Restart -and -not $DryRun) {
        Write-Host "  starting $container"
        Invoke-Remote "docker start $container >/dev/null"
    }
}

if ($Restart -and -not $DryRun) {
    Start-Sleep -Seconds 6
    Invoke-Remote "docker logs --since 60s $container 2>&1 | grep -E '\[MIGRATION|ERROR|Server started' | tail -20"
    Invoke-Remote "docker exec $container wget -qO- http://127.0.0.1:8090/api/health || echo 'health check failed'"
} else {
    Write-Host 'Files copied. PocketBase hot-reloads hooks; pass -Restart to apply migrations and restart.'
}

Write-Host "Done ($sha -> $Env)."
