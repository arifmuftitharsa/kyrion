# Pasang dan verifikasi rule alert Grafana D-1..D-3 (Tugas 7). Dijalankan Arif dari PowerShell 5.1:
#   .\deploy\uji\09-deteksi-pasang.ps1
# Yang dikirim hanya rules.yaml dan skrip VM. Grafana di VM di-restart. Hasil: security\bukti\09-deteksi-pasang.txt
# (tinjau sebelum di-commit: memuat baris log Grafana). ssh meminta passphrase, sudo meminta kata sandi; tidak disimpan.
$ErrorActionPreference = 'Stop'
$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar 'security\bukti\09-deteksi-pasang.txt'
$remote = '/tmp/kyrion-uji-09'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

& ssh kyrion-staging rm -rf $remote
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\09-deteksi-pasang-vm.sh') `
  (Join-Path $akar 'security\monitoring\grafana\provisioning\alerting\rules.yaml') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp skrip dan rules.yaml gagal' }

& ssh -t kyrion-staging sudo bash "$remote/09-deteksi-pasang-vm.sh"
$kode = $LASTEXITCODE

$tmp = Join-Path $env:TEMP 'kyrion-09-pasang.txt'
$tersalin = $false
foreach ($percobaan in 1..3) {
  & scp "kyrion-staging:$remote/keluaran-pasang.txt" $tmp
  if ($LASTEXITCODE -eq 0) { $tersalin = $true; break }
  Write-Host "scp hasil gagal (percobaan $percobaan dari 3)"
  if ($percobaan -lt 3) { Start-Sleep -Seconds 3 }
}
if (-not $tersalin) {
  # Folder di VM sengaja tidak dihapus agar hasil masih dapat diambil.
  Write-Host 'Salin manual:'
  Write-Host "scp kyrion-staging:$remote/keluaran-pasang.txt `"$tmp`""
  throw 'scp keluaran gagal; bukti belum disimpan'
}
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti pemasangan rule alert deteksi (Tugas 7)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  '# Perintah: .\deploy\uji\09-deteksi-pasang.ps1 (ssh -t kyrion-staging sudo bash 09-deteksi-pasang-vm.sh)',
  "# Kode keluar skrip VM: $kode",
  ''
) -join "`n"
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, $kepala + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti"
