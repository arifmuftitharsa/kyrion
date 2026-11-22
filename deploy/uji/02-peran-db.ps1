# Uji peran DB terpisah (Tugas 2, R-13, T-18). Dijalankan Arif sekali dari PowerShell 5.1 di laptop.
#   .\deploy\uji\02-peran-db.ps1                   -> hanya uji (roles.sql sudah diterapkan)
#   .\deploy\uji\02-peran-db.ps1 -TerapkanRoles    -> terapkan roles.sql dulu, lalu uji
# Prasyarat di VM: /srv/kyrion/secrets/kyrion_db_ddl_password dan kyrion_db_app_password sudah ada (lihat laporan Tugas 2).
# ssh akan meminta passphrase kunci dan sudo meminta kata sandi; skrip ini tidak menyimpan keduanya.
param([switch]$TerapkanRoles)
$ErrorActionPreference = 'Stop'

$akar   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bukti  = Join-Path $akar 'security\bukti\02-peran-db.txt'
$remote = '/tmp/kyrion-uji-02'
if (Test-Path $bukti) { throw "Berkas bukti sudah ada, tidak ditimpa: $bukti (pindahkan atau hapus sendiri bila ingin mengulang)" }

$hash = (& git -C $akar rev-parse --short HEAD).Trim()
$flag = ''
if ($TerapkanRoles) { $flag = '--terapkan-roles' }
$perintah = "ssh -t kyrion-staging bash $remote/uji-negatif-peran.sh $flag"

& ssh kyrion-staging mkdir -p $remote
if ($LASTEXITCODE -ne 0) { throw 'ssh mkdir gagal' }
& scp (Join-Path $akar 'deploy\db\roles.sql') (Join-Path $akar 'deploy\db\uji-negatif-peran.sh') "kyrion-staging:$remote/"
if ($LASTEXITCODE -ne 0) { throw 'scp ke VM gagal' }

# Kode keluar uji (bukan nol bila ada uji gagal) tidak menghentikan skrip: keluaran tetap harus diambil.
& ssh -t kyrion-staging bash "$remote/uji-negatif-peran.sh" $flag
$kodeUji = $LASTEXITCODE

$tmp = Join-Path $env:TEMP 'kyrion-02-keluaran.txt'
& scp "kyrion-staging:$remote/keluaran.txt" $tmp
if ($LASTEXITCODE -ne 0) { throw 'scp keluaran gagal' }
& ssh kyrion-staging rm -rf $remote

$tanggal = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$kepala = @(
  '# Bukti uji peran DB terpisah (Tugas 2, R-13, T-18)',
  "# Tanggal: $tanggal",
  "# Hash commit: $hash",
  "# Perintah: $perintah",
  "# Kode keluar uji: $kodeUji",
  ''
) -join "`n"
$isi = ([System.IO.File]::ReadAllText($tmp)) -replace "`r", ''
[System.IO.File]::WriteAllText($bukti, $kepala + "`n" + $isi, (New-Object System.Text.UTF8Encoding($false)))
Remove-Item $tmp
Write-Host "Bukti disimpan: $bukti (kode keluar uji $kodeUji)"
