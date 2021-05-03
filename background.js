var FOLDER_TITLE = 'Tabs'

chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed");
});

chrome.commands.onCommand.addListener(function(command) {
  console.log('Command:', command);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let handlers = {
    restoreGroup: restoreGroup,
    'removeDuplicates': removeDuplicates
  }

  if (handlers[message]) {
    handlers[message](sender, sendResponse);
  } else {
    console.error("handler not found", message)
    sendResponse(undefined)
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

// async function getBookmarkRoot() {
//   if (!bookmarkRoot) {
//     let folder = await chrome.bookmarks.search({title:BOOKMARK_FOLDER_TITLE})
//     console.log("folder", folder)
//     folder = folder[0]

//     if (!folder) {
//       folder = await chrome.bookmarks.create({parentId: '1', 'title': BOOKMARK_FOLDER_TITLE});
//     }

//     if (folder.id) {
//       setDefault(v({bookmarkRoot}), bookmarkRoot = folder.id)      
//     }
//   }
//   return bookmarkRoot;
// }



function restoreGroup(sender, sendResponse) {
  sendResponse(true);
  let url = new URL(sender.url);
  console.log("url", url, url.search)
  let id = url.hash.substr(1);
  let params = new URLSearchParams(url.search);
  if (params) {
    restoreGroupWithBookmark(params)
    .then(() => {
      chrome.tabs.remove(sender.tab.id);
    });
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
        promises.push(chrome.tabs.create({url: bookmark.url}))
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