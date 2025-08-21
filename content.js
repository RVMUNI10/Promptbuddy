// content.js — Prompt Buddy (Raw Prompt + Follow-ups + Output) with unlimited suggested Qs
(() => {
  console.log("✅ content.js loaded");
  let dockBtn, host, shadow, ui, modalOpen = false, lastFocusedEl = null, suggestedOnce = false;

  // --- robust message sender (handles worker restarts) ---
  function sendMessageAck(message, { timeout = 30000, retries = 1 } = {}) {
    const attempt = () =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Timeout waiting for background response")), timeout);
        try {
          chrome.runtime.sendMessage(message, (res) => {
            clearTimeout(t);
            const err = chrome.runtime.lastError;
            if (err) reject(new Error(err.message));
            else resolve(res);
          });
        } catch (e) {
          clearTimeout(t);
          reject(e);
        }
      });

    return attempt().catch(async (err) => {
      const msg = (err?.message || "").toLowerCase();
      const transient = msg.includes("context invalidated") ||
                        msg.includes("receiving end does not exist") ||
                        msg.includes("could not establish connection");
      if (transient && retries > 0) {
        await new Promise((r) => setTimeout(r, 250));
        return sendMessageAck(message, { timeout, retries: retries - 1 });
      }
      throw err;
    });
  }

  // Respond to ping so background knows CS is present
  chrome.runtime.onMessage.addListener((m, _s, sendResponse) => {
    if (m?.type === "PB_PING") sendResponse({ ok: true });
  });

  const isEditable = (el) => el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
  const getValue = (el) => el ? (el.isContentEditable ? (el.innerText || el.textContent || "") : (el.value || "")) : "";
  const setValue = (el, text) => {
    if (!el) return;
    if (el.isContentEditable) {
      el.focus(); document.execCommand("selectAll", false, null); document.execCommand("insertText", false, text);
    } else {
      el.value = text; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true}));
    }
  };

  function ensureRoot() {
    if (host) return;
    host = document.createElement("div");
    host.id = "prompt-buddy-shadow-host";
    host.style.all = "initial";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    ui = document.createElement("div");
    shadow.appendChild(ui);

    const style = document.createElement("style");
    style.textContent = `
      .pb-dock{ position:fixed; right:16px; bottom:16px; width:44px; height:44px; border-radius:9999px; background:#111; color:#fff; border:1px solid #222; font-weight:700; box-shadow:0 10px 24px rgba(0,0,0,.25); cursor:pointer; }
      .pb-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.25); }
      .pb-modal{ position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:min(720px,92vw); background:#fff; color:#111; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.25); overflow:hidden; }
      .pb-header{ padding:14px 16px; border-bottom:1px solid #eee; display:flex; align-items:center; }
      .pb-title{ font-weight:700; font-size:14px; }
      .pb-close{ margin-left:auto; background:transparent; border:none; font-size:18px; cursor:pointer; }
      .pb-body{ padding:14px 16px; display:grid; gap:12px; max-height:70vh; overflow:auto; }
      .pb-textarea{ width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; font-size:13px; min-height:120px; }
      .pb-input{ width:100%; padding:8px; border:1px solid #ddd; border-radius:8px; font-size:13px; }
      .pb-followup{ display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:center; }
      .pb-followup .pb-del{ border:1px solid #e5e7eb; background:#fff; border-radius:8px; padding:6px 10px; cursor:pointer; }
      .pb-add, .pb-suggest{ border:1px solid #111; background:#fff; color:#111; border-radius:10px; padding:6px 10px; cursor:pointer; font-weight:600; }
      .pb-footer{ padding:12px 16px; border-top:1px solid #eee; display:flex; gap:8px; justify-content:space-between; align-items:center; }
      .pb-btn{ border:1px solid #111; background:#111; color:#fff; padding:8px 12px; border-radius:10px; font-weight:600; cursor:pointer; }
      .pb-btn.secondary{ background:#fff; color:#111; }
      .pb-btn.ghost{ border-color:#e5e7eb; background:#fff; color:#111; }
      .pb-result{ background:#fafafa; padding:10px; border-radius:10px; border:1px dashed #e5e7eb; white-space:pre-wrap; }
      .pb-row-hdr{ display:flex; justify-content:space-between; align-items:center; margin:6px 0; gap:8px; flex-wrap:wrap; }
    `;
    shadow.appendChild(style);
  }

  function showDock() {
    ensureRoot();
    if (dockBtn) { dockBtn.style.display = "block"; return; }
    dockBtn = document.createElement("button");
    dockBtn.id = "pb-dock";
    dockBtn.className = "pb-dock";
    dockBtn.textContent = "PB";
    dockBtn.title = "Open Prompt Buddy";
    dockBtn.addEventListener("click", openModal);
    ui.appendChild(dockBtn);
  }

  function openModal() {
    if (modalOpen) return;
    modalOpen = true;
    suggestedOnce = false;

    if (isEditable(document.activeElement)) lastFocusedEl = document.activeElement;
    const existing = getValue(lastFocusedEl);

    const backdrop = document.createElement("div");
    backdrop.className = "pb-backdrop";
    const modal = document.createElement("div");
    modal.className = "pb-modal";
    modal.innerHTML = `
      <div class="pb-header">
        <span class="pb-title">Prompt Buddy</span>
        <button class="pb-close" aria-label="Close">&times;</button>
      </div>
      <div class="pb-body">
        <div>
          <label style="font-size:12px;color:#555;">Raw Prompt</label>
          <textarea id="pb-source" class="pb-textarea" placeholder="Paste or type your initial prompt..."></textarea>
        </div>

        <div>
          <div class="pb-row-hdr">
            <label style="font-size:12px;color:#555;">Follow-up Questions & Answers</label>
            <div style="display:flex; gap:8px;">
              <button id="pb-suggest" class="pb-suggest">Suggest Qs</button>
              <button id="pb-add-qa" class="pb-add">+ Add Q/A</button>
            </div>
          </div>
          <div id="pb-followups" style="display:grid; gap:8px;"></div>
        </div>

        <div id="pb-result" class="pb-result" style="display:none"></div>
      </div>
      <div class="pb-footer">
        <div style="display:flex; gap:8px;">
          <button id="pb-generate" class="pb-btn">Generate</button>
          <button id="pb-insert" class="pb-btn secondary" disabled>Insert</button>
          <button id="pb-copy" class="pb-btn ghost" disabled>Copy</button>
        </div>
        <span style="font-size:11px; color:#6b7280;">Tip: focus a text field before Insert</span>
      </div>
    `;
    ui.append(backdrop, modal);

    const v = (s)=>modal.querySelector(s);
    v("#pb-source").value = existing || "";
    const close = ()=>{ modalOpen = false; backdrop.remove(); modal.remove(); };
    backdrop.addEventListener("click", close);
    v(".pb-close").addEventListener("click", close);

    // --- follow-ups UI ---
    const followupsEl = v("#pb-followups");
    const addQA = (q = "", a = "") => {
      const row = document.createElement("div");
      row.className = "pb-followup";
      row.innerHTML = `
        <input class="pb-input pb-q" placeholder="Question" value="${q.replace(/"/g,'&quot;')}"/>
        <input class="pb-input pb-a" placeholder="Answer" value="${a.replace(/"/g,'&quot;')}"/>
        <button class="pb-del" title="Remove">✕</button>
      `;
      row.querySelector(".pb-del").addEventListener("click", () => row.remove());
      followupsEl.appendChild(row);
    };

    v("#pb-add-qa").addEventListener("click", () => addQA());

    // Auto-suggest once after typing/pasting a prompt
    let suggestTimer = null;
    const triggerSuggest = () => {
      const src = v("#pb-source").value.trim();
      if (suggestedOnce || src.length < 12) return;
      suggestedOnce = true; // only once automatically
      v("#pb-suggest").click();
    };
    v("#pb-source").addEventListener("input", () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(triggerSuggest, 450);
    });

    // Manual suggest button (unlimited questions)
    v("#pb-suggest").addEventListener("click", async () => {
      const src = v("#pb-source").value.trim();
      if (!src) return;
      const btnS = v("#pb-suggest");
      btnS.disabled = true; btnS.textContent = "Suggesting…";
      try {
        const resp = await sendMessageAck({ type: "PB_SUGGEST_QS", source: src }, { timeout: 20000, retries: 1 });
        const questions = Array.isArray(resp?.questions) ? resp.questions : [];
        if (questions.length) {
          // Clear existing rows (optional)
          [...followupsEl.children].forEach(c => c.remove());
          questions.forEach(q => addQA(String(q), "")); // ← no cap here
        }
      } catch (e) {
        console.warn("Follow-up suggest failed:", e);
      } finally {
        btnS.disabled = false; btnS.textContent = "Suggest Qs";
      }
    });

    // --- actions ---
    v("#pb-generate").addEventListener("click", async () => {
      const payload = {
        source: v("#pb-source").value.trim(),
        followups: [...followupsEl.querySelectorAll(".pb-followup")].map(row => ({
          q: row.querySelector(".pb-q").value.trim(),
          a: row.querySelector(".pb-a").value.trim()
        })).filter(x => x.q || x.a)
      };

      const btn = v("#pb-generate");
      btn.disabled = true; btn.textContent = "Working…";

      try {
        const resp = await sendMessageAck({ type: "PB_ENHANCE", payload }, { timeout: 45000, retries: 1 });
        const box = v("#pb-result");
        box.style.display = "block";
        if (resp?.ok && resp.text) {
          box.textContent = resp.text;
          v("#pb-copy").disabled = false;
          v("#pb-insert").disabled = !!lastFocusedEl ? false : true;
        } else {
          box.textContent = `Error: ${resp?.error || "Unknown error"}`;
          v("#pb-copy").disabled = true;
          v("#pb-insert").disabled = true;
        }
      } catch (err) {
        const box = v("#pb-result");
        box.style.display = "block";
        box.textContent = `Error: ${err?.message || err}`;
        v("#pb-copy").disabled = true;
        v("#pb-insert").disabled = true;
      } finally {
        btn.disabled = false; btn.textContent = "Generate";
      }
    });

    v("#pb-copy").addEventListener("click", async () => {
      const txt = v("#pb-result").textContent || "";
      if (!txt) return;
      await navigator.clipboard.writeText(txt);
      v("#pb-copy").textContent = "Copied!";
      setTimeout(() => v("#pb-copy").textContent = "Copy", 1200);
    });

    v("#pb-insert").addEventListener("click", () => {
      const txt = v("#pb-result").textContent || "";
      if (!txt) return;
      setValue(lastFocusedEl, txt);
      close();
    });
  }

  // Messages from background / popup
  chrome.runtime.onMessage.addListener((m) => {
    if (!m) return;
    if (m.type === "PB_SHOW_DOCK") showDock();
    if (m.type === "PB_OPEN_MODAL" || m.type === "PROMPT_BUDDY_TOGGLE") openModal();
  });

  // Track focus (for Insert)
  document.addEventListener("focusin", (e) => { if (isEditable(e.target)) lastFocusedEl = e.target; }, true);
})();
