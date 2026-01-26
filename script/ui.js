export function showLoading(msg = "Memproses...") {
  const elText = document.getElementById("loading-text");
  const elOverlay = document.getElementById("loading-overlay");
  if (elText) elText.innerText = msg;
  if (elOverlay) elOverlay.style.display = "flex";
}

export function hideLoading() {
  const elOverlay = document.getElementById("loading-overlay");
  if (elOverlay) elOverlay.style.display = "none";
}

export function showToast(msg) {
  const toast = document.getElementById("toast-container");
  const msgEl = document.getElementById("toast-message");
  if (msgEl && toast) {
    msgEl.innerText = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.remove("opacity-0"), 10);
    setTimeout(() => {
      toast.classList.add("opacity-0");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 3000);
  }
}

export function nav(sectionId) {
  document
    .querySelectorAll(".page-section")
    .forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active");

  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active", "text-blue-600"));

  const ids = [
    "dashboard",
    "presensi",
    "jurnal",
    "penilaian",
    "rekap",
    "admin",
  ];
  const idx = ids.indexOf(sectionId);
  const navItems = document.querySelectorAll(".nav-item");
  if (idx > -1 && navItems[idx])
    navItems[idx].classList.add("active", "text-blue-600");

  window.scrollTo(0, 0);
}

export function updateClock() {
  const elClock = document.getElementById("realtime-clock");
  const elDate = document.getElementById("realtime-date");
  if (!elClock || !elDate) return;

  const now = new Date();
  elClock.textContent =
    now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " WIB";
  elDate.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
