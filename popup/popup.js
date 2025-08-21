document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-button");
  const settingsBtn = document.getElementById("settings-button");

  // Launch the PB dock in the active tab and close the popup
  openBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: "POPUP_LAUNCH" }, () => window.close());
  };

  // Open the extension's Settings page
  settingsBtn.onclick = () => chrome.runtime.openOptionsPage();
});
