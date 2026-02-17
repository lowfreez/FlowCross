param(
    [string]$JavaHome = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sourceFile = Join-Path $scriptDir "GameStatsAgent.java"
$manifestFile = Join-Path $scriptDir "MANIFEST.MF"
$outputJar = Join-Path $scriptDir "GameStatsAgent.jar"
$classFile = Join-Path $scriptDir "GameStatsAgent.class"

if (Test-Path $outputJar) {
    $jarAge = (Get-Item $outputJar).LastWriteTime
    $srcAge = (Get-Item $sourceFile).LastWriteTime
    if ($jarAge -gt $srcAge) {
        Write-Host "JAR is up to date"
        exit 0
    }
}

$javac = $null
$jar = $null

if ($JavaHome -and (Test-Path $JavaHome)) {
    $binDir = if ($JavaHome -match "bin[/\\]?$") { $JavaHome } else { Join-Path $JavaHome "bin" }
    $javacPath = Join-Path $binDir "javac.exe"
    $jarPath = Join-Path $binDir "jar.exe"
    if (Test-Path $javacPath) { $javac = $javacPath }
    if (Test-Path $jarPath) { $jar = $jarPath }
}

if (-not $javac) {
    $javac = Get-Command javac.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    $jar = Get-Command jar.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}

if (-not $javac) {
    $javaHome = $env:JAVA_HOME
    if ($javaHome) {
        $javacPath = Join-Path $javaHome "bin\javac.exe"
        $jarPath = Join-Path $javaHome "bin\jar.exe"
        if (Test-Path $javacPath) { $javac = $javacPath }
        if (Test-Path $jarPath) { $jar = $jarPath }
    }
}

if (-not $javac) {
    Write-Error "javac not found. Set JAVA_HOME or pass -JavaHome parameter."
    exit 1
}

Write-Host "Compiling with: $javac"
& $javac -source 1.8 -target 1.8 $sourceFile -d $scriptDir 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed"
    exit 1
}

Write-Host "Packaging JAR..."
Push-Location $scriptDir
& $jar cfm $outputJar $manifestFile -C $scriptDir .
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Error "JAR packaging failed"
    exit 1
}

if (Test-Path "$scriptDir\com") { Remove-Item "$scriptDir\com" -Recurse -Force }
if (Test-Path "$scriptDir\GameStatsAgent.jar") { Remove-Item "$scriptDir\GameStatsAgent.jar" -Force }

Write-Host "Compiling with: $javac"
& $javac -source 1.8 -target 1.8 $sourceFile -d $scriptDir 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed"
    exit 1
}

Write-Host "Packaging JAR..."
Push-Location $scriptDir
& $jar cfm $outputJar $manifestFile -C $scriptDir com
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Error "JAR packaging failed"
    exit 1
}

if (Test-Path "$scriptDir\com") { Remove-Item "$scriptDir\com" -Recurse -Force }

Write-Host "Built successfully: $outputJar"
exit 0
