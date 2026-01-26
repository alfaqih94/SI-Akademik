import { runAPI } from "./api.js";
import { showLoading, hideLoading, showToast, nav, updateClock } from "./ui.js";

// --- STATE MANAGEMENT ---
let rekapDataCache = {};
let currentRekapType = "Presensi";
let currentAdminSheet = "";
let adminDataCache = [];

// --- INITIALIZATION ---
window.onload = function () {
  updateClock();
  setInterval(updateClock, 1000);

  // Set default date input value to today
  document
    .querySelectorAll('input[type="date"]')
    .forEach((i) => (i.valueAsDate = new Date()));

  // Setup Navigation Listeners
  setupNavigation();

  // Load Initial Data
  refreshDashboard();
  loadDropdowns();
  loadJurnalHistory();
};

function setupNavigation() {
  // Hubungkan fungsi global ke window
  window.nav = nav;
  window.refreshDashboard = refreshDashboard;
  window.loadStudentsForPresensi = loadStudentsForPresensi;
  window.loadPresensiExisting = loadPresensiExisting; // NEW FUNCTION
  window.submitPresensi = submitPresensi;
  window.submitJurnal = submitJurnal;
  window.loadStudentsForNilai = loadStudentsForNilai;
  window.submitPenilaian = submitPenilaian;
  window.setRekapTab = setRekapTab;
  window.showRekapData = showRekapData;
  window.openDetailModal = openDetailModal;
  window.closeDetailModal = closeDetailModal;

  // Admin Functions
  window.showAdminForm = showAdminForm;
  window.refreshAdminTable = refreshAdminTable;
  window.resetAdminForm = resetAdminForm;
  window.submitAdminData = submitAdminData;
  window.editAdminRow = editAdminRow;
  window.deleteAdminRow = deleteAdminRow;
}

// --- DASHBOARD ---
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
        todayHtml += `<div class="bg-white p-3 rounded-lg shadow border-l-4 ${isActive ? "border-green-500 bg-green-50" : "border-blue-300"} flex justify-between items-center mb-2"><div><div class="font-bold text-gray-800 text-sm">${j.Mapel}</div><div class="text-xs text-gray-500">${j.Kelas}</div></div><div class="text-right"><div class="text-sm font-mono font-bold text-blue-600">${j["Jam Mulai"]}</div><div class="text-xs text-gray-400 text-[10px]">s.d ${j["Jam Selesai"]}</div></div></div>`;
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
      const journalInfo = lastEntry
        ? `<span class="text-gray-700">${lastEntry.Materi}</span>`
        : '<span class="italic text-gray-400">Belum ada jurnal</span>';
      elCurrent.innerHTML = `<div class="flex justify-between items-start"><div><p class="text-xl font-bold text-blue-800">${activeSchedule.Mapel}</p><p class="text-sm font-semibold text-gray-600">${activeSchedule.Kelas}</p></div><span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold animate-pulse">AKTIF</span></div><div class="mt-3 p-2 bg-blue-50 rounded border border-blue-100"><p class="text-[10px] text-blue-500 uppercase font-bold mb-1">Jurnal Terakhir</p><div class="text-xs line-clamp-2">${journalInfo}</div></div>`;
    } else {
      elCurrent.innerHTML = `<div class="text-center py-2"><p class="text-lg font-bold text-gray-400">Tidak ada KBM</p><p class="text-xs text-gray-400">Sedang istirahat atau pulang</p></div>`;
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
        allHtml += `<div class="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 uppercase mt-1">${sch.Hari}</div>`;
        lastDay = sch.Hari;
      }
      allHtml += `<div class="bg-white px-4 py-3 flex justify-between items-center hover:bg-gray-50"><div class="w-1/4 text-xs font-mono font-semibold text-gray-500">${sch["Jam Mulai"]}</div><div class="w-3/4 pl-2 border-l-2 border-gray-200"><div class="text-sm font-bold text-gray-800">${sch.Mapel}</div><div class="text-xs text-gray-500">${sch.Kelas}</div></div></div>`;
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

// --- PRESENSI ---
async function loadStudentsForPresensi() {
  const kelas = document.getElementById("presensi-kelas").value;
  if (!kelas) return;

  // Reset Tombol ke Default (Simpan) setiap ganti kelas
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
          <div class="bg-white p-3 rounded shadow flex items-center justify-between student-row" data-name="${s.Nama}">
            <div class="text-sm font-semibold w-1/3">${s.Nama}</div>
            <div class="flex space-x-1 w-2/3 justify-end text-[10px] font-bold">
              <label class="bg-green-100 px-2 py-2 rounded flex items-center cursor-pointer"><input type="radio" name="p-${i}" value="H" checked class="mr-1">H</label>
              <label class="bg-yellow-100 px-2 py-2 rounded flex items-center cursor-pointer"><input type="radio" name="p-${i}" value="S" class="mr-1">S</label>
              <label class="bg-blue-100 px-2 py-2 rounded flex items-center cursor-pointer"><input type="radio" name="p-${i}" value="I" class="mr-1">I</label>
              <label class="bg-red-100 px-2 py-2 rounded flex items-center cursor-pointer"><input type="radio" name="p-${i}" value="A" class="mr-1">A</label>
            </div>
          </div>`,
          )
          .join("")
      : '<div class="text-center">Tidak ada siswa</div>';
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

    // Filter data yang cocok
    const existing = allPresensi.filter((p) => {
      let pDate = p.Tanggal;
      // Handle format ISO dari sheet jika ada
      if (pDate && pDate.includes && pDate.includes("T"))
        pDate = pDate.split("T")[0];
      return pDate === tgl && p.Kelas === kelas && p.Mapel === mapel;
    });

    if (existing.length === 0) {
      showToast("Belum ada data tersimpan.");
      return;
    }

    // Map status ke UI
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

    // Ubah tampilan tombol Simpan menjadi Update
    const btn = document.getElementById("btn-submit-presensi");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-edit mr-2"></i> Update Presensi';
      // Ubah warna jadi Orange untuk indikasi Edit
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

    // Reset Button Style
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

// --- JURNAL ---
async function submitJurnal() {
  if (!document.getElementById("jurnal-kelas").value)
    return showToast("Lengkapi data");
  showLoading("Menyimpan...");
  try {
    let data = {};
    document
      .querySelectorAll(
        "#form-jurnal input, #form-jurnal select, #form-jurnal textarea",
      )
      .forEach((i) => (data[i.name] = i.value));
    await runAPI("addData", { sheet: "Jurnal", data: data }, true);
    showToast("Tersimpan");
    document.getElementById("form-jurnal").reset();
    document
      .querySelectorAll('input[type="date"]')
      .forEach((i) => (i.valueAsDate = new Date()));
    loadJurnalHistory();
  } finally {
    hideLoading();
  }
}

async function loadJurnalHistory() {
  try {
    const data = await runAPI("getData", { sheet: "Jurnal" });
    document.getElementById("jurnal-history").innerHTML = data
      .slice(-2)
      .reverse()
      .map(
        (j) =>
          `<div class="bg-white border-l-4 border-purple-500 p-2 rounded shadow text-xs"><div class="font-bold">${j.Kelas} - ${j.Mapel}</div><div class="text-gray-500">${new Date(j.Tanggal).toLocaleDateString("id-ID")} | ${j.Materi}</div></div>`,
      )
      .join("");
  } catch (e) {}
}

// --- PENILAIAN ---
async function loadStudentsForNilai() {
  const kelas = document.getElementById("nilai-kelas").value;
  if (!kelas) return;
  showLoading("Memuat Nilai...");
  try {
    const [students, allGrades] = await Promise.all([
      runAPI("getData", { sheet: "Siswa" }),
      runAPI("getData", { sheet: "Penilaian" }),
    ]);

    const classStudents = students.filter((s) => s.Kelas == kelas);
    const mapel = document.getElementById("nilai-mapel").value;
    const jenis = document.getElementById("nilai-jenis").value;
    const order = document.getElementById("nilai-order").value;

    const existingGrades = allGrades.filter(
      (g) =>
        g.Kelas == kelas &&
        g.Mapel == mapel &&
        g.Jenis == jenis &&
        g.Order == order,
    );
    const gradeMap = {};
    existingGrades.forEach((g) => {
      gradeMap[g["Nama Siswa"]] = g.Nilai;
      if (g.Catatan) document.getElementById("nilai-catatan").value = g.Catatan;
    });

    document.getElementById("nilai-student-list").innerHTML = classStudents
      .map((s) => {
        const val = gradeMap[s.Nama] !== undefined ? gradeMap[s.Nama] : "";
        return `<div class="p-2 rounded shadow flex items-center justify-between student-nilai-row ${val !== "" ? "bg-green-50" : ""}" data-name="${s.Nama}"><span class="text-sm font-semibold w-1/2">${s.Nama}</span><input type="number" value="${val}" placeholder="Nilai" class="w-1/3 border rounded p-2 text-right"></div>`;
      })
      .join("");
    document.getElementById("btn-submit-nilai").classList.remove("hidden");
  } finally {
    hideLoading();
  }
}

async function submitPenilaian() {
  showLoading("Menyimpan...");
  try {
    const data = Array.from(document.querySelectorAll(".student-nilai-row"))
      .filter((r) => r.querySelector("input").value !== "")
      .map((row) => ({
        Tanggal: document.getElementById("nilai-date").value,
        Kelas: document.getElementById("nilai-kelas").value,
        Mapel: document.getElementById("nilai-mapel").value,
        Jenis: document.getElementById("nilai-jenis").value,
        Order: document.getElementById("nilai-order").value,
        Catatan: document.getElementById("nilai-catatan").value,
        "Nama Siswa": row.getAttribute("data-name"),
        Nilai: row.querySelector("input").value,
      }));

    await runAPI("upsertGrades", { data: data }, true);
    showToast("Tersimpan");
    nav("rekap");
  } finally {
    hideLoading();
  }
}

// --- REKAP ---
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

// --- ADMIN ---
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

async function deleteAdminRow(index) {
  if (!confirm("Hapus data?")) return;
  showLoading("Menghapus...");
  try {
    await runAPI(
      "deleteData",
      {
        sheet: currentAdminSheet,
        rowIndex: adminDataCache[index]["_rowIndex"],
      },
      true,
    );
    refreshAdminTable();
    showToast("Terhapus");
  } finally {
    hideLoading();
  }
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
