chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'prompt') {
    const originalPrompt = request.text;
    chrome.storage.sync.get('apiKey', (data) => {
      if (data.apiKey) {
        enhancePromptWithOpenAI(originalPrompt, data.apiKey);
      } else {
        chrome.storage.local.set({ originalPrompt, enhancedPrompt: 'Error: API key not set.' });
      }
    });
  }
});

async function enhancePromptWithOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt: `Enhance the following prompt to be more structured and detailed:\n\n${prompt}`,
      max_tokens: 150
    })
  });

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    const enhancedPrompt = data.choices[0].text.trim();
    chrome.storage.local.set({ originalPrompt: prompt, enhancedPrompt });
  } else {
    chrome.storage.local.set({ originalPrompt: prompt, enhancedPrompt: 'Error: Failed to enhance prompt.' });
  }
}
