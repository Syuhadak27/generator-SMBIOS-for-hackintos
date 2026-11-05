(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const statusDot = $("statusDot");
  const statusText = $("statusText");
  const genForm = $("genForm");
  const genBtn = $("genBtn");
  const modelInput = $("model");
  const countInput = $("count");
  const argsInput = $("args");
  const modelList = $("modelList");
  const resultsEl = $("results");
  const genBadge = $("genBadge");

  const uuidValue = $("uuidValue");
  const romValue = $("romValue");
  const romPrefix = $("romPrefix");

  const plistFile = $("plistFile");
  const plistType = $("plistType");
  const plistBadge = $("plistBadge");

  const modelSearch = $("modelSearch");
  const modelTable = $("modelTable");
  const footerVersion = $("footerVersion");
  const toastEl = $("toast");

  const state = {
    models: [],
    results: [],
  };

  let toastTimer = null;

  function toast(message, kind = "") {
    toastEl.textContent = message;
    toastEl.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.className = "toast";
    }, 4200);
  }

  async function api(path, { method = "GET", body } = {}) {
    const options = { method };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(path, options);
    let data = null;
    if ((res.headers.get("content-type") || "").includes("application/json")) {
      data = await res.json().catch(() => null);
    }
    if (!res.ok) {
      throw new Error((data && data.error) || "Permintaan gagal (HTTP " + res.status + ").");
    }
    return data;
  }

  async function copyText(text) {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      toast("Disalin ke clipboard.", "ok");
    } catch (err) {
      toast("Gagal menyalin: " + err.message, "error");
    }
  }

  function setBusy(button, busy, busyLabel) {
    if (busy) {
      button.dataset.label = button.textContent;
      button.innerHTML =
        '<span class="spinner"></span><span>' + (busyLabel || "Memproses…") + "</span>";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  function makeButton(label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn " + className;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function filenameFromResponse(res, fallback) {
    const header = res.headers.get("content-disposition") || "";
    const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (encoded) {
      try {
        return decodeURIComponent(encoded[1]);
      } catch (_) {
        /* ignore */
      }
    }
    const plain = header.match(/filename="?([^";]+)"?/i);
    return plain ? plain[1] : fallback;
  }

  function copyAllText(entry) {
    return [
      "Type:         " + entry.model,
      "Serial:       " + entry.serial,
      "Board Serial: " + entry.board_serial,
      "SmUUID:       " + entry.uuid,
      "Apple ROM:    " + entry.rom,
    ].join("\n");
  }

  function renderResults() {
    resultsEl.className = "results";
    resultsEl.replaceChildren();

    if (!state.results.length) {
      resultsEl.className = "results empty";
      const p = document.createElement("p");
      p.textContent = "Belum ada hasil. Pilih model lalu tekan Generate.";
      resultsEl.appendChild(p);
      return;
    }

    state.results.forEach((entry, index) => {
      const card = document.createElement("article");
      card.className = "result";

      const head = document.createElement("div");
      head.className = "result-head";

      const title = document.createElement("div");
      title.className = "result-title";
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = entry.model;
      const num = document.createElement("span");
      num.className = "muted small";
      num.textContent = "#" + (index + 1);
      title.append(tag, num);

      const actions = document.createElement("div");
      actions.className = "result-actions";
      actions.appendChild(makeButton("Salin semua", "ghost small", () => copyText(copyAllText(entry))));
      actions.appendChild(makeButton("Terapkan ke plist", "apply small", (e) => applyPlist(entry, e.currentTarget)));

      head.append(title, actions);

      const dl = document.createElement("dl");
      dl.className = "rows";

      const rows = [
        ["Serial", entry.serial],
        ["Board Serial", entry.board_serial],
        ["SmUUID", entry.uuid],
        ["Apple ROM", entry.rom],
      ];

      rows.forEach(([label, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        const copy = makeButton("Salin", "ghost small copy", () => copyText(value));
        dl.append(dt, dd, copy);
      });

      card.append(head, dl);
      resultsEl.appendChild(card);
    });
  }

  function renderModels(query = "") {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? state.models.filter(
          (m) =>
            m.model.toLowerCase().includes(needle) ||
            String(m.years || "").toLowerCase().includes(needle)
        )
      : state.models;

    modelTable.replaceChildren();

    if (!state.models.length) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.style.padding = "14px";
      p.textContent = "Daftar model tidak tersedia (MacSerial belum terpasang).";
      modelTable.appendChild(p);
      return;
    }

    if (!filtered.length) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.style.padding = "14px";
      p.textContent = "Tidak ada model yang cocok.";
      modelTable.appendChild(p);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((item) => {
      const row = document.createElement("div");
      row.className = "model-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.title = "Gunakan " + item.model;

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.model;

      const years = document.createElement("span");
      years.className = "years";
      years.textContent = item.years ? item.years : "";

      const choose = () => {
        modelInput.value = item.model;
        modelInput.focus();
        toast("Model dipilih: " + item.model, "ok");
      };

      row.addEventListener("click", choose);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      });

      row.append(name, years);
      fragment.appendChild(row);
    });
    modelTable.appendChild(fragment);
  }

  async function loadStatus() {
    try {
      const data = await api("/api/status");
      if (data.ok) {
        statusDot.className = "dot ok";
        statusText.textContent =
          "MacSerial v" + (data.version || "?") + " · " + data.models + " model";
        footerVersion.textContent = "macserial " + (data.version || "?") + " · " + data.macserial;
        genBadge.textContent = "Siap";
        genBadge.className = "badge good";
      } else {
        statusDot.className = "dot bad";
        statusText.textContent = "MacSerial tidak ditemukan";
        footerVersion.textContent = "macserial tidak ditemukan";
        genBadge.textContent = "Butuh MacSerial";
        genBadge.className = "badge warn";
      }
    } catch (err) {
      statusDot.className = "dot bad";
      statusText.textContent = "Server tidak merespons";
      toast(err.message, "error");
    }
  }

  async function loadModels() {
    try {
      const data = await api("/api/models");
      state.models = Array.isArray(data.models) ? data.models : [];
      modelList.replaceChildren();
      state.models.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.model;
        option.label = item.years ? item.model + " (" + item.years + ")" : item.model;
        modelList.appendChild(option);
      });
      renderModels(modelSearch.value);
    } catch (err) {
      renderModels();
      toast("Gagal memuat daftar model: " + err.message, "error");
    }
  }

  async function applyPlist(entry, button) {
    const file = plistFile.files && plistFile.files[0];
    if (!file) {
      toast("Pilih file config.plist terlebih dahulu.", "error");
      plistFile.focus();
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Menerapkan…";

    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch("/api/plist/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content: arrayBufferToBase64(buffer),
          type: plistType.value,
          values: {
            model: entry.model,
            serial: entry.serial,
            board_serial: entry.board_serial,
            uuid: entry.uuid,
            rom: entry.rom,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "Gagal menerapkan ke plist.");
      }

      const blob = await res.blob();
      downloadBlob(blob, filenameFromResponse(res, file.name));
      toast("config.plist diperbarui dan diunduh.", "ok");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  genForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const model = modelInput.value.trim();
    if (!model) {
      toast("Isi nama model terlebih dahulu.", "error");
      modelInput.focus();
      return;
    }

    setBusy(genBtn, true, "Generate…");
    try {
      const data = await api("/api/generate", {
        method: "POST",
        body: {
          model,
          count: Number(countInput.value) || 1,
          args: argsInput.value.trim(),
        },
      });
      state.results = data.entries;
      renderResults();
      toast(state.results.length + " entri SMBIOS dibuat.", "ok");
    } catch (err) {
      state.results = [];
      renderResults();
      toast(err.message, "error");
    } finally {
      setBusy(genBtn, false);
    }
  });

  $("uuidBtn").addEventListener("click", async () => {
    try {
      const data = await api("/api/uuid", { method: "POST", body: {} });
      uuidValue.textContent = data.uuid;
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("romBtn").addEventListener("click", async () => {
    try {
      const data = await api("/api/rom", {
        method: "POST",
        body: { prefix: romPrefix.checked },
      });
      romValue.textContent = data.rom;
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const target = $(button.dataset.copy);
    if (target) copyText(target.textContent.trim());
  });

  modelSearch.addEventListener("input", () => renderModels(modelSearch.value));

  plistFile.addEventListener("change", async () => {
    const file = plistFile.files && plistFile.files[0];
    if (!file) {
      plistBadge.textContent = "Belum ada file";
      plistBadge.className = "badge";
      plistType.value = "auto";
      return;
    }

    plistBadge.textContent = "Memeriksa…";
    plistBadge.className = "badge";
    try {
      const raw = await file.arrayBuffer();
      const res = await fetch("/api/plist/inspect", { method: "POST", body: raw });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Plist tidak bisa dibaca.");
      }
      const label = data.type === "opencore" ? "OpenCore" : data.type === "clover" ? "Clover" : "Tipe tidak dikenal";
      plistBadge.textContent = file.name + " · " + label;
      plistBadge.className = "badge " + (data.type ? "good" : "warn");
      if (data.type && plistType.value === "auto") {
        plistType.value = data.type;
      }
    } catch (err) {
      plistBadge.textContent = file.name + " · tidak valid";
      plistBadge.className = "badge warn";
      toast(err.message, "error");
    }
  });

  loadStatus();
  loadModels();
  api("/api/uuid", { method: "POST", body: {} })
    .then((data) => {
      uuidValue.textContent = data.uuid;
    })
    .catch(() => {});
  api("/api/rom", { method: "POST", body: { prefix: true } })
    .then((data) => {
      romValue.textContent = data.rom;
    })
    .catch(() => {});
})();
