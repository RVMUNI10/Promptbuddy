document.addEventListener('DOMContentLoaded', () => {
  const originalPromptElement = document.getElementById('original-prompt');
  const enhancedPromptElement = document.getElementById('enhanced-prompt');
  const copyButton = document.getElementById('copy-button');

  chrome.storage.local.get(['originalPrompt', 'enhancedPrompt'], (result) => {
    originalPromptElement.textContent = result.originalPrompt || 'No prompt detected.';
    enhancedPromptElement.textContent = result.enhancedPrompt || 'No enhancement available.';
  });

  copyButton.addEventListener('click', () => {
    const enhancedPrompt = enhancedPromptElement.textContent;
    if (enhancedPrompt) {
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
