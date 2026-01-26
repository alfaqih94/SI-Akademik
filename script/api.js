import { API_URL } from "./config.js";
import { showLoading, hideLoading, showToast } from "./ui.js";

export async function runAPI(action, params = {}, isPost = false) {
  try {
    let url = new URL(API_URL);
    let options = {
      method: "GET",
    };

    if (isPost) {
      options.method = "POST";
      options.body = JSON.stringify({ action, ...params });
      options.headers = {
        "Content-Type": "text/plain;charset=utf-8",
      };
    } else {
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
