chrome.runtime.sendMessage({action:'restoreGroup', url:window.location}, (response) => {
  console.log('received response', response);
  chrome.tabs.getCurrent().then(tab => {
    chrome.tabs.goBack(tab.id)
    .error(() => {
      chrome.tabs.remove(tab.id);
    })
  })
});
