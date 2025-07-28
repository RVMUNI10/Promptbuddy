let templates = [];

fetch('promptTemplates.json')
  .then(response => response.json())
  .then(data => {
    templates = data.templates;
    console.log('Prompt templates loaded:', templates);
  })
  .catch(error => console.error('Error loading prompt templates:', error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'prompt') {
    const originalPrompt = request.text;
    const enhancedPrompt = enhancePrompt(originalPrompt);
    chrome.storage.local.set({ originalPrompt, enhancedPrompt });
  }
});

function enhancePrompt(text) {
  if (!templates || templates.length === 0) {
    console.error('No templates loaded.');
    return text; // No templates loaded, return original text
  }

  for (const template of templates) {
    for (const keyword of template.keywords) {
      if (text.toLowerCase().includes(keyword)) {
        // This is a simple placeholder replacement. A more advanced implementation
        // would use NLP to extract the relevant information from the original prompt.
        let enhanced = template.template;
        const placeholders = enhanced.match(/\{(\w+)\}/g);
        if (placeholders) {
          placeholders.forEach(placeholder => {
            const key = placeholder.slice(1, -1);
            enhanced = enhanced.replace(placeholder, `[${key}]`);
          });
        }
        return enhanced;
      }
    }
  }
  return text; // No match found
}
