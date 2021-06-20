//
// syncmark.js 
// To use this, open up chrome-extension://pcdogalliibjgamnojnpbmbabghfijak/sidebar.html
//

// Utility functions to handle defaults

// chrome.runtime.onInstalled.addListener(setup);
// chrome.runtime.onStartup.addListener(setup);

let v = (nameObject) => { for(let varName in nameObject) { return varName; } }

function getDefault(key, fallback) {
  let value = localStorage.getItem(key);
  if (value == undefined) return fallback;
  return JSON.parse(value);
}

function setDefault(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


// Global Variables and startup

var bookmarkRoot = getDefault(v({bookmarkRoot}));
let BOOKMARK_FOLDER_TITLE = "Tab Groups";
let BOOMARK_ROOT_PARENT = '1';
let USE_BOOKMARKS_BAR = false;
let groupsToFolders = {};
let ignoreNextTabMove;




var Preview = function(vnode) {
  return {
    view: function(vnode) {
      let children = [];

      // TODO: This should use a better data store, probably JS classes
      for (let item in groupsToFolders) {
        let folder = groupsToFolders[item];
        children.push(m('div.tab', item, " - ", folder.title, " - ", folder.id))
      }
      return m('div.group', children);
    }
  }
}

async function onStartup() {
  updateAllFoldersAndGroups()
  m.mount(document.body, Preview)
}
onStartup();


async function updateAllFoldersAndGroups() {
  let rootId = await getBookmarkRoot();
  let groups = await chrome.tabGroups.query({});
  let folders = await chrome.bookmarks.getChildren(rootId);

  for (let group of groups) {
    let title = folderTitleForGroup(group);
    let folder = folders.find(f => f.title == title);
    if (folder) {
      groupsToFolders[group.id] = folder;

      let tabs = await tabsForGroup(group);
      updateFolderWithTabs(folder, group, tabs);
    } else {
      // TODO: Create the group
    }
  }
  m.redraw();
}

async function updateFolderWithTabs(folder, group, tabs) {
  let children = await chrome.bookmarks.getChildren(folder.id)

  for (const [index, tab]  of tabs.entries()) {
    let child = children.find(c => c.url == tab.url);

    if (!child) {
      chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url, index});
      continue;
    } else if (child.index != index) {
      chrome.bookmarks.move(child.id, {index})
    }
    children.splice(children.indexOf(child), 1);
  }
  if (children.length) {
    console.log("Removing orphans:", children);
    children.forEach(child => chrome.bookmarks.remove(child.id));
  }
}

async function tabsForGroup(group) { // There is a bug in tab.query for groupIds, so...
  let w = await chrome.windows.get(group.windowId, {populate:true});
  return w.tabs.filter(t => t.groupId == group.id)
}

async function getBookmarkRoot() {
  getDefault(v({bookmarkRoot}));

  if (USE_BOOKMARKS_BAR) return '1';

  if (bookmarkRoot) {
    try {
      await chrome.bookmarks.get(bookmarkRoot)
    } catch(err) {
      bookmarkRoot = undefined;
    }
  }

  if (!bookmarkRoot) {
    let folder = await chrome.bookmarks.search({title:BOOKMARK_FOLDER_TITLE})
    console.log("folder", folder)
    folder = folder[0]

    if (!folder) {
      folder = await chrome.bookmarks.create({parentId: BOOMARK_ROOT_PARENT, 'title': BOOKMARK_FOLDER_TITLE, index:0});
    }

    if (folder.id) {
      setDefault(v({bookmarkRoot}), bookmarkRoot = folder.id)
    }
  }
  return bookmarkRoot;
}


let colorEmoji = { grey: "⚪️", blue: "🔵", red: "🔴", yellow: "🟠", green: "🟢", pink: "🌸", purple: "🟣", cyan: "🌐" }

function folderTitleForGroup(group) {
  return `${colorEmoji[group.color]} ${group.title || group.color}`;
}

async function folderForGroup(group) {
  if (groupsToFolders[group.id]) {
    return (await chrome.bookmarks.get(groupsToFolders[group.id].id)).pop();
  }

  let rootId = await getBookmarkRoot();

  let children = await chrome.bookmarks.getChildren(rootId);
  let title = folderTitleForGroup(group)
  let folder = children.find(c => c.title == title);

  if (!folder) {
    folder = await chrome.bookmarks.create({
      parentId: rootId,
      title: title,
      index:0});
  }
  return folder;
}


// Tab Group Event Handling
chrome.tabGroups.onUpdated.addListener(groupUpdated);

async function groupUpdated(group) {
  let folder = await folderForGroup(group);
  let title = folderTitleForGroup(group);
  chrome.bookmarks.update(folder.id, {title});
}


// Tabstrip Event handling
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onMoved.addListener(tabMoved);
chrome.tabs.onUpdated.addListener(tabUpdated);
// chrome.tabs.onAttached.addListener()
// chrome.tabs.onDetached.addListener()
// chrome.tabs.onRemoved.addListener()

function tabCreated(tab) {
  console.log("tabCreated", tab)
}


async function tabMoved(id, change) {
  // TODO: Suppress bookmark change notifications
  // if (ignoreNextTabMove) {
  //   ignoreNextTabMove = false;

  let w = await chrome.windows.get(change.windowId, {populate:true});
  let tab = w.tabs.find(t => t.id == id);

  if (!tab.groupId) return;

  let groupId = tab.groupId;
  let group = await chrome.tabGroups.get(groupId);
  let tabs = await tabsForGroup(group);
  let folder = await folderForGroup(group);

  updateFolderWithTabs(folder, group, tabs);
}



async function tabUpdated(id, change, tab) {
  if (change.status != 'complete') return;

  if (tab.groupId < 0) return;
  let group = await chrome.tabGroups.get(tab.groupId);
  let tabs = await tabsForGroup(group);
  let folder = await folderForGroup(group);

  let index = tabs.findIndex(t => t.id == id);
  let children = await chrome.bookmarks.getChildren(folder.id);
  let bookmark = children[index];

  chrome.bookmarks.update(bookmark.id, {title: tab.title, url: tab.url});
}




// Bookmark Event handling

// TBD, needs to avoid cycles

// async function bookmarkMoved(id,moveInfo) {
//   chrome.tabs.query({}, function(results) {
//     var tab = results[moveInfo.oldIndex]
//     chrome.tabs.move(tab.id, {windowId:undefined, index:moveInfo.index}, function(){
//     })
//   });
// }
// chrome.bookmarks.onChildrenReordered.addListener(bookmarkMoved)


