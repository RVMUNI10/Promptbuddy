document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const saveButton = document.getElementById('save-button');
  const statusMessage = document.getElementById('status-message');

  // Load the saved API key
  chrome.storage.sync.get('apiKey', (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    chrome.storage.sync.set({ apiKey }, () => {
      statusMessage.textContent = 'API key saved!';
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 2000);
    });
  });
});
