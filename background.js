var FOLDER_TITLE = 'Astrolabe'
var rootFolder = undefined;

chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed", chrome.bookmarks);
  //getRootFolder(function(folder){ })
});


var native = undefined
function  connectNativeApp() {
  console.log("connecting", native)

  if (native) return;
  native = chrome.runtime.connectNative('com.blacktree.astrolabe');
  console.log("connecting", native)

  native.onMessage.addListener(function(msg) {
    console.log("Received" + msg);
  });
  native.onDisconnect.addListener(function() {
    console.log("Disconnected");
    native = undefined;
  });
  native.postMessage({ text: "Hello, my_application" });

}

chrome.runtime.onStartup.addListener(function() {
  console.log("Astrolabe Started");

  //connectNativeApp();



})

chrome.browserAction.onClicked.addListener(function () {


  console.log("Astrolabe Clicked");
  //connectNativeApp();
  return;
  getRootFolder(function(folder){
    chrome.tabs.query({}, function(results) {
      console.log("TABS", results)
      results.forEach(function(tab) {
        chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url},  function(newItem) {
          console.log("added folder: " + newItem);
        });
      });
    });
  });
});

function getChildren(callback) {
  getRootFolder( rootFolder => {
    chrome.bookmarks.getChildren(rootFolder.id, function(children) {
      callback(children)
    });
  })
}
function getRootFolder(callback) {
  if (rootFolder) return callback(rootFolder);
  chrome.bookmarks.getChildren("1", function(children) {
    var match = children.find(e => e.title === FOLDER_TITLE)
    if (match) {
      callback(match);
    } else {
      console.log("Creating Folder", FOLDER_TITLE)
      chrome.bookmarks.create({'parentId': '1', 'title': FOLDER_TITLE},  function(newFolder) {
        console.log("added folder: " + newFolder.title, newFolder);
        if (callback) callback(newFolder);
      });
    }
  });
}

var ignoreNextTabMove = false;
chrome.bookmarks.onMoved.addListener(function(id, moveInfo) {
  console.log("Bookmark Moved", id, moveInfo); 
  chrome.tabs.query({}, function(results) {
    var tab = results[moveInfo.oldIndex]
    console.log("2TAB", tab)
    ignoreNextTabMove = true;
    chrome.tabs.move(tab.id, {windowId:undefined, index:moveInfo.index}, function(){
      console.log("3done")
    })
  });
});

chrome.bookmarks.onChildrenReordered.addListener(function(id, reorderInfo) {
  console.log("REORDERED", id, reorderInfo); 
});

// chrome.tabs.onActivated.addListener(function (tabId, windowId) {
//   console.log("ACTIVATED", tabId, windowId);
// });

chrome.tabs.onCreated.addListener(function (tab){
  console.log("CREATED", tab.id);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab){
  console.debug("UPDATED", tabId, tab);
  //  getRootFolder(function(folder){
  //   console.debug("folder", folder)
  // })
});

chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
  if (ignoreNextTabMove) {
    ignoreNextTabMove = false;
  } else {
    getChildren (function(children) {
      var item = children[moveInfo.fromIndex];
      chrome.bookmarks.move(item.id, {parentId: rootFolder.id, index: moveInfo.toIndex}, function() {
      });    
    });
  }
});


chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {})
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {})
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {})


var apps = [
  { pattern: 'https://mail.google.com/*' },
  { pattern: 'https://mail.google.com/*' }
]

function updateTabs() {
  var query = { pinned: true};
  chrome.tabs.query(query, function(tabs) {
    console.log(tabs)
  });
}

function tabMatchingBookmark(bookmark, tabs) {
  for(var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    var tabURL = new URL(tab.url);
    var bookmarkURL = new URL(bookmark.url);
    if (tabURL.host == bookmarkURL.host) {
      return tab;
    }
  }
  return undefined;
}

function restoreTabs(folderId) {
  console.log("ID", folderId)
  var oldTabs = [];
  var tabsToOpen = [];
  chrome.bookmarks.getChildren(folderId, children => {
    chrome.tabs.query({ pinned: true}, function(tabs) {
      var unmatchedTabs = [...tabs];
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var tab = tabMatchingBookmark(child, unmatchedTabs);
        if (tab) {
          unmatchedTabs.splice( unmatchedTabs.indexOf(tab), 1 );
          oldTabs.push(tab.id);
        } else {
          child.index = i;
          tabsToOpen.push(child);
        }
      }

      chrome.tabs.move(oldTabs, {index:0});
      tabsToOpen.forEach(bookmark => {
        chrome.tabs.create({url:bookmark.url, pinned:true, index:bookmark.index})
      })
    });
  });
}



chrome.runtime.onConnect.addListener(function(port) {
  console.log("Opening channel:", port.name);
});



function getGmailTab(domain, callback) {
  var query = { url: `https://mail.google.com/*` };
  chrome.tabs.query(query, function(tabs) {
    tabs = tabs.filter(function(tab) {
      if (domain && !tab.title.includes(domain)) return false;
      return true; //tab.pinned
    });

    callback(tabs.shift());
  });
}

function focusTab(tab, closeSelf, callback) {
  chrome.tabs.update(tab.id, { selected: true }, function() {
    chrome.windows.update(tab.windowId, { focused: true }, function() {
      chrome.tabs.getCurrent(function(tab) {
        chrome.tabs.remove(tab.id, function() {
          callback(tab);
        });
      });
    });
  });
}

function openURLInGmail(url, domain) {
  getGmailTab(domain, function(gmail) {
    console.log("Opening in Gmail", gmail)
    if (gmail && url.hash) {
      var gmailUrl = new URL(gmail.url);
      gmailUrl.hash = url.hash;
      console.log(url.hash, gmail);
      chrome.tabs.update(gmail.id, { url: gmailUrl.toString() }, function() {
        focusTab(gmail);
      });
    } else {
      document.location.href = url;
    }
  });
}

chrome.runtime.onConnect.addListener(function(port) {
  console.assert(port.name == "search");
  console.log("Connected", port)
  port.onMessage.addListener(function(msg) {
    var query = msg.query || "";
    chrome.history.search({text:query}, function(results) {
      port.postMessage({results: results})
    })
  });
});



chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action == "getChildren") {
      console.log("req", sender)
      getRootFolder(function(rootFolder){
        chrome.bookmarks.getChildren(rootFolder.id, function(children) {
          sendResponse(children)
        }); 
      });
    } else if (request.action == "restore") {
      var folderId = request.id;
      restoreTabs(folderId);
      return sendResponse(undefined);
    } else if (request.action == "sidebar") {
      console.log("SIDEBAR")
      chrome.windows.create({
        url: chrome.runtime.getURL("sidebar.html"),
        type: "popup"
      });

    } else if (request.action == "query") {
      var query = request.query || "";
      chrome.history.search({text:query}, function(results) {
        console.log(results, {text:query})
        // var results = [
        //   {title: "Google", url:"http://google.com"},
        //   {title: "Example", url:"http://example.com"}
        // ]
        sendResponse(results)
      })

    } else {
      console.log("unknown message type")
    }
    return true;
});