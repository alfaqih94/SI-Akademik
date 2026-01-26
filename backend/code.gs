const SHEET_ID = "1X-BxQkAP0HTkNh8vNma0k3yVVL5gy3zyiBWIocK9Jgw";

function getDb() {
  return SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

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

function doPost(e) {
  const lock = LockService.getScriptLock();
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
      result = deleteData(params.sheet, params.rowIndex); // Pastikan ini ada
    } else if (action === "submitPresensiBatch") {
      result = submitPresensiBatch(params.data);
    } else if (action === "upsertGrades") {
      result = upsertGrades(params.data);
    } else {
      result = { success: false, message: "Unknown action: " + action };
    }
  } catch (err) {
    result = { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }

  return responseJSON(result);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function getData(sheetName) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  const headers = data.shift();
  return data.map((row, idx) => {
    // PENTING: _rowIndex harus ada agar frontend tahu baris mana yang diedit/hapus
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
function deleteData(sheetName, rowIndex) {
  const ss = getDb();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "Sheet tidak ditemukan" };
  const actualRow = parseInt(rowIndex) + 2;
  try {
    sheet.deleteRow(actualRow);
    return { success: true, message: "Data berhasil dihapus" };
  } catch (e) {
    return { success: false, message: "Gagal menghapus: " + e.toString() };
  }
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
    let tgl = row[h["Tanggal"]];
    if (tgl instanceof Date)
      tgl = Utilities.formatDate(
        tgl,
        ss.getSpreadsheetTimeZone(),
        "yyyy-MM-dd",
      );
    const key = `${tgl}|${row[h["Kelas"]]}|${row[h["Mapel"]]}|${row[h["Siswa"]]}`;
    rowMap.set(key, i + 2);
  });

  let rowsToAppend = [];
  dataList.forEach((d) => {
    const key = `${d.Tanggal}|${d.Kelas}|${d.Mapel}|${d.Siswa}`;
    if (rowMap.has(key)) {
      const rowNum = rowMap.get(key);
      if (h["Status"] !== undefined)
        sheet.getRange(rowNum, h["Status"] + 1).setValue(d.Status);
      if (h["Timestamp"] !== undefined)
        sheet.getRange(rowNum, h["Timestamp"] + 1).setValue(new Date());
    } else {
      let row = [];
      headers.forEach((head) => {
        if (head === "Timestamp") row.push(new Date());
        else row.push(d[head] || "");
      });
      rowsToAppend.push(row);
    }
  });

  if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  }
  return {
    success: true,
    message: "Data presensi berhasil disimpan/diperbarui",
  };
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
  if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length)
      .setValues(rowsToAppend);
  }
  return { success: true };
}
