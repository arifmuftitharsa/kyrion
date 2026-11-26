# Simulasi serangan dan kasus benign D-1..D-3 beserta pemantau status alert Grafana (Tugas 7). PowerShell 5.1:
#   .\deploy\uji\10-deteksi-simulasi.ps1 -Skenario D-1 -Mode serangan
# Urutan: pemantau "awal" di VM, lalu lintas dari laptop ke VM sendiri, pemantau "pantau" di VM, ambil bukti.
# Hasil: security\bukti\10-simulasi-<skenario>-<mode>.txt. ssh meminta passphrase, sudo meminta kata sandi
# (masing-masing dapat diminta lebih dari sekali); tidak disimpan. Aturan menjalankan: lihat $catatan di bawah.
param(
  [Parameter(Mandatory = $true)][ValidateSet('D-1', 'D-2', 'D-3')][string]$Skenario,
  [Parameter(Mandatory = $true)][ValidateSet('serangan', 'benign')][string]$Mode
)
$ErrorActionPreference = 'Stop'
$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar "security\bukti\10-simulasi-$Skenario-$Mode.txt"
$remote = '/tmp/kyrion-uji-10'
$skripVm = "$remote/10-deteksi-simulasi-vm.sh"
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
. (Join-Path $akar 'security\detection\simulasi.ps1')
if (-not (Test-Path $SimulasiCa)) { throw "Sertifikat CA tidak ada: $SimulasiCa" }
$hash = (& git -C $akar rev-parse --short HEAD).Trim()

$catatan = @(
  'Catatan menjalankan:',
  '- Jalankan satu skenario per waktu; jarak antar run minimal 6 menit.',
  '- D-3 juga butuh bucket log UFW penuh: jeda minimal 4 menit sejak lalu lintas UFW terakhir.',
  '- Lalu lintas D-1 membuat IP laptop terkena pembatas nginx pada endpoint OTP sekitar satu menit.'
)

# Mengambil satu berkas hasil dari VM, paling banyak 3 kali dengan jeda 3 detik.
function Copy-HasilVm([string]$Nama, [string]$Tujuan) {
  foreach ($percobaan in 1..3) {
    & scp "kyrion-staging:$remote/$Nama" $Tujuan | Out-Host
    if ($LASTEXITCODE -eq 0) { return $true }
    Write-Host "scp $Nama gagal (percobaan $percobaan dari 3)"
    if ($percobaan -lt 3) { Start-Sleep -Seconds 3 }
  }
  $false
}

$catatan | ForEach-Object { Write-Host $_ }
& ssh kyrion-staging rm -rf $remote
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\uji\10-deteksi-simulasi-vm.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp skrip gagal' }

& ssh -t kyrion-staging sudo bash $skripVm awal
$kodeAwal = $LASTEXITCODE
# Tanpa keadaan awal, hasil pantauan tidak dapat ditafsirkan: lalu lintas tidak dikirim.
if ($kodeAwal -ne 0) { throw "pemantau awal gagal (kode $kodeAwal); lalu lintas TIDAK dikirim" }

Write-Host "Lalu lintas $Skenario $Mode dari laptop..."
$laptop = @(Invoke-SimulasiLaluLintas -Skenario $Skenario -Mode $Mode | ForEach-Object { Write-Host $_; $_ })
# Disimpan segera: bila langkah VM atau scp gagal, catatan lalu lintas tidak hilang.
$tmpLaptop = Join-Path $env:TEMP "kyrion-10-$Skenario-$Mode-laptop.txt"
[System.IO.File]::WriteAllText($tmpLaptop, ($laptop -join "`n"), (New-Object System.Text.UTF8Encoding($false)))

& ssh -t kyrion-staging sudo bash $skripVm pantau $Skenario $Mode
$kodePantau = $LASTEXITCODE

$tmpAwal = Join-Path $env:TEMP 'kyrion-10-awal.txt'
$tmpPantau = Join-Path $env:TEMP 'kyrion-10-pantau.txt'
$tersalin = (Copy-HasilVm 'keluaran-awal.txt' $tmpAwal) -and (Copy-HasilVm 'keluaran-pantau.txt' $tmpPantau)
if (-not $tersalin) {
  # Folder di VM sengaja tidak dihapus agar hasil masih dapat diambil.
  Write-Host 'Salin manual:'
  Write-Host "scp kyrion-staging:$remote/keluaran-awal.txt `"$tmpAwal`""
  Write-Host "scp kyrion-staging:$remote/keluaran-pantau.txt `"$tmpPantau`""
  Write-Host "Catatan lalu lintas laptop: $tmpLaptop"
  throw 'scp keluaran gagal; bukti belum disimpan'
}
& ssh kyrion-staging rm -rf $remote

function Read-Hasil([string]$Jalur) { ([System.IO.File]::ReadAllText($Jalur)) -replace "`r", '' }
$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  "# Bukti simulasi deteksi $Skenario $Mode (Tugas 7)",
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  "# Perintah: .\deploy\uji\10-deteksi-simulasi.ps1 -Skenario $Skenario -Mode $Mode",
  "# Kode keluar skrip VM: awal=$kodeAwal, pantau=$kodePantau"
) + ($catatan | ForEach-Object { "# $_" })
$isi = @(($kepala -join "`n"), '== A. keadaan awal (VM)', (Read-Hasil $tmpAwal),
  '== B. lalu lintas dari laptop', ($laptop -join "`n"), '', '== C. pantauan (VM)', (Read-Hasil $tmpPantau)) -join "`n"
[System.IO.File]::WriteAllText($bukti, $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmpAwal, $tmpPantau, $tmpLaptop
Write-Host "Bukti disimpan: $bukti"
