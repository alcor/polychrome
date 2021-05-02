var FOLDER_TITLE = 'Tabs'

chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed");
});

chrome.commands.onCommand.addListener(function(command) {
  console.log('Command:', command);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("message", message, sender)
  if (message === 'remove-duplicates') {
    removeDuplicates()
  }
});

function removeDuplicates() {
  chrome.windows.getAll({populate:true, windowTypes:['normal']})
  .then((windows) => {
    var idsToRemove = []
    var knownURLs = {};
    windows.forEach(w => {
      w.tabs.forEach((tab) => {
        if (!knownURLs[tab.url]) {
          knownURLs[tab.url] = tab.id;
        } else {
          idsToRemove.push(tab.id)         
        }
      })
      chrome.tabs.remove(idsToRemove);
    })
  })
}
