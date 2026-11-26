# Bukti backup terenkripsi, offsite, dan uji pemulihan (Tugas 3, R-12). Dijalankan Arif sekali dari PowerShell 5.1.
#   .\deploy\uji\03-backup.ps1 -KunciPrivat C:\jalur\age-kunci-privat.txt -TujuanOffsite D:\kyrion-backup-offsite
# Prasyarat (belum dibuat oleh skrip ini):
#   1. age terpasang di VM:  sudo apt-get install -y age   (keputusan Arif)
#   2. pasangan kunci age dibuat di LAPTOP; deploy\backup\age-recipient.txt berisi KUNCI PUBLIK saja (baris age1...).
# Kunci privat dikirim sementara ke tmpfs VM (/dev/shm) hanya selama fase restore, lalu dihapus. Itu jendela paparan
# yang harus dicatat sebagai residual. ssh akan meminta passphrase dan sudo meminta kata sandi; keduanya tidak disimpan.
param(
  [Parameter(Mandatory = $true)][string]$KunciPrivat,
  [Parameter(Mandatory = $true)][string]$TujuanOffsite
)
$ErrorActionPreference = 'Stop'

$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar 'security\bukti\03-backup.txt'
$remote = '/tmp/kyrion-uji-03'
$kunciVm = '/dev/shm/kyrion-age-uji.key'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti" }
if (-not (Test-Path $KunciPrivat)) { throw "Kunci privat tidak ditemukan: $KunciPrivat" }
$penerima = Join-Path $akar 'deploy\backup\age-recipient.txt'
if (-not (Test-Path $penerima)) { throw 'deploy\backup\age-recipient.txt belum ada (isi dengan kunci PUBLIK age)' }
$isiPenerima = Get-Content $penerima -Raw
if ($isiPenerima -match 'AGE-SECRET-KEY') { throw 'age-recipient.txt berisi kunci PRIVAT; hentikan' }
if ($isiPenerima -notmatch '(?m)^age1') { throw 'age-recipient.txt tidak berisi kunci publik age1...' }

$hash = (& git -C $akar rev-parse --short HEAD).Trim()
$tmp = Join-Path $env:TEMP 'kyrion-03'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# 1. Salin berkas ke VM
& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
$berkas = @(
  (Join-Path $akar 'deploy\backup\backup.sh'),
  (Join-Path $akar 'deploy\backup\restore-test.sh'),
  (Join-Path $akar 'deploy\backup\kyrion-backup.service'),
  (Join-Path $akar 'deploy\backup\kyrion-backup.timer'),
  $penerima,
  (Join-Path $akar 'deploy\uji\03-backup-vm.sh')
)
& scp @berkas "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp ke VM gagal' }

# 2. Pasang dan jalankan satu backup lewat unit systemd (kode keluar dicatat, tidak menghentikan skrip)
& ssh -t kyrion-staging sudo bash "$remote/03-backup-vm.sh" pasang
$kodePasang = $LASTEXITCODE
& scp "kyrion-staging:$remote/keluaran-pasang.txt" (Join-Path $tmp 'pasang.txt')
if ($LASTEXITCODE -ne 0) { throw 'scp keluaran pasang gagal' }

# 3. Offsite ke laptop (hanya bila fase pasang berhasil)
$keluaranOffsite = ''
$kodeOffsite = 1
if ($kodePasang -eq 0) {
  try {
    $keluaranOffsite = (& (Join-Path $akar 'deploy\backup\offsite.ps1') -Tujuan $TujuanOffsite | Out-String)
    $kodeOffsite = 0
  } catch {
    $keluaranOffsite = "GAGAL: $($_.Exception.Message)"
  }
}

# 4. Uji pemulihan dengan kunci privat sementara
$kodeRestore = 1
if ($kodePasang -eq 0) {
  & scp $KunciPrivat "kyrion-staging:$kunciVm"
  if ($LASTEXITCODE -ne 0) { throw 'scp kunci sementara gagal' }
  & ssh kyrion-staging chmod 600 $kunciVm
  try {
    & ssh -t kyrion-staging sudo bash "$remote/03-backup-vm.sh" restore $kunciVm
    $kodeRestore = $LASTEXITCODE
  } finally {
    & ssh kyrion-staging rm -f $kunciVm
  }
  & scp "kyrion-staging:$remote/keluaran-restore.txt" (Join-Path $tmp 'restore.txt')
  if ($LASTEXITCODE -ne 0) { throw 'scp keluaran restore gagal' }
}
& ssh kyrion-staging rm -rf $remote

# 5. Susun berkas bukti
$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti backup, offsite, dan uji pemulihan (Tugas 3, R-12)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  '# Perintah: .\deploy\uji\03-backup.ps1 (ssh -t kyrion-staging sudo bash 03-backup-vm.sh pasang | restore; offsite.ps1)',
  "# Kode keluar: pasang=$kodePasang offsite=$kodeOffsite restore=$kodeRestore",
  '# Catatan: kunci privat age dikirim sementara ke /dev/shm VM selama fase restore lalu dihapus (rm -f).',
  ''
) -join "`n"
$bagian = @("`n===== FASE PASANG (VM) =====`n")
$bagian += [System.IO.File]::ReadAllText((Join-Path $tmp 'pasang.txt'))
$bagian += "`n===== FASE OFFSITE (laptop) =====`n"
$bagian += $keluaranOffsite
$bagian += "`n===== FASE RESTORE (VM) =====`n"
if (Test-Path (Join-Path $tmp 'restore.txt')) { $bagian += [System.IO.File]::ReadAllText((Join-Path $tmp 'restore.txt')) } else { $bagian += '(tidak dijalankan)' }
$isi = (($bagian -join "`n") -replace "`r", '')
[System.IO.File]::WriteAllText($bukti, $kepala + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item -Recurse -Force $tmp
Write-Host "Bukti disimpan: $bukti (pasang=$kodePasang offsite=$kodeOffsite restore=$kodeRestore)"
