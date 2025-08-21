// background.js — simplified PromptBuddy backend
// Supports: POPUP_LAUNCH, PB_SHOW_DOCK, PB_OPEN_MODAL, PB_SUGGEST_QS (no cap), PB_ENHANCE
console.log("✅ background.js loaded");

let OPENAI_API_KEY = "";
chrome.runtime.onInstalled.addListener(() => console.log("✅ Service worker installed."));
chrome.runtime.onStartup.addListener(() => console.log("🔄 Service worker restarted."));

chrome.storage.local.get("OPENAI_API_KEY", (d) => {
  OPENAI_API_KEY = d.OPENAI_API_KEY || "";
  console.log("🔐 API key loaded:", OPENAI_API_KEY ? "✅ Set" : "❌ Missing");
});
chrome.storage.onChanged.addListener((c) => {
  if (c.OPENAI_API_KEY) {
    OPENAI_API_KEY = c.OPENAI_API_KEY.newValue || "";
    console.log("🔁 API key updated.");
  }
});

// Ensure content.js is available in the tab, then send it a message
async function ensureCSandSend(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PB_PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"]
    });
  }
  await chrome.tabs.sendMessage(tabId, message);
}

// Popup → show dock button on the page
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.type === "POPUP_LAUNCH") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await ensureCSandSend(tab.id, { type: "PB_SHOW_DOCK" });
      sendResponse({ ok: true });
    })();
    return true;
  }

  // Suggest a natural-length list of clarifying questions (no fixed cap)
  if (req?.type === "PB_SUGGEST_QS") {
    (async () => {
      try {
        const qs = await suggestQuestions(req.source || "");
        sendResponse({ ok: true, questions: qs });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  // Enhance (build final prompt)
  if (req?.type === "PB_ENHANCE") {
    (async () => {
      try {
        const text = await enhanceWithAI(buildPromptFromPayload(req.payload || {}));
        await chrome.storage.local.set({
          originalPrompt: req?.payload?.source || "",
          enhancedPrompt: text
        });
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true; // keep message channel open
  }
});

// Keyboard shortcut → open modal directly
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-prompt-buddy" && tab?.id) {
    await ensureCSandSend(tab.id, { type: "PB_OPEN_MODAL" });
  }
});

// ---------- Prompt assembly ----------
function buildPromptFromPayload(p = {}) {
  const { source = "", followups = [] } = p;

  const qaLines = (followups || [])
    .filter(x => (x.q || x.a))
    .map((x, i) => `- Q${i + 1}: ${x.q || "(unspecified)"}\n  A${i + 1}: ${x.a || "(unspecified)"}`)
    .join("\n");

  return [
    `You are Prompt Buddy. Turn the user's raw prompt and any follow-up Q/A into a final, high-quality prompt suitable for an LLM.`,
    `Rules:`,
    `- Include: concise role, clear objective, key assumptions, constraints, and explicit output format when implied.`,
    `- Be concrete and free of fluff.`,
    `- If key info is still missing, include up to 3 short, targeted follow-up questions at the end.`,
    ``,
    `# Raw Prompt`,
    source || "(none provided)",
    ``,
    `# Follow-ups (Q/A)`,
    qaLines || "(none)",
    ``,
    `# Return`,
    `Only the final improved prompt (Markdown allowed).`
  ].join("\n");
}

// ---------- OpenAI calls ----------
async function enhanceWithAI(promptText) {
  if (!OPENAI_API_KEY) throw new Error("API key not set in settings.");

  const system = `You are PromptBuddy, an expert prompt engineer focused on designing, analyzing, and refining prompts.
Return complete, actionable prompts that specify: role, objective, constraints, and explicit output format.
Ask follow-up questions only if critical details are missing. Created by: Raj Muni.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: promptText }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty response from model.");
  return out;
}

// Natural-length list of clarifying questions (no fixed cap). Returns array of strings.
async function suggestQuestions(sourceText) {
  if (!OPENAI_API_KEY) throw new Error("API key not set in settings.");
  if (!sourceText) return [];

  const system = `You suggest only the essential clarifying questions that are missing from a user's prompt.
Return ONLY a JSON array of short, precise questions. Do NOT impose a count limit; include however many are truly necessary.`;
  const user = `Raw prompt:\n${sourceText}\n\nReturn a JSON array of short clarifying questions (no explanations).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

  let text = data?.choices?.[0]?.message?.content?.trim() || "[]";
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) return obj.map(String);
    if (Array.isArray(obj?.questions)) return obj.questions.map(String);
  } catch (_) {}
  return [];
}
