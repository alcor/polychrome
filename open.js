chrome.runtime.sendMessage('restoreGroup', (response) => {
  console.log('received response', response);
});
