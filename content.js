let typingTimer;
const doneTypingInterval = 1000; // 1 second

function handleInput(event) {
  clearTimeout(typingTimer);
  const text = event.target.value;
  if (text) {
    typingTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'prompt', text });
    }, doneTypingInterval);
  }
}

document.addEventListener('input', (event) => {
  if (event.target.tagName.toLowerCase() === 'textarea' || event.target.isContentEditable) {
    handleInput(event);
  }
});

console.log("Content script loaded and listening for input.");
