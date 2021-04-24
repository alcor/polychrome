var FOLDER_TITLE = 'Astrolabe'
var rootFolder = undefined;

chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed", chrome.bookmarks);
  var html = chrome.extension.getURL('set.html');
console.log("html", html)
  getRootFolder(function(folder){ })
 

});


chrome.runtime.onStartup.addListener(function() {
  console.log("Astrolabe Started");

})

chrome.browserAction.onClicked.addListener(function () {
  console.log("Astrolabe Clicked");
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




function getRootFolder(callback) {
  if (rootFolder) return callback(rootFolder);
  chrome.bookmarks.getChildren("1", function(children) {
    var match = children.find(e => e.title === FOLDER_TITLE)
      console.log("Found Folder", match, children);
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

var ignoreNextMove = false;
chrome.bookmarks.onMoved.addListener(function(id, moveInfo) {
  console.log("1MOVED", id, moveInfo); 
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
  console.log("CREATED", tabId, moveInfo);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab){
  console.log("UPDATED", tabId, tab);

   getRootFolder(function(folder){
    console.log("folder", folder)
  })
});

chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
  if (ignoreNextTabMove) {
    ignoreNextTabMove = false;
  } else {
    getRootFolder(function(rootFolder){
      chrome.bookmarks.getChildren(rootFolder.id, function(children) {
        var item = children[moveInfo.fromIndex];
        chrome.bookmarks.move(item.id, {parentId: rootFolder.id, index: moveInfo.toIndex}, function() {

        });    
      });
    });
  }
});


chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {})
chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {})
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {})
