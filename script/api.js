import { API_URL } from "./config.js";
import { showLoading, hideLoading, showToast } from "./ui.js";

/**
 * Fetch Wrapper untuk berkomunikasi dengan Google Apps Script Web App
 * @param {string} action - Nama aksi (misal: 'getData', 'addData')
 * @param {object} params - Parameter tambahan (opsional)
 * @param {boolean} isPost - Jika true menggunakan POST, jika false menggunakan GET
 */
export async function runAPI(action, params = {}, isPost = false) {
  // showLoading(); // Loading bisa dihandle di level aplikasi jika ingin granular

  try {
    let url = new URL(API_URL);
    let options = {
      method: "GET",
    };

    if (isPost) {
      options.method = "POST";
      // GAS doPost menerima data via raw text di body
      options.body = JSON.stringify({ action, ...params });
      // Header khusus agar browser tidak mengirim preflight OPTIONS yang ribet untuk GAS
      options.headers = {
        "Content-Type": "text/plain;charset=utf-8",
      };
    } else {
      // Untuk GET, masukkan parameter ke URL query string
      url.searchParams.append("action", action);
      Object.keys(params).forEach((key) =>
        url.searchParams.append(key, params[key]),
      );
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) throw new Error(result.error);
    if (result.success === false)
      throw new Error(result.message || "Operasi gagal");

    return result;
  } catch (error) {
    console.error("API Error:", error);
    showToast("Error: " + error.message);
    throw error;
  } finally {
    // hideLoading();
  }
}
