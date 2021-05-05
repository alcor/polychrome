
chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed");
});

chrome.commands.onCommand.addListener(function(command) {
  console.log('Command:', command);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let handlers = {
    restoreGroup: restoreGroup,
    reload: reload,
    'removeDuplicates': removeDuplicates
  }

  if (handlers[message.action]) {
    if (!handlers[message.action](message, sender, sendResponse)) {
      sendResponse();
    };
  } else {
    console.error("handler not found", message)
    sendResponse(undefined)
  }
});

function reload() {
  //chrome.runtime.reload()
}

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

function restoreGroup(args, sender, sendResponse) {
  let url = new URL(sender.url);
  let id = url.hash.substr(1);
  let params = new URLSearchParams(url.search);
  if (params) {
    restoreGroupWithBookmark(params)
  }
}

function restoreGroupWithBookmark(params) { 
  let id = params.get('id');
  let color = params.get('color');
  return chrome.bookmarks.get(id)
  .then (folder => {
    folder = folder[0];

    let title = folder.title;
    return chrome.bookmarks.getChildren(id)
    .then ((children) => {
      console.log(`Restoring Bookmark Group [${folder.title}]` )

      let promises = [];
      children.forEach(bookmark => {
        if (bookmark.url.startsWith("chrome-extension://")) return;
        promises.push(chrome.tabs.create({url: bookmark.url, selected:false, active:false}))
      })
      return Promise.all(promises);

    })
    .then (tabs => {
      return chrome.tabs.group({tabIds:tabs.map(t => t.id), createProperties:{}})
      .then((gid) => {
        chrome.tabs.update(tabs[0].id, { 'active': true });
        chrome.tabGroups.update(gid, {title:title, color:color})
      })
      
    }); 
  })
}


