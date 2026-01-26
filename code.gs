/**
 * BACKEND: Code.gs (API MODE)
 * Deploy ini sebagai Web App:
 * 1. Klik "Deploy" > "New Deployment"
 * 2. Select type: "Web App"
 * 3. Execute as: "Me" (Saya)
 * 4. Who has access: "Anyone" (Siapa saja) -> PENTING agar frontend luar bisa akses
 */

const SHEET_ID = ""; // Masukkan ID Spreadsheet jika script terpisah dari sheet

function getDb() {
  return SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * HANDLE GET REQUESTS (Read Data)
 * Tidak butuh LockService karena hanya membaca.
 */
function doGet(e) {
  const action = e.parameter.action;
  const sheetName = e.parameter.sheet;

  let result = {};

  try {
    if (action === "getDashboardData") {
      result = getDashboardData();
    } else if (action === "getData") {
      result = getData(sheetName);
    } else {
      result = { error: "Action not found" };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return responseJSON(result);
}

/**
 * HANDLE POST REQUESTS (Create, Update, Delete)
 * Menggunakan LockService untuk mencegah data bentrok (Concurrency Control).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Tunggu maksimal 10 detik untuk mendapatkan giliran edit
  // Jika server sangat sibuk, dia akan return error timeout
  if (!lock.tryLock(10000)) {
    return responseJSON({
      success: false,
      message: "Server sibuk (Data Collision). Silakan coba lagi.",
    });
  }

  let result = {};

  try {
    const jsonString = e.postData.contents;
    if (!jsonString) throw new Error("No data received");

    const params = JSON.parse(jsonString);
    const action = params.action;

    if (action === "addData") {
      result = addData(params.sheet, params.data);
    } else if (action === "updateData") {
      result = updateData(params.sheet, params.rowIndex, params.data);
    } else if (action === "deleteData") {
      result = deleteData(params.sheet, params.rowIndex);
    } else if (action === "submitPresensiBatch") {
      result = submitPresensiBatch(params.data);
    } else if (action === "upsertGrades") {
      result = upsertGrades(params.data);
    } else {
      result = { success: false, message: "Unknown action" };
    }
  } catch (err) {
    result = { success: false, message: err.toString() };
  } finally {
    // Selalu lepaskan lock, sukses ataupun gagal
    lock.releaseLock();
  }

  return responseJSON(result);
}

/**
 * Helper untuk return JSON
 */
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// --- FUNGSI LOGIKA (DATA ACCESS LAYER) ---

function getData(sheetName) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  const headers = data.shift();
  return data.map((row, idx) => {
    let obj = { _rowIndex: idx };
    headers.forEach((header, index) => {
      let val = row[index];
      if (val instanceof Date) {
        const format = val.getFullYear() < 1900 ? "HH:mm" : "yyyy-MM-dd";
        val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), format);
      }
      obj[header] = val;
    });
    return obj;
  });
}

function addData(sheetName, dataObj) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "Sheet tidak ditemukan" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let row = [];
  headers.forEach((header) => {
    if (header === "Timestamp") row.push(new Date());
    else row.push(dataObj[header] || "");
  });
  sheet.appendRow(row);
  return { success: true, message: "Data berhasil disimpan" };
}

function updateData(sheetName, rowIndex, dataObj) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  const actualRow = parseInt(rowIndex) + 2;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  let row = [];
  headers.forEach((header) => {
    if (header === "Timestamp") row.push(new Date());
    else row.push(dataObj[header] || "");
  });
  sheet.getRange(actualRow, 1, 1, row.length).setValues([row]);
  return { success: true, message: "Data berhasil diperbarui" };
}

function deleteData(sheetName, rowIndex) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  sheet.deleteRow(parseInt(rowIndex) + 2);
  return { success: true, message: "Data berhasil dihapus" };
}

function getDashboardData() {
  const jadwal = getData("Jadwal");
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const today = days[new Date().getDay()];
  const jadwalHariIni = jadwal.filter((j) => j["Hari"] === today);
  jadwalHariIni.sort((a, b) =>
    String(a["Jam Mulai"] || "").localeCompare(String(b["Jam Mulai"] || "")),
  );
  return { today: today, jadwal: jadwalHariIni };
}

function submitPresensiBatch(dataList) {
  const ss = getDb();
  const sheet = ss.getSheetByName("Presensi");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let rowsToAppend = [];
  dataList.forEach((data) => {
    let row = [];
    headers.forEach((h) => {
      if (h === "Timestamp") row.push(new Date());
      else row.push(data[h] || "");
    });
    rowsToAppend.push(row);
  });
  if (rowsToAppend.length > 0)
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  return { success: true };
}

function upsertGrades(grades) {
  const ss = getDb();
  const sheet = ss.getSheetByName("Penilaian");
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const h = {};
  headers.forEach((col, i) => (h[col] = i));

  let values = [];
  if (lastRow > 1)
    values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rowMap = new Map();
  values.forEach((row, i) => {
    const key = `${row[h["Kelas"]]}|${row[h["Mapel"]]}|${row[h["Jenis"]]}|${row[h["Order"]]}|${row[h["Nama Siswa"]]}`;
    rowMap.set(key, i + 2);
  });

  let rowsToAppend = [];
  grades.forEach((g) => {
    const key = `${g.Kelas}|${g.Mapel}|${g.Jenis}|${g.Order}|${g["Nama Siswa"]}`;
    if (rowMap.has(key)) {
      const rowNum = rowMap.get(key);
      if (h["Nilai"] !== undefined)
        sheet.getRange(rowNum, h["Nilai"] + 1).setValue(g.Nilai);
      if (h["Catatan"] !== undefined)
        sheet.getRange(rowNum, h["Catatan"] + 1).setValue(g.Catatan);
    } else {
      let newRow = [];
      headers.forEach((head) => {
        if (head === "Timestamp") newRow.push(new Date());
        else newRow.push(g[head] || "");
      });
      rowsToAppend.push(newRow);
    }
  });
  if (rowsToAppend.length > 1 && rowsToAppend.length > 0) {
    // Fix: Check > 1 was potentially limiting, changed to check data existence
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  } else if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  }
  return { success: true };
}
