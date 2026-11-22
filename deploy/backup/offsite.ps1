# Tarik backup terbaru dari VM ke laptop (offsite = laptop; bukan lokasi fisik terpisah) dan verifikasi checksum.
# Dijalankan di laptop (PowerShell 5.1):  .\deploy\backup\offsite.ps1 -Tujuan D:\kyrion-backup-offsite
# Hanya berkas terenkripsi age dan berkas .sha256 yang berpindah; tidak ada kunci privat age.
# Tujuan harus folder DI LUAR repository ini. Berkas yang sudah ada di Tujuan tidak ditimpa.
param([Parameter(Mandatory = $true)][string]$Tujuan)
$ErrorActionPreference = 'Stop'

# Sama persis dengan akar atau di bawahnya. Kedua jalur diakhiri backslash agar C:\Projects\kyrion-x
# tidak dianggap di dalam C:\Projects\kyrion.
function Test-DalamRepo([string]$Jalur, [string]$Akar) {
  $j = [System.IO.Path]::GetFullPath($Jalur).TrimEnd('\') + '\'
  $a = [System.IO.Path]::GetFullPath($Akar).TrimEnd('\') + '\'
  return $j.StartsWith($a, [System.StringComparison]::OrdinalIgnoreCase)
}

$akarRepo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
# Diperiksa SEBELUM folder dibuat, supaya tujuan terlarang tidak sempat membuat folder di dalam repository.
if (Test-DalamRepo $Tujuan $akarRepo) {
  throw "Tujuan berada di dalam repository ($akarRepo); pilih folder di luar repository"
}
if (-not (Test-Path $Tujuan)) { New-Item -ItemType Directory -Path $Tujuan | Out-Null }
$tujuanAbs = (Resolve-Path $Tujuan).Path

$dirVm = '/srv/kyrion/backup'
$daftar = & ssh kyrion-staging ls -1t $dirVm
if ($LASTEXITCODE -ne 0) { throw 'ssh ls gagal' }
$nama = @($daftar | Where-Object { $_ -like 'kyrion-backup-*.tar.age' }) | Select-Object -First 1
if (-not $nama) { throw 'tidak ada berkas backup di VM' }

$lokal = Join-Path $tujuanAbs $nama
if (Test-Path $lokal) { throw "sudah ada di tujuan, tidak ditimpa: $lokal" }

& scp "kyrion-staging:$dirVm/$nama" "kyrion-staging:$dirVm/$nama.sha256" "$tujuanAbs\"
if ($LASTEXITCODE -ne 0) { throw 'scp gagal' }

$harapan = ((Get-Content (Join-Path $tujuanAbs "$nama.sha256") -TotalCount 1) -split '\s+')[0].ToLower()
$nyata = (Get-FileHash -Algorithm SHA256 $lokal).Hash.ToLower()
Write-Output "Berkas   : $nama"
Write-Output "Tujuan   : $tujuanAbs"
Write-Output "SHA-256 (VM)    : $harapan"
Write-Output "SHA-256 (laptop): $nyata"
if ($harapan -ne $nyata) { throw 'CHECKSUM TIDAK COCOK' }
Write-Output 'LULUS checksum offsite sama dengan checksum di VM'
