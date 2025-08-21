document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("apiKeyInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("statusMsg");

  chrome.storage.local.get("OPENAI_API_KEY", (data) => {
    if (data.OPENAI_API_KEY) input.value = data.OPENAI_API_KEY;
  });

  saveBtn.onclick = () => {
    const key = input.value.trim();
    if (!key.startsWith("sk-")) {
      status.textContent = "❌ Please enter a valid OpenAI API key (starts with sk-).";
      status.className = "text-sm text-red-600";
      return;
    }
    chrome.storage.local.set({ OPENAI_API_KEY: key }, () => {
      status.textContent = "✅ API key saved.";
      status.className = "text-sm text-green-600";
      setTimeout(() => (status.textContent = ""), 2500);
    });
  };
});
