# 🏪 Kedai Penggalangku

Aplikasi **kasir, inventaris, dan laporan profit** berbasis **Google Apps Script + Google Spreadsheet** — hanya 2 file script, tanpa server, tanpa login, gratis selamanya.

🔗 **Aplikasi Live (hasil deploy):**
[https://script.google.com/macros/s/AKfycbyw3RioQE90HNXCQ2HGLkmjQ0Ed06qsSBi1QIQKRZ52s_s8tEOEGJIeY7759VTdtlCrXw/exec](https://script.google.com/macros/s/AKfycbyw3RioQE90HNXCQ2HGLkmjQ0Ed06qsSBi1QIQKRZ52s_s8tEOEGJIeY7759VTdtlCrXw/exec)

🗄️ **Spreadsheet ID (terkunci di `Code.gs`):** `1MFWVYJyyYcA28L5wUX4-K7LrXfgO6cGMakHF8E0IFQw`

---

## ✨ Fitur

| Menu | Tambah | Edit | Hapus | Keterangan |
|---|:-:|:-:|:-:|---|
| 📊 Dashboard | — | — | — | Flowchart aliran keuntungan dalam %, grafik bulanan, kesimpulan otomatis (barang terlaris / paling sepi, akumulasi potongan kas & upah) |
| 🛒 Kasir | ✅ | — | — | Keranjang, Tunai/QRIS/Transfer, stok berkurang realtime |
| 📦 Belanja | ✅ | ➡️ Master | ➡️ Master | Harga satuan, potongan, harga jual bulat dihitung otomatis |
| 🗂️ Master Data | — | ✅ penuh | ✅ | Edit nama, kategori, tanggal, lokasi, jumlah, harga beli & jual (diproteksi bila sudah ada transaksi) |
| 🧾 Transaksi | ✅ (kasir) | ✅ | ✅ | Edit qty/harga/metode; hapus transaksi → stok kembali otomatis |
| 💸 Pengeluaran | ✅ | ✅ | ✅ | Biaya lain-lain dengan ID otomatis `EXP-0001` |
| 📅 Laporan Bulanan | 🔒 otomatis | — | — | Sheet `Lap-<Bulan>` dibuat otomatis saat transaksi pertama bulan itu |
| 📈 Profit | 🔒 otomatis | — | — | Rekapan margin per bulan + persentase untung/rugi |

> 🔒 = dihitung otomatis dari sumber data; koreksi dilakukan lewat menu Transaksi/Belanja/Pengeluaran.

## 📁 Isi Repositori

| File | Fungsi |
|---|---|
| `Code.gs` | Backend Apps Script: menyajikan halaman web + seluruh logika spreadsheet (auto-create sheet, recomputasi laporan, validasi stok, LockService) |
| `index.html` | Frontend lengkap satu file (HTML + CSS + JS): dashboard, kasir, CRUD, grafik SVG tanpa pustaka eksternal |
| `appsscript.json` | Manifes proyek Apps Script (zona waktu Asia/Jakarta, runtime V8, akses web app) |
| `.clasp.json.example` | Templat konfigurasi clasp untuk sinkronisasi GitHub ↔ Apps Script |
| `LICENSE` | MIT |

## 🚀 Instalasi dari Nol (±5 menit)

1. Buka spreadsheet Anda → **Ekstensi → Apps Script**
2. Tempel seluruh isi **`Code.gs`** → simpan
3. Buat file HTML bernama **`index`** (**+ → HTML**), tempel seluruh isi **`index.html`** → simpan
4. **Terapkan (Deploy) → Penerapan baru → Aplikasi web**:
   - *Jalankan sebagai:* **Saya**
   - *Yang memiliki akses:* ⚠️ **Siapa saja (Anyone)** — **jangan** pilih "Anyone with a Google account", agar kasir bisa memakai aplikasi tanpa login
5. Izinkan akses → salin URL `/exec` → buka di browser/HP. Selesai!

> Setelah mengedit script: **Deploy → Kelola penerapan → ✏️ → Versi: Baru → Terapkan** agar perubahan aktif.

## 🔄 Sinkronisasi GitHub ↔ Apps Script dengan clasp

Repositori ini adalah **sumber kebenaran (source of truth)**. Edit file di GitHub → terbitkan ke Apps Script dengan [clasp](https://github.com/google/clasp):

```bash
npm install -g @google/clasp
clasp login                     # buka akun Google Anda
cp .clasp.json.example .clasp.json
# isi "scriptId" di .clasp.json — dapatkan dari:
# Apps Script → ⚙️ Setelan Proyek → salin ID proyek
clasp pull                      # tarik kondisi terkini dari Apps Script
clasp push                      # terbitkan perubahan repo ke Apps Script
```

Setelah `clasp push`, lakukan **Deploy → Kelola penerapan → versi baru** agar versi web app ikut diperbarui.

## 🧮 Rumus yang Dipakai

| Komponen | Rumus |
|---|---|
| Harga Beli Satuan | Harga Beli Total ÷ Jumlah Dibeli |
| Potongan Kas | **1%** × Harga Beli Satuan |
| Potongan Upah | **3 × (1,5%** × Harga Beli Satuan**)** = 4,5% |
| Harga Jual Satuan Bulat | dibulatkan **ke atas** dari (HBS + Pot. Kas + Pot. Upah), kelipatan Rp500 (ubah di sheet `Setting` baris `pembulatan`) |
| Margin | Harga Jual Satuan − Harga Beli Satuan |
| Laba Bersih | Margin − Pot. Kas − Pot. Upah − Pengeluaran Lain |
| % Untung/Rugi per bulan | (Laba Bersih ÷ Omzet) × 100% |

### Sheet yang dibuat otomatis

`DataMaster` • `TransaksiPenjualan` • `Pengeluaran` • `Profit` • `RingkasanBulanan` • `Setting` • `Lap-Januari` … `Lap-Desember` (dibuat saat transaksi pertama bulan tersebut)

## 🩺 Pemecahan Masalah

| Gejala | Solusi |
|---|---|
| **URL membuka halaman login Google** | Deployment menggunakan akses *"Anyone with a Google account"*. Ubah: Deploy → Kelola penerapan → ✏️ → akses **Siapa saja** → versi baru |
| Perubahan script tidak muncul | Buat **versi deployment baru** setelah menyimpan perubahan |
| Error izin saat pertama dibuka | Jalankan sekali fungsi `getInit` dari editor Apps Script, izinkan akses |
| Angka/tanggal tampil aneh | Set zona waktu spreadsheet ke **Asia/Jakarta** (File → Setelan) |
| Barang tidak bisa dihapus | Sudah ada transaksi — hapus dulu transaksinya di menu Transaksi |

## 🗒️ Riwayat Versi

- **v1.1** — CRUD lengkap (tambah/edit/hapus untuk master, transaksi, pengeluaran), migrasi otomatis kolom ID Pengeluaran, deploy live pertama
- **v1.0** — Rilis awal: kasir, dashboard flowchart %, laporan bulanan otomatis, profit

## 📤 Mengunggah ke GitHub

```bash
# dari folder repositori ini
git remote add origin https://github.com/USERNAME/kedai-penggalangku.git
git push -u origin main
```

atau lewat web: buat repo baru di [github.com/new](https://github.com/new) → **upload files** → seret semua file di sini → Commit.

---

Dibuat dengan ❤️ untuk Kedai Penggalangku • Lisensi [MIT](LICENSE)
