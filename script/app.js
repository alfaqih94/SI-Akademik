import { runAPI } from "./api.js";
import { showLoading, hideLoading, showToast, nav, updateClock } from "./ui.js";

let rekapDataCache = {};
let currentRekapType = "Presensi";
let currentAdminSheet = "";
let adminDataCache = [];
let pendingDeleteIndex = -1;

window.onload = function () {
  updateClock();
  setInterval(updateClock, 1000);

  document
    .querySelectorAll('input[type="date"]')
    .forEach((i) => (i.valueAsDate = new Date()));

  setupNavigation();

  refreshDashboard();
  loadDropdowns();
};

function setupNavigation() {
  window.nav = nav;
  window.refreshDashboard = refreshDashboard;
  window.loadStudentsForPresensi = loadStudentsForPresensi;
  window.loadPresensiExisting = loadPresensiExisting;
  window.submitPresensi = submitPresensi;
  window.loadJurnalData = loadJurnalData;
  window.submitJurnal = submitJurnal;
  window.loadNilaiData = loadNilaiData;
  window.submitPenilaian = submitPenilaian;
  window.setRekapTab = setRekapTab;
  window.showRekapData = showRekapData;
  window.openDetailModal = openDetailModal;
  window.closeDetailModal = closeDetailModal;

  window.showAdminForm = showAdminForm;
  window.refreshAdminTable = refreshAdminTable;
  window.resetAdminForm = resetAdminForm;
  window.submitAdminData = submitAdminData;
  window.editAdminRow = editAdminRow;
  window.deleteAdminRow = deleteAdminRow;

  window.closeConfirmModal = closeConfirmModal;
  window.executeDelete = executeDelete;
}

function deleteAdminRow(index) {
  pendingDeleteIndex = index;
  const modal = document.getElementById("confirm-modal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function closeConfirmModal() {
  const modal = document.getElementById("confirm-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  pendingDeleteIndex = -1;
}

async function executeDelete() {
  if (pendingDeleteIndex === -1) return;

  if (!adminDataCache[pendingDeleteIndex]) {
    showToast("Error: Data cache korup. Refresh halaman.");
    closeConfirmModal();
    return;
  }

  const rowIndex = adminDataCache[pendingDeleteIndex]["_rowIndex"];

  if (rowIndex === undefined || rowIndex === null) {
    showToast("Error: ID Baris tidak ditemukan. Periksa backend.");
    closeConfirmModal();
    return;
  }

  closeConfirmModal();

  showLoading("Menghapus Data...");
  try {
    await runAPI(
      "deleteData",
      { sheet: currentAdminSheet, rowIndex: rowIndex },
      true,
    );
    await refreshAdminTable();
    showToast("Data Berhasil Dihapus");
  } catch (e) {
    showToast("Gagal menghapus: " + e.message);
  } finally {
    hideLoading();
  }
}

async function refreshDashboard() {
  showLoading("Memuat Dashboard...");
  try {
    const [allJadwalResult, allJurnalResult] = await Promise.all([
      runAPI("getDashboardData"),
      runAPI("getData", { sheet: "Jurnal" }),
    ]);

    const todayJadwal = allJadwalResult.jadwal;
    const todayDay = allJadwalResult.today;

    document.getElementById("today-day").textContent = todayDay;

    const now = new Date();
    const currentHm = now.getHours() * 60 + now.getMinutes();
    let activeSchedule = null;
    let todayHtml = "";

    if (!todayJadwal || todayJadwal.length === 0) {
      todayHtml =
        '<div class="p-4 bg-white rounded shadow text-center text-gray-400 italic text-sm">Libur / Tidak ada jadwal</div>';
    } else {
      todayJadwal.forEach((j) => {
        const [h1, m1] = String(j["Jam Mulai"] || "00:00")
          .split(":")
          .map(Number);
        const [h2, m2] = String(j["Jam Selesai"] || "00:00")
          .split(":")
          .map(Number);
        const isActive = currentHm >= h1 * 60 + m1 && currentHm <= h2 * 60 + m2;
        if (isActive) activeSchedule = j;

        const timeBadge = isActive
          ? `bg-green-100 text-green-700 border-green-200`
          : `bg-gray-100 text-gray-600 border-gray-200`;

        todayHtml += `
                <div class="bg-white p-3 rounded-lg shadow-sm border-l-4 ${isActive ? "border-green-500 bg-green-50" : "border-blue-300"} mb-2">
                    <div class="flex justify-between items-center mb-1">
                        <div class="font-bold text-gray-800 text-base">${j.Mapel}</div>
                        <div class="${timeBadge} border px-2 py-1 rounded text-xs font-mono font-bold">
                            ${j["Jam Mulai"]} - ${j["Jam Selesai"]}
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 font-semibold"><i class="fas fa-users mr-1"></i> ${j.Kelas}</div>
                </div>`;
      });
    }
    document.getElementById("schedule-list").innerHTML = todayHtml;

    const elCurrent = document.getElementById("current-schedule-container");
    if (activeSchedule) {
      const allJurnal = allJurnalResult;
      const lastEntry = [...allJurnal]
        .reverse()
        .find(
          (jr) =>
            jr.Kelas === activeSchedule.Kelas &&
            jr.Mapel === activeSchedule.Mapel,
        );

      const timeDisplay = `
                <div class="text-center mb-4 mt-2">
                    <div class="inline-block bg-white/50 px-4 py-2 rounded-lg border border-blue-100">
                        <div class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-1">Waktu Pembelajaran</div>
                        <div class="text-3xl font-mono font-black text-blue-700 tracking-tight">
                            ${activeSchedule["Jam Mulai"]} <span class="text-blue-300 text-xl align-middle mx-1">-</span> ${activeSchedule["Jam Selesai"]}
                        </div>
                    </div>
                </div>
            `;

      let journalInfo = `<div class="mt-3 bg-yellow-50 border border-yellow-200 border-dashed rounded p-4 text-center">
                <p class="text-xs text-gray-500 italic">Belum ada jurnal sebelumnya untuk kelas ini.</p>
            </div>`;

      if (lastEntry) {
        journalInfo = `
                <div class="mt-4 bg-white/80 rounded-lg border border-blue-200 overflow-hidden shadow-sm">
                    <div class="bg-blue-50 px-3 py-2 border-b border-blue-100 flex justify-between items-center">
                        <span class="text-[10px] font-bold text-blue-700 uppercase tracking-wider"><i class="fas fa-history mr-1"></i> Jurnal Terakhir</span>
                        <span class="text-[10px] text-gray-500">${new Date(lastEntry.Tanggal).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div class="p-3 space-y-3">
                        <div>
                            <span class="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Materi Pokok</span>
                            <div class="text-sm font-bold text-gray-800 leading-tight">${lastEntry.Materi}</div>
                        </div>
                        <div>
                            <span class="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Topik / Bahasan</span>
                            <div class="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">${lastEntry.Topik}</div>
                        </div>
                        ${
                          lastEntry.Catatan
                            ? `
                        <div>
                            <span class="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Catatan</span>
                            <div class="text-xs italic text-gray-500 border-l-2 border-yellow-400 pl-2">${lastEntry.Catatan}</div>
                        </div>`
                            : ""
                        }
                    </div>
                </div>`;
      }

      elCurrent.innerHTML = `
                <div class="text-center border-b border-blue-100 pb-3 mb-2">
                    <p class="text-2xl font-bold text-blue-900">${activeSchedule.Mapel}</p>
                    <span class="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full mt-1">${activeSchedule.Kelas}</span>
                </div>
                ${timeDisplay}
                ${journalInfo}
            `;
    } else {
      elCurrent.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-coffee text-4xl text-gray-300 mb-3"></i>
                    <p class="text-lg font-bold text-gray-500">Tidak ada KBM</p>
                    <p class="text-xs text-gray-400">Saat ini tidak ada jadwal aktif</p>
                </div>`;
    }

    const allScheduleData = await runAPI("getData", { sheet: "Jadwal" });
    const dayOrder = {
      Senin: 1,
      Selasa: 2,
      Rabu: 3,
      Kamis: 4,
      Jumat: 5,
      Sabtu: 6,
      Minggu: 7,
    };
    const sortedAll = allScheduleData.sort(
      (a, b) =>
        (dayOrder[a.Hari] || 8) - (dayOrder[b.Hari] || 8) ||
        String(a["Jam Mulai"] || "").localeCompare(
          String(b["Jam Mulai"] || ""),
        ),
    );

    let allHtml = "",
      lastDay = "";
    sortedAll.forEach((sch) => {
      if (sch.Hari !== lastDay) {
        allHtml += `<div class="bg-gray-200 px-4 py-2 text-xs font-bold text-gray-700 uppercase mt-2 sticky top-0 border-y border-gray-300">${sch.Hari}</div>`;
        lastDay = sch.Hari;
      }
      allHtml += `
            <div class="bg-white px-4 py-3 flex justify-between items-center hover:bg-gray-50 border-b last:border-0">
                <div class="w-1/3">
                    <div class="text-xs font-mono font-bold text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded border border-blue-100">
                        ${sch["Jam Mulai"]} - ${sch["Jam Selesai"]}
                    </div>
                </div>
                <div class="w-2/3 pl-2">
                    <div class="text-sm font-bold text-gray-800">${sch.Mapel}</div>
                    <div class="text-xs text-gray-500">${sch.Kelas}</div>
                </div>
            </div>`;
    });
    document.getElementById("all-schedule-list").innerHTML = allHtml;
  } catch (e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadDropdowns() {
  try {
    const [kelas, mapel] = await Promise.all([
      runAPI("getData", { sheet: "Kelas" }),
      runAPI("getData", { sheet: "Mapel" }),
    ]);
    const fill = (id, d, k) => {
      const el = document.getElementById(id);
      if (el)
        el.innerHTML =
          '<option value="">- Pilih -</option>' +
          d.map((i) => `<option value="${i[k]}">${i[k]}</option>`).join("");
    };
    fill("presensi-kelas", kelas, "Nama Kelas");
    fill("presensi-mapel", mapel, "Nama Mapel");
    fill("jurnal-kelas", kelas, "Nama Kelas");
    fill("jurnal-mapel", mapel, "Nama Mapel");
    fill("nilai-kelas", kelas, "Nama Kelas");
    fill("nilai-mapel", mapel, "Nama Mapel");
    fill("rekap-kelas", kelas, "Nama Kelas");
    fill("rekap-mapel", mapel, "Nama Mapel");
  } catch (e) {}
}

async function loadStudentsForPresensi() {
  const kelas = document.getElementById("presensi-kelas").value;
  if (!kelas) return;

  const btn = document.getElementById("btn-submit-presensi");
  if (btn) {
    btn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Presensi';
    btn.classList.replace("bg-orange-600", "bg-blue-600");
    btn.classList.replace("hover:bg-orange-700", "hover:bg-blue-700");
  }

  showLoading("Mengambil Siswa...");
  try {
    const students = await runAPI("getData", { sheet: "Siswa" });
    const filtered = students.filter((s) => s.Kelas == kelas);

    document.getElementById("presensi-student-list").innerHTML = filtered.length
      ? filtered
          .map(
            (s, i) => `
          <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 student-row hover:shadow-md transition-shadow duration-200" data-name="${s.Nama}">
            <div class="text-xs font-semibold text-gray-700 w-full sm:w-1/3 flex items-center
                <span class="truncate">${s.Nama}</span>
            </div>
            <div class="flex w-full sm:w-2/3 justify-between sm:justify-end gap-2">
              <label class="cursor-pointer flex-1 sm:flex-none">
                <input type="radio" name="p-${i}" value="H" checked class="peer sr-only">
                <div class="w-full sm:w-12 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 border-green-100 bg-green-50 text-green-600 peer-checked:bg-green-500 peer-checked:text-white peer-checked:border-green-600 peer-checked:shadow-md transition-all duration-200">H</div>
              </label>
              <label class="cursor-pointer flex-1 sm:flex-none">
                <input type="radio" name="p-${i}" value="S" class="peer sr-only">
                <div class="w-full sm:w-12 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 border-yellow-100 bg-yellow-50 text-yellow-600 peer-checked:bg-yellow-500 peer-checked:text-white peer-checked:border-yellow-600 peer-checked:shadow-md transition-all duration-200">S</div>
              </label>
              <label class="cursor-pointer flex-1 sm:flex-none">
                <input type="radio" name="p-${i}" value="I" class="peer sr-only">
                <div class="w-full sm:w-12 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 border-blue-100 bg-blue-50 text-blue-600 peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-600 peer-checked:shadow-md transition-all duration-200">I</div>
              </label>
              <label class="cursor-pointer flex-1 sm:flex-none">
                <input type="radio" name="p-${i}" value="A" class="peer sr-only">
                <div class="w-full sm:w-12 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 border-red-100 bg-red-50 text-red-600 peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-600 peer-checked:shadow-md transition-all duration-200">A</div>
              </label>
            </div>
          </div>`,
          )
          .join("")
      : '<div class="text-center p-8 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">Belum ada data siswa di kelas ini</div>';
  } finally {
    hideLoading();
  }
}

async function loadPresensiExisting() {
  const tgl = document.getElementById("presensi-date").value;
  const kelas = document.getElementById("presensi-kelas").value;
  const mapel = document.getElementById("presensi-mapel").value;

  if (!tgl || !kelas || !mapel)
    return showToast("Pilih Tanggal, Kelas, dan Mapel dulu!");

  showLoading("Mengecek Data...");
  try {
    const allPresensi = await runAPI("getData", { sheet: "Presensi" });

    const existing = allPresensi.filter((p) => {
      let pDate = p.Tanggal;
      if (pDate && pDate.includes && pDate.includes("T"))
        pDate = pDate.split("T")[0];
      return pDate === tgl && p.Kelas === kelas && p.Mapel === mapel;
    });

    if (existing.length === 0) {
      showToast("Belum ada data tersimpan.");
      return;
    }

    const rows = document.querySelectorAll(".student-row");
    let foundCount = 0;
    rows.forEach((row) => {
      const name = row.getAttribute("data-name");
      const record = existing.find((e) => e.Siswa === name);
      if (record) {
        const radio = row.querySelector(`input[value="${record.Status}"]`);
        if (radio) radio.checked = true;
        foundCount++;
      }
    });

    showToast(`Data dimuat: ${foundCount} siswa.`);

    const btn = document.getElementById("btn-submit-presensi");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-edit mr-2"></i> Update Presensi';
      btn.classList.replace("bg-blue-600", "bg-orange-600");
      btn.classList.replace("hover:bg-blue-700", "hover:bg-orange-700");
    }
  } finally {
    hideLoading();
  }
}

async function submitPresensi() {
  if (!document.getElementById("presensi-kelas").value)
    return showToast("Lengkapi Form!");
  showLoading("Menyimpan...");
  try {
    const data = Array.from(document.querySelectorAll(".student-row")).map(
      (row) => ({
        Tanggal: document.getElementById("presensi-date").value,
        Kelas: document.getElementById("presensi-kelas").value,
        Mapel: document.getElementById("presensi-mapel").value,
        Siswa: row.getAttribute("data-name"),
        Status: row.querySelector("input:checked").value,
      }),
    );

    await runAPI("submitPresensiBatch", { data: data }, true);
    showToast("Tersimpan / Diperbarui");
    nav("dashboard");

    const btn = document.getElementById("btn-submit-presensi");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Presensi';
      btn.classList.replace("bg-orange-600", "bg-blue-600");
      btn.classList.replace("hover:bg-orange-700", "hover:bg-blue-700");
    }
  } finally {
    hideLoading();
  }
}

async function loadJurnalData() {
  const tgl = document.getElementById("jurnal-date").value;
  const kelas = document.getElementById("jurnal-kelas").value;
  const mapel = document.getElementById("jurnal-mapel").value;

  if (!tgl || !kelas || !mapel)
    return showToast("Lengkapi Tanggal, Kelas & Mapel");

  const btn = document.getElementById("btn-submit-jurnal");
  btn.innerHTML = '<i class="fas fa-save mr-2"></i> Kirim Jurnal';
  btn.classList.replace("bg-orange-600", "bg-green-600");
  btn.classList.replace("hover:bg-orange-700", "hover:bg-green-700");
  document.getElementById("jurnal-edit-index").value = "-1";

  document.getElementById("jurnal-materi").value = "";
  document.getElementById("jurnal-topik").value = "";
  document.getElementById("jurnal-catatan").value = "";

  showLoading("Cek Data & Riwayat...");
  try {
    const data = await runAPI("getData", { sheet: "Jurnal" });

    const existing = data.find((j) => {
      let jDate = j.Tanggal;
      if (jDate && jDate.includes("T")) jDate = jDate.split("T")[0];
      return jDate === tgl && j.Kelas === kelas && j.Mapel === mapel;
    });

    if (existing) {
      document.getElementById("jurnal-materi").value = existing.Materi;
      document.getElementById("jurnal-topik").value = existing.Topik;
      document.getElementById("jurnal-catatan").value = existing.Catatan;
      document.getElementById("jurnal-edit-index").value =
        existing["_rowIndex"];

      btn.innerHTML = '<i class="fas fa-edit mr-2"></i> Update Jurnal';
      btn.classList.replace("bg-green-600", "bg-orange-600");
      btn.classList.replace("bg-gray-800", "bg-orange-600");
      btn.classList.replace("hover:bg-green-700", "hover:bg-orange-700");
      showToast("Data ditemukan. Mode Update.");
    } else {
      btn.classList.replace("bg-gray-800", "bg-green-600");
      btn.classList.replace("bg-orange-600", "bg-green-600");
      showToast("Data baru. Mode Simpan.");
    }

    document.getElementById("jurnal-history-label").textContent =
      `${kelas} - ${mapel}`;
    const historyData = data
      .filter((j) => j.Kelas === kelas && j.Mapel === mapel)
      .sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal))
      .slice(0, 3);

    const historyContainer = document.getElementById("jurnal-history");
    if (historyData.length === 0) {
      historyContainer.innerHTML =
        '<div class="text-center p-4 bg-gray-50 border border-dashed rounded text-xs text-gray-400">Belum ada riwayat jurnal untuk kelas ini.</div>';
    } else {
      historyContainer.innerHTML = historyData
        .map(
          (h) => `
                <div class="bg-white rounded-lg border-l-4 border-blue-500 shadow-sm p-3 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${new Date(h.Tanggal).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</div>
                        <div class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">${h.Mapel}</div>
                    </div>
                    <div class="space-y-1">
                        <div>
                            <div class="text-[10px] font-bold text-gray-500 uppercase">Materi</div>
                            <div class="text-sm font-bold text-gray-800 leading-tight">${h.Materi}</div>
                        </div>
                        <div>
                            <div class="text-[10px] font-bold text-gray-500 uppercase mt-1">Topik</div>
                            <div class="text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">${h.Topik}</div>
                        </div>
                        ${h.Catatan ? `<div class="mt-1 pt-1 border-t border-dashed border-gray-200 text-xs italic text-gray-500"><i class="fas fa-sticky-note mr-1 text-yellow-400"></i>${h.Catatan}</div>` : ""}
                    </div>
                </div>
            `,
        )
        .join("");
    }
  } finally {
    hideLoading();
  }
}

async function submitJurnal() {
  if (!document.getElementById("jurnal-kelas").value)
    return showToast("Pilih data dulu!");
  showLoading("Menyimpan...");
  try {
    let data = {};
    document
      .querySelectorAll(
        "#jurnal input:not([type=hidden]), #jurnal select, #jurnal textarea",
      )
      .forEach((i) => {
        let key = "";
        if (i.id === "jurnal-date") key = "Tanggal";
        else if (i.id === "jurnal-kelas") key = "Kelas";
        else if (i.id === "jurnal-mapel") key = "Mapel";
        else if (i.id === "jurnal-materi") key = "Materi";
        else if (i.id === "jurnal-topik") key = "Topik";
        else if (i.id === "jurnal-catatan") key = "Catatan";

        if (key) data[key] = i.value;
      });

    const editIndex = document.getElementById("jurnal-edit-index").value;

    if (editIndex !== "-1") {
      await runAPI(
        "updateData",
        { sheet: "Jurnal", rowIndex: editIndex, data: data },
        true,
      );
    } else {
      await runAPI("addData", { sheet: "Jurnal", data: data }, true);
    }

    showToast("Jurnal Tersimpan");

    loadJurnalData();
  } finally {
    hideLoading();
  }
}

async function loadJurnalHistory() {}

async function loadNilaiData() {
  const kelas = document.getElementById("nilai-kelas").value;
  const mapel = document.getElementById("nilai-mapel").value;
  const jenis = document.getElementById("nilai-jenis").value;
  const order = document.getElementById("nilai-order").value;

  if (!kelas || !mapel || !jenis || !order)
    return showToast("Lengkapi filter Kelas, Mapel, Jenis & Urutan!");

  const btn = document.getElementById("btn-submit-nilai");
  btn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Nilai';
  btn.classList.replace("bg-orange-600", "bg-purple-600");
  btn.classList.remove("hidden");

  showLoading("Memuat & Cek Data...");
  try {
    const [students, allGrades] = await Promise.all([
      runAPI("getData", { sheet: "Siswa" }),
      runAPI("getData", { sheet: "Penilaian" }),
    ]);

    const classStudents = students.filter((s) => s.Kelas == kelas);

    const existingGrades = allGrades.filter(
      (g) =>
        g.Kelas == kelas &&
        g.Mapel == mapel &&
        g.Jenis == jenis &&
        g.Order == order,
    );

    const gradeMap = {};
    let dataFound = false;

    document.getElementById("nilai-catatan").value = "";

    existingGrades.forEach((g) => {
      gradeMap[g["Nama Siswa"]] = g.Nilai;
      if (g.Catatan) {
        document.getElementById("nilai-catatan").value = g.Catatan;
      }
      dataFound = true;
    });

    if (dataFound) {
      btn.innerHTML = '<i class="fas fa-edit mr-2"></i> Update Nilai';
      btn.classList.replace("bg-purple-600", "bg-orange-600");
      showToast("Data lama ditemukan. Mode Update.");
    } else {
      showToast("Data belum ada. Mode Simpan Baru.");
    }

    const colors = [
      "bg-red-100 text-red-600",
      "bg-green-100 text-green-600",
      "bg-blue-100 text-blue-600",
      "bg-yellow-100 text-yellow-600",
      "bg-purple-100 text-purple-600",
      "bg-pink-100 text-pink-600",
      "bg-indigo-100 text-indigo-600",
      "bg-teal-100 text-teal-600",
    ];

    document.getElementById("nilai-student-list").innerHTML = classStudents
      .map((s, i) => {
        const val = gradeMap[s.Nama] !== undefined ? gradeMap[s.Nama] : "";
        const colorClass = colors[i % colors.length];
        return `
            <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-3 student-nilai-row hover:shadow-md transition-all duration-200" data-name="${s.Nama}">
                <div class="flex items-center w-2/3 overflow-hidden">
                   
                    <div class="text-sm font-bold text-gray-700 truncate">${s.Nama}</div>
                </div>
                <div class="w-1/3">
                    <input type="number" value="${val}" placeholder="0" min="0" max="100" class="w-full border-2 border-gray-100 rounded-lg p-2 text-center font-mono font-bold text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all placeholder-gray-300 text-gray-800 bg-gray-50 focus:bg-white">
                </div>
            </div>`;
      })
      .join("");
  } finally {
    hideLoading();
  }
}

async function submitPenilaian() {
  showLoading("Menyimpan...");
  try {
    const data = Array.from(
      document.querySelectorAll(".student-nilai-row"),
    ).map((row) => {
      let inputVal = row.querySelector("input").value;

      if (inputVal === "" || inputVal === null) inputVal = "0";

      return {
        Tanggal: document.getElementById("nilai-date").value,
        Kelas: document.getElementById("nilai-kelas").value,
        Mapel: document.getElementById("nilai-mapel").value,
        Jenis: document.getElementById("nilai-jenis").value,
        Order: document.getElementById("nilai-order").value,
        Catatan: document.getElementById("nilai-catatan").value,
        "Nama Siswa": row.getAttribute("data-name"),
        Nilai: inputVal,
      };
    });

    await runAPI("upsertGrades", { data: data }, true);
    showToast("Tersimpan / Diperbarui");
    nav("dashboard"); // Kembali ke Dashboard

    const btn = document.getElementById("btn-submit-nilai");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Nilai';
      btn.classList.replace("bg-orange-600", "bg-purple-600");
      btn.classList.add("hidden");
    }

    const studentList = document.getElementById("nilai-student-list");
    if (studentList)
      studentList.innerHTML =
        '<p class="text-center text-gray-400 text-sm italic mt-8">Pilih filter dan klik Muat Data.</p>';

    const catatanInput = document.getElementById("nilai-catatan");
    if (catatanInput) catatanInput.value = "";
  } finally {
    hideLoading();
  }
}

function setRekapTab(type) {
  currentRekapType = type;
  document.querySelectorAll(".rekap-tab-btn").forEach((btn) => {
    btn.classList.remove("bg-blue-600", "text-white", "shadow-md");
    btn.classList.add("bg-gray-100", "text-gray-600");
  });
  document
    .getElementById(`tab-${type.toLowerCase()}`)
    .classList.add("bg-blue-600", "text-white", "shadow-md");
  document.getElementById("rekap-body").innerHTML = "";
}

async function showRekapData() {
  const kelas = document.getElementById("rekap-kelas").value;
  const mapel = document.getElementById("rekap-mapel").value;
  if (!kelas || !mapel) return showToast("Pilih Kelas & Mapel");

  showLoading("Mengolah Data...");
  try {
    const data = await runAPI("getData", { sheet: currentRekapType });
    let filtered = data.filter((d) => d.Kelas == kelas && d.Mapel == mapel);

    rekapDataCache = {};
    let html = "";

    if (currentRekapType === "Presensi") {
      document.getElementById("rekap-header").innerHTML =
        `<th class="px-3 py-2 border-b">Siswa</th><th class="px-3 py-2 border-b text-green-600">H</th><th class="px-3 py-2 border-b text-yellow-600">S</th><th class="px-3 py-2 border-b text-blue-600">I</th><th class="px-3 py-2 border-b text-red-600">A</th><th class="px-3 py-2 border-b">Det</th>`;
      filtered.forEach((d) => {
        const name = d.Siswa;
        if (!rekapDataCache[name])
          rekapDataCache[name] = { H: 0, S: 0, I: 0, A: 0, details: [] };
        rekapDataCache[name].details.push(d);
        if (["H", "S", "I", "A"].includes(d.Status))
          rekapDataCache[name][d.Status]++;
      });
      Object.keys(rekapDataCache)
        .sort()
        .forEach((name) => {
          const d = rekapDataCache[name];
          html += `<tr class="bg-white border-b text-xs"><td class="px-3 py-2 font-medium truncate max-w-[120px]">${name}</td><td class="px-3 py-2 font-bold text-green-600">${d.H}</td><td class="px-3 py-2 font-bold text-yellow-600">${d.S}</td><td class="px-3 py-2 font-bold text-blue-600">${d.I}</td><td class="px-3 py-2 font-bold text-red-600">${d.A}</td><td class="px-3 py-2 text-center"><button onclick="openDetailModal('${name}')" class="text-blue-500 bg-blue-50 p-1 rounded"><i class="fas fa-eye"></i></button></td></tr>`;
        });
    } else if (currentRekapType === "Penilaian") {
      const types = ["Tugas", "Catatan", "Harian", "UTS", "UAS"];
      let headerHtml = '<th class="px-3 py-2 border-b">Siswa</th>';
      types.forEach(
        (t) =>
          (headerHtml += `<th class="px-3 py-2 border-b text-[10px]">${t.substring(0, 3)}</th>`),
      );
      headerHtml += '<th class="px-3 py-2 border-b">Det</th>';
      document.getElementById("rekap-header").innerHTML = headerHtml;

      filtered.forEach((d) => {
        const name = d["Nama Siswa"];
        if (!rekapDataCache[name])
          rekapDataCache[name] = { details: [], scores: {} };
        rekapDataCache[name].details.push(d);
        if (!rekapDataCache[name].scores[d.Jenis])
          rekapDataCache[name].scores[d.Jenis] = [];
        rekapDataCache[name].scores[d.Jenis].push(Number(d.Nilai));
      });

      Object.keys(rekapDataCache)
        .sort()
        .forEach((name) => {
          const d = rekapDataCache[name];
          let cols = "";
          types.forEach((t) => {
            const vals = d.scores[t];
            const avg =
              vals && vals.length > 0
                ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                : "-";
            cols += `<td class="px-3 py-2 text-center font-mono ${avg !== "-" ? "text-blue-600 font-bold" : ""}" text-[10px]>${avg}</td>`;
          });
          html += `<tr class="bg-white border-b text-xs"><td class="px-3 py-2 font-medium truncate max-w-[100px]">${name}</td>${cols}<td class="px-3 py-2 text-center"><button onclick="openDetailModal('${name}')" class="text-blue-500 bg-blue-50 p-1 rounded"><i class="fas fa-eye"></i></button></td></tr>`;
        });
    } else {
      document.getElementById("rekap-header").innerHTML =
        '<th class="px-3 py-2 border-b">Tgl</th><th class="px-3 py-2 border-b">Materi</th><th class="px-3 py-2 border-b">Catatan</th>';
      filtered
        .sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal))
        .forEach((d) => {
          const date = new Date(d.Tanggal).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "numeric",
          });
          html += `<tr class="bg-white border-b text-xs"><td class="px-3 py-2">${date}</td><td class="px-3 py-2">${d.Materi}</td><td class="px-3 py-2 italic text-gray-500">${d.Catatan || "-"}</td></tr>`;
        });
    }
    document.getElementById("rekap-body").innerHTML =
      html ||
      '<tr><td colspan="6" class="p-4 text-center text-gray-400">Data tidak ditemukan</td></tr>';
  } finally {
    hideLoading();
  }
}

function openDetailModal(studentName) {
  const data = rekapDataCache[studentName];
  if (!data) return;
  document.getElementById("detail-modal").classList.remove("hidden");
  document.getElementById("modal-box").classList.add("modal-enter");
  document.getElementById("detail-title").innerText = studentName;
  const content = document.getElementById("detail-content");
  let tableHtml = "";
  data.details.sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));

  if (currentRekapType === "Presensi") {
    tableHtml = `<table class="w-full text-xs text-left"><thead class="bg-gray-100 text-gray-600 font-bold"><tr><th class="p-2">Tanggal</th><th class="p-2">Status</th></tr></thead><tbody>`;
    data.details.forEach((d) => {
      const date = new Date(d.Tanggal).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      let badge = `<span class="px-2 py-1 rounded text-white font-bold text-[10px] ${d.Status === "H" ? "bg-green-500" : d.Status === "S" ? "bg-yellow-500" : d.Status === "I" ? "bg-blue-500" : "bg-red-500"}">${d.Status}</span>`;
      tableHtml += `<tr class="border-b"><td class="p-2">${date}</td><td class="p-2">${badge}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
  } else if (currentRekapType === "Penilaian") {
    tableHtml = `<table class="w-full text-xs text-left"><thead class="bg-gray-100 text-gray-600 font-bold"><tr><th class="p-2">Tanggal</th><th class="p-2">Jenis</th><th class="p-2">Ke</th><th class="p-2 text-right">Nilai</th></tr></thead><tbody>`;
    data.details.forEach((d) => {
      const date = new Date(d.Tanggal).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      tableHtml += `<tr class="border-b"><td class="p-2">${date}</td><td class="p-2">${d.Jenis}</td><td class="p-2">${d.Order}</td><td class="p-2 text-right font-bold text-blue-600">${d.Nilai}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
  }
  content.innerHTML = tableHtml;
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.add("hidden");
}

async function showAdminForm(sheetName) {
  currentAdminSheet = sheetName;
  document.getElementById("admin-form-title").innerText = "Input " + sheetName;
  document.getElementById("admin-form-container").classList.remove("hidden");
  document.getElementById("admin-list-container").classList.remove("hidden");
  resetAdminForm();
  showLoading("Memuat Admin...");
  try {
    const [kelasData, mapelData] = await Promise.all([
      runAPI("getData", { sheet: "Kelas" }),
      runAPI("getData", { sheet: "Mapel" }),
    ]);
    const container = document.getElementById("admin-dynamic-inputs");
    let html = "";
    if (sheetName === "Siswa")
      html = `<input type="text" id="adm-Nama" placeholder="Nama Lengkap" class="w-full border rounded p-2 text-sm"><select id="adm-Kelas" class="w-full border rounded p-2 text-sm bg-white"><option value="">- Pilih Kelas -</option>${kelasData.map((k) => `<option>${k["Nama Kelas"]}</option>`).join("")}</select><select id="adm-Jenis Kelamin" class="w-full border rounded p-2 text-sm bg-white"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>`;
    else if (sheetName === "Kelas")
      html = `<input type="text" id="adm-Nama Kelas" placeholder="Nama Kelas" class="w-full border rounded p-2 text-sm"><input type="text" id="adm-Wali Kelas" placeholder="Wali Kelas" class="w-full border rounded p-2 text-sm">`;
    else if (sheetName === "Mapel")
      html = `<input type="text" id="adm-Nama Mapel" placeholder="Nama Mapel" class="w-full border rounded p-2 text-sm"><input type="text" id="adm-Guru" placeholder="Nama Guru" class="w-full border rounded p-2 text-sm">`;
    else if (sheetName === "Jadwal") {
      const h = Array.from({ length: 24 }, (_, i) =>
          i.toString().padStart(2, "0"),
        ),
        m = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
      html = `<select id="adm-Hari" class="w-full border rounded p-2 text-sm bg-white"><option value="">- Hari -</option>${["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map((d) => `<option>${d}</option>`).join("")}</select><div class="flex space-x-2"><div class="w-1/2 text-xs">Mulai<br><div class="flex"><select id="adm-h1" class="border w-full">${h.map((i) => `<option>${i}</option>`).join("")}</select>:<select id="adm-m1" class="border w-full">${m.map((i) => `<option>${i}</option>`).join("")}</select></div></div><div class="w-1/2 text-xs">Selesai<br><div class="flex"><select id="adm-h2" class="border w-full">${h.map((i) => `<option>${i}</option>`).join("")}</select>:<select id="adm-m2" class="border w-full">${m.map((i) => `<option>${i}</option>`).join("")}</select></div></div></div><select id="adm-Kelas" class="w-full border rounded p-2 text-sm bg-white"><option value="">- Kelas -</option>${kelasData.map((k) => `<option>${k["Nama Kelas"]}</option>`).join("")}</select><select id="adm-Mapel" class="w-full border rounded p-2 text-sm bg-white"><option value="">- Mapel -</option>${mapelData.map((k) => `<option>${k["Nama Mapel"]}</option>`).join("")}</select>`;
    }
    container.innerHTML = html;
    await refreshAdminTable();
  } finally {
    hideLoading();
  }
}

async function refreshAdminTable() {
  const tbody = document.getElementById("admin-table-body");
  const thead = document.getElementById("admin-table-header");
  tbody.innerHTML =
    '<tr><td colspan="4" class="p-4 text-center"><div class="spinner mx-auto w-6 h-6 border-2"></div></td></tr>';
  const data = await runAPI("getData", { sheet: currentAdminSheet });
  adminDataCache = data;
  let cols = [];
  if (currentAdminSheet === "Siswa") cols = ["Nama", "Kelas"];
  else if (currentAdminSheet === "Kelas") cols = ["Nama Kelas", "Wali Kelas"];
  else if (currentAdminSheet === "Mapel") cols = ["Nama Mapel", "Guru"];
  else if (currentAdminSheet === "Jadwal")
    cols = ["Hari", "Mapel", "Jam Mulai"];
  thead.innerHTML =
    cols.map((c) => `<th class="px-3 py-2">${c}</th>`).join("") +
    '<th class="px-3 py-2 text-right">Aksi</th>';
  if (data.length === 0)
    tbody.innerHTML =
      '<tr><td colspan="4" class="p-4 text-center text-sm text-gray-400">Belum ada data</td></tr>';
  else {
    tbody.innerHTML = data
      .map((row, index) => {
        let tds = cols
          .map((k) => `<td class="px-3 py-2 border-b">${row[k] || ""}</td>`)
          .join("");
        return `<tr class="bg-white hover:bg-gray-50">${tds}<td class="px-3 py-2 border-b text-right whitespace-nowrap"><button onclick="editAdminRow(${index})" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button><button onclick="deleteAdminRow(${index})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td></tr>`;
      })
      .join("");
  }
}

function editAdminRow(index) {
  const row = adminDataCache[index];
  document.getElementById("adm-edit-index").value = row["_rowIndex"];
  document.getElementById("btn-save-admin").innerText = "Update";
  document
    .getElementById("btn-save-admin")
    .classList.replace("bg-gray-800", "bg-green-600");
  document.getElementById("btn-cancel-admin").classList.remove("hidden");
  document.getElementById("admin-form-title").innerText = "Edit Data";

  if (currentAdminSheet === "Siswa") {
    document.getElementById("adm-Nama").value = row["Nama"];
    document.getElementById("adm-Kelas").value = row["Kelas"];
    document.getElementById("adm-Jenis Kelamin").value = row["Jenis Kelamin"];
  } else if (currentAdminSheet === "Kelas") {
    document.getElementById("adm-Nama Kelas").value = row["Nama Kelas"];
    document.getElementById("adm-Wali Kelas").value = row["Wali Kelas"];
  } else if (currentAdminSheet === "Mapel") {
    document.getElementById("adm-Nama Mapel").value = row["Nama Mapel"];
    document.getElementById("adm-Guru").value = row["Guru"];
  } else if (currentAdminSheet === "Jadwal") {
    document.getElementById("adm-Hari").value = row["Hari"];
    document.getElementById("adm-Kelas").value = row["Kelas"];
    document.getElementById("adm-Mapel").value = row["Mapel"];
    const [h1, m1] = (row["Jam Mulai"] || "00:00").split(":");
    const [h2, m2] = (row["Jam Selesai"] || "00:00").split(":");
    document.getElementById("adm-h1").value = h1;
    document.getElementById("adm-m1").value = m1;
    document.getElementById("adm-h2").value = h2;
    document.getElementById("adm-m2").value = m2;
  }
  document.getElementById("admin").scrollIntoView();
}

function resetAdminForm() {
  document.getElementById("adm-edit-index").value = "-1";
  document.getElementById("btn-save-admin").innerText = "Simpan";
  document
    .getElementById("btn-save-admin")
    .classList.replace("bg-green-600", "bg-gray-800");
  document.getElementById("btn-cancel-admin").classList.add("hidden");
  document.getElementById("admin-form-title").innerText =
    "Input " + currentAdminSheet;
  document
    .querySelectorAll("#admin-dynamic-inputs input")
    .forEach((i) => (i.value = ""));
  document
    .querySelectorAll("#admin-dynamic-inputs select")
    .forEach((s) => (s.selectedIndex = 0));
}

async function submitAdminData() {
  let data = {};
  if (currentAdminSheet === "Siswa") {
    data["Nama"] = document.getElementById("adm-Nama").value;
    data["Kelas"] = document.getElementById("adm-Kelas").value;
    data["Jenis Kelamin"] = document.getElementById("adm-Jenis Kelamin").value;
  } else if (currentAdminSheet === "Mapel") {
    data["Nama Mapel"] = document.getElementById("adm-Nama Mapel").value;
    data["Guru"] = document.getElementById("adm-Guru").value;
  } else if (currentAdminSheet === "Kelas") {
    data["Nama Kelas"] = document.getElementById("adm-Nama Kelas").value;
    data["Wali Kelas"] = document.getElementById("adm-Wali Kelas").value;
  } else if (currentAdminSheet === "Jadwal") {
    data["Hari"] = document.getElementById("adm-Hari").value;
    data["Kelas"] = document.getElementById("adm-Kelas").value;
    data["Mapel"] = document.getElementById("adm-Mapel").value;
    data["Jam Mulai"] =
      `${document.getElementById("adm-h1").value}:${document.getElementById("adm-m1").value}`;
    data["Jam Selesai"] =
      `${document.getElementById("adm-h2").value}:${document.getElementById("adm-m2").value}`;
  }

  const editIndex = document.getElementById("adm-edit-index").value;
  showLoading(editIndex === "-1" ? "Menyimpan..." : "Memperbarui...");

  try {
    if (editIndex === "-1") {
      await runAPI("addData", { sheet: currentAdminSheet, data: data }, true);
    } else {
      await runAPI(
        "updateData",
        { sheet: currentAdminSheet, rowIndex: editIndex, data: data },
        true,
      );
    }
    showToast(editIndex === "-1" ? "Tersimpan!" : "Diperbarui!");
    resetAdminForm();
    refreshAdminTable();
  } finally {
    hideLoading();
  }
}
