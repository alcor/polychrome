chrome.runtime.sendMessage({action:'restoreGroup', url:window.location}, (response) => {
  console.log('received response', response);
});
