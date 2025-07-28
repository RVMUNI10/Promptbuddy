document.addEventListener('DOMContentLoaded', () => {
  const originalPromptElement = document.getElementById('original-prompt');
  const enhancedPromptElement = document.getElementById('enhanced-prompt');
  const copyButton = document.getElementById('copy-button');

  chrome.storage.local.get(['originalPrompt', 'enhancedPrompt'], (result) => {
    originalPromptElement.textContent = result.originalPrompt || 'No prompt detected.';
    enhancedPromptElement.textContent = result.enhancedPrompt || 'No enhancement available.';

    if (result.enhancedPrompt && result.enhancedPrompt.startsWith('Error: API key not set.')) {
      const settingsButton = document.createElement('button');
      settingsButton.textContent = 'Open Settings';
      settingsButton.className = 'mt-2 bg-red-500 text-white px-4 py-2 rounded-md';
      settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
      enhancedPromptElement.appendChild(settingsButton);
    }
  });

  copyButton.addEventListener('click', () => {
    const enhancedPrompt = enhancedPromptElement.textContent;
    if (enhancedPrompt && !enhancedPrompt.startsWith('Error:')) {
      navigator.clipboard.writeText(enhancedPrompt)
        .then(() => {
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = 'Copy Enhanced Prompt';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    }
  });
});
