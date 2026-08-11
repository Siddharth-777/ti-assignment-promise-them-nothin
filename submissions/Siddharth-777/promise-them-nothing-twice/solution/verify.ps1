$ErrorActionPreference = "Stop"

$Ports = @(3001, 3002, 3003)
$Timeout = 60
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=== RelayAPI Rate Limiter - Verify ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check Docker
Write-Host "[1/5] Checking Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker daemon is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}
Write-Host "       Docker is installed and running."
Write-Host ""

# 2. Generate TLS certificate if absent
Write-Host "[2/5] Ensuring TLS certificate exists..."
if (-not (Test-Path "certs\server.crt") -or -not (Test-Path "certs\server.key")) {
    Push-Location certs
    openssl req -x509 -newkey rsa:2048 -nodes `
      -keyout server.key -out server.crt `
      -days 3650 -subj "/CN=localhost" `
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>$null
    Pop-Location
}
Write-Host "       Certificate ready."
Write-Host ""

# 3. Build and start
Write-Host "[3/5] Running docker compose up --build -d..."
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose up failed." -ForegroundColor Red
    exit 1
}
Write-Host "       Containers started."
Write-Host ""

# 4. Poll health checks
Write-Host "[4/5] Waiting for nodes to respond (timeout: ${Timeout}s)..."
$elapsed = 0
$allReady = $false
while ($elapsed -lt $Timeout) {
    $ready = 0
    foreach ($port in $Ports) {
        try {
            $response = Invoke-WebRequest -Uri "https://localhost:${port}/api/v1/ping" `
                -Headers @{ "X-Customer-Id" = "acme" } `
                -UseBasicParsing -TimeoutSec 3 -SkipCertificateCheck -ErrorAction Stop
            if ($response.StatusCode -eq 200) { $ready++ }
        } catch {}
    }
    if ($ready -eq $Ports.Count) {
        $allReady = $true
        break
    }
    Start-Sleep -Seconds 2
    $elapsed += 2
}

if (-not $allReady) {
    Write-Host "ERROR: Timed out after ${Timeout}s. Status:" -ForegroundColor Red
    foreach ($port in $Ports) {
        try {
            Invoke-WebRequest -Uri "https://localhost:${port}/api/v1/ping" `
                -Headers @{ "X-Customer-Id" = "acme" } `
                -UseBasicParsing -TimeoutSec 3 -SkipCertificateCheck -ErrorAction Stop | Out-Null
            Write-Host "       port ${port}: OK"
        } catch {
            Write-Host "       port ${port}: NOT RESPONDING" -ForegroundColor Red
        }
    }
    exit 1
}
Write-Host "       All nodes responding (${elapsed}s elapsed)."
Write-Host ""

# 5. Run harness
Write-Host "[5/5] Running load harness..."
Write-Host ""
node harness/run.js
$harnessExit = $LASTEXITCODE
Write-Host ""

# 5. Summary
if ($harnessExit -eq 0) {
    Write-Host "=== RESULT: ALL SCENARIOS PASSED ===" -ForegroundColor Green
} else {
    Write-Host "=== RESULT: ONE OR MORE SCENARIOS FAILED ===" -ForegroundColor Red
}
Write-Host ""
Write-Host "Run 'docker compose down' to stop the stack when done."

# 6. Exit with harness code
exit $harnessExit
