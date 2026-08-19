# SSH-tunnel til prod-databasen (shared-mariadb) for lokal utvikling.
# Kjor fra prosjektroten i PowerShell:
#   .\db-tunnel.ps1
#
# MariaDB-containerens port 3306 er ikke publisert til host på VPS-en, så vi
# tunneler mot containerens interne IP på Docker-nettverket «app-backend».
# IP-en slås opp automatisk ved hver kjøring (den kan endre seg hvis
# containeren fjernes og opprettes på nytt).
#
# Tunnelen blokkerer terminalen så lenge den lever — avslutt med Ctrl+C.
# Lokal DATABASE_URL skal peke på localhost:<LocalPort>.
#
# Tilsvarer db-tunnel.sh (for Git Bash). Bruker Windows sin innebygde ssh.exe.

param(
  [string]$Remote    = "ragnar@159.195.146.240",
  [string]$Key       = "$env:USERPROFILE\.ssh\legeassist_vps_new",
  [string]$Container = "shared-mariadb",
  [string]$Network   = "app-backend",
  [int]   $LocalPort = 3306
)

$ErrorActionPreference = "Stop"

$iBruk = $false
try {
  $iBruk = [bool](Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction Stop)
} catch {
  $iBruk = $false
}

if ($iBruk) {
  Write-Host "==> Port $LocalPort er allerede i bruk lokalt."
  Write-Host "    Tunnelen kjorer sannsynligvis fra for - avslutt den forst, eller"
  Write-Host "    velg en annen port: .\db-tunnel.ps1 -LocalPort 3307"
  exit 1
}

if (-not (Test-Path $Key)) {
  Write-Host "==> FEIL: fant ingen SSH-nokkel pa $Key"
  Write-Host "    Angi en annen med: .\db-tunnel.ps1 -Key <sti>"
  exit 1
}

# Go-template uten anforselstegn, slik at argumentet overlever bade PowerShell
# og fjernskallet: gir linjer av typen «app-backend=172.19.0.2».
$format = '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'
$fjernKommando = "docker inspect $Container --format '$format'"

Write-Host "==> Slar opp IP for '$Container' pa nettverket '$Network'..."
$svar = & ssh -i $Key -o BatchMode=yes $Remote $fjernKommando

if ($LASTEXITCODE -ne 0) {
  Write-Host "==> FEIL: SSH-kommandoen feilet (exit $LASTEXITCODE)."
  exit 1
}

$containerIp = $null
foreach ($par in ($svar -join " ").Trim() -split "\s+") {
  if ($par -like "$Network=*") { $containerIp = $par.Substring($Network.Length + 1) }
}

if ([string]::IsNullOrWhiteSpace($containerIp)) {
  Write-Host "==> FEIL: fant ingen IP for '$Container' pa '$Network'."
  Write-Host "    Sjekk at containeren kjorer: ssh -i $Key $Remote 'docker ps'"
  exit 1
}

Write-Host "==> Fant $Container pa $containerIp"
Write-Host "==> Apner tunnel: localhost:$LocalPort -> ${containerIp}:3306"
Write-Host "    (Ctrl+C for a avslutte)"
& ssh -i $Key -N -L "$($LocalPort):$($containerIp):3306" $Remote
