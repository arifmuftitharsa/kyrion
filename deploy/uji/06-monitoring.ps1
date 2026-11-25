# Pasang dan uji log terpusat (Tugas 6). Dijalankan Arif dari PowerShell 5.1, dua fase:
#   .\deploy\uji\06-monitoring.ps1 -Fase siapkan    -> tarik image, digest, Trivy, validasi konfigurasi, bukti waktu
#   .\deploy\uji\06-monitoring.ps1 -Fase jalankan   -> compose up, uji kesehatan dan redaksi email
# Sebelum 'jalankan': isi LOKI_TAG di security\monitoring\versions.env dan pasang overlay journald
# (security\monitoring\compose.logging-journald.yaml) ke app dan nginx; lihat README.md.
# Hasil: security\bukti\06-monitoring-<fase>.txt. ssh meminta passphrase, sudo meminta kata sandi; tidak disimpan.
param([Parameter(Mandatory = $true)][ValidateSet('siapkan', 'jalankan')][string]$Fase)
$ErrorActionPreference = 'Stop'
$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar "security\bukti\06-monitoring-$Fase.txt"
$remote = '/tmp/kyrion-uji-06m'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

& ssh kyrion-staging rm -rf $remote
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\06-monitoring-vm.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp skrip gagal' }
& scp -r (Join-Path $akar 'security\monitoring') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp konfigurasi gagal' }

& ssh -t kyrion-staging sudo bash "$remote/06-monitoring-vm.sh" $Fase
$kode = $LASTEXITCODE
$tmp = Join-Path $env:TEMP "kyrion-06m-$Fase.txt"
& scp "kyrion-staging:$remote/keluaran-$Fase.txt" $tmp
if ($LASTEXITCODE -ne 0) { throw 'scp keluaran gagal' }
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  "# Bukti monitoring, fase $Fase (Tugas 6, R-15)",
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  "# Perintah: .\deploy\uji\06-monitoring.ps1 -Fase $Fase (ssh -t kyrion-staging sudo bash 06-monitoring-vm.sh $Fase)",
  "# Kode keluar: $kode",
  ''
) -join "`n"
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, $kepala + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti"
