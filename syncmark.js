//
// syncmark.js 
// To use this, open up chrome-extension://pcdogalliibjgamnojnpbmbabghfijak/sidebar.html
//

// Utility functions to handle defaults

// chrome.runtime.onInstalled.addListener(setup);
// chrome.runtime.onStartup.addListener(setup);


// Returns the string value of the variable name (black magic...).
const v = (nameObject) => { for (let varName in nameObject) { return varName; } }

function getDefault(key, fallback) {
  let value = localStorage.getItem(key);
  if (value == undefined) return fallback;
  return JSON.parse(value);
}

function setDefault(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


// Global Variables and startup

const BOOKMARK_FOLDER_TITLE = "Tab Groups";
const BOOMARK_ROOT_PARENT = '1';
const USE_BOOKMARKS_BAR = false;
const BOOKMARK_ROOT_KEY = 'bookmarkRoot'

// Maps tabGroup.id to bookmarkFolder.id. 
// Created at startup, used to track whether group changes.
let existingGroupsToFolders = {}
// Created at startup, tracks which tabs are in which group.
let existingTabToGroup = {}

let currentBookmarkRootId = getDefault('bookmarkRoot');
let ignoreNextTabMove = false;
let allFolders = [];

var Groups = function(vnode) {
  return {
    view: function(vnode) {
      return m('div.group', allFolders.map(f => {
        if (f.url) return null;
        return m('div.folder', {onclick:restoreGroupWithBookmark.bind(null, f.id)}, f.title);
      }));
    }
  }
}


let tabsToDiscard = {}

async function restoreGroupWithBookmark(bookmarkId) { 
  let folder = (await chrome.bookmarks.get(bookmarkId)).pop()

  let info = infoForFolderTitle(folder.title)
  let color = info.color;
  let title = info.title;

  let existing = (await chrome.tabGroups.query({title: title, color:color})).pop();
  if (existing) {
    let tabs = await tabsForGroup(existing);
    chrome.tabs.update(tabs[0].id, {active:true})
    return;
  } 

  let children = await chrome.bookmarks.getChildren(bookmarkId)
  let promises = children.map((bookmark, i) => {
    //if (bookmark.url.startsWith("chrome-extension://")) return; // Ignore metadata bookmarks
    let promise = chrome.tabs.create({url: bookmark.url, selected:false, active:false})
    if (i > 0) promise = promise.then(t => { tabsToDiscard[t.id] = true; return t;})
    return promise;
  })

  Promise.all(promises).then (tabs => {
    return chrome.tabs.group({tabIds:tabs.map(t => t.id), createProperties:{windowId: tabs[0].windowId}})
    .then((gid) => {
      chrome.tabs.update(tabs[0].id, { 'active': true });
      chrome.tabGroups.update(gid, {title:title, color:color})
    })
  }) 
}

async function initializeTabGroupMapping() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.groupId != -1) {
      existingTabToGroup[tab.id] = tab.groupId
    }
  }
}

// Syncs all groups to the bookmark folders.
async function updateAllFoldersAndGroups() {
  let rootId = await getBookmarkRoot();
  let groups = await chrome.tabGroups.query({});
  let folders = await chrome.bookmarks.getChildren(rootId);

  console.log('updateAllFoldersAndGroups', {rootId, groups, folders})

  allFolders = folders;

  for (let group of groups) {
    let title = folderTitleForGroup(group);
    let folder = folders.find(f => f.title == title);
    const tabs = await tabsForGroup(group);
    if (!folder) {
      console.log('Creating folder', title);
      folder = await chrome.bookmarks.create({parentId: rootId, title: title, index: 0});
    }
    updateFolderWithTabs(folder, group, tabs);
    existingGroupsToFolders[group.id] = folder.id;
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

// Returns true if the bookmark root exists, false if it doesn't.
async function doesCurrentBookmarkRootExist() {
  if (!currentBookmarkRootId) { 
    return false;
  }
  return chrome.bookmarks.get(currentBookmarkRootId)
    .then(() => { return true })
    .catch(() => { return false })
}

// Returns id of the bookmark folder with the name 'Tab Groups'. Returns 0 if it isn't found.
async function getTabGroupsBookmark() {
  let results = await chrome.bookmarks.search({title:BOOKMARK_FOLDER_TITLE})
  if (results && results.length > 0) {
    return results[0].id;
  }
  return 0;
}

// Returns the id for the bookmark root object.
//
// It will guarantee the bookmark root exists, even if
// the bookmark root is deleted by the user.
async function getBookmarkRoot() {
  if (USE_BOOKMARKS_BAR) {
    return BOOMARK_ROOT_PARENT;
  }

  // Return the current bookmark id if it still exists.
  if (await doesCurrentBookmarkRootExist()) {
    return currentBookmarkRootId;
  } 

  // Check if the bookmark root exists but was moved somewher else
  const existingTabGroupId = await getTabGroupsBookmark();
  if (existingTabGroupId) {
    setDefault(BOOKMARK_ROOT_KEY, existingTabGroupId)
    currentBookmarkRootId = existingTabGroupId;
    return currentBookmarkRootId;
  }

  // Nothing exists, create a new one at the root node.
  const newBookmarkRoot =  await chrome.bookmarks.create({
    parentId: BOOMARK_ROOT_PARENT, 
    title: BOOKMARK_FOLDER_TITLE, 
    index: 0 
  });
  setDefault(BOOKMARK_ROOT_KEY, newBookmarkRoot.id);
  currentBookmarkRootId = existingTabGroupId;

  return currentBookmarkRootId;
}


const COLOR_EMOJIS = { grey: "⚪️", blue: "🔵", red: "🔴", yellow: "🟠", green: "🟢", pink: "🌸", purple: "🟣", cyan: "🌐" }
const EMOJI_COLORS = Object.assign({}, ...Object.entries(COLOR_EMOJIS).map(([a,b]) => ({[b]: a})))


function folderTitleForGroup(group) {
  return `${COLOR_EMOJIS[group.color]} ${group.title || group.color}`;
}

function infoForFolderTitle(string) {
  let match = string.match(/(?<color>\S+) (?<title>.*)/);
  let info = match.groups;
  info.color = EMOJI_COLORS[info.color];
  return info
}

// Returns the bookmark folder for a tab group. 
async function folderForGroup(group) {
  let rootId = await getBookmarkRoot();
  let children = await chrome.bookmarks.getChildren(rootId);
  let title = folderTitleForGroup(group)
  let folder = children.find(c => c.title == title);

  if (!folder) {
    console.log('Creating group', title, group);
    folder = await chrome.bookmarks.create({
      parentId: rootId,
      title: title,
      index:0});
    existingGroupsToFolders[group.id] = folder.id;
  }
  return folder;
}


// Tab Group Event Handling

// Called when properties of the group changes like the color or name.
async function groupUpdated(group) {
  console.log('groupUpdated', group);

  const folderId = existingGroupsToFolders[group.id];
  let title = folderTitleForGroup(group);

  if (folderId) {
    // Sync group changes to the folder if it exsts.
    chrome.bookmarks.update(folderId, {title});
  } else {
    // Create the folder if it doesn't exist.
    await folderForGroup(group)
  }
}

function tabCreated(tab) {
  console.log("tabCreated", tab)
}

async function tabMoved(id, change) {
  // TODO: Suppress bookmark change notifications
  // if (ignoreNextTabMove) {
  //   ignoreNextTabMove = false;
  console.log('tabMoved', {id, change})

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
  console.log('tabUpdated', {id, change, tab})

  if (tabsToDiscard[id] == true && change.title) {
    chrome.tabs.discard(id);
    delete tabsToDiscard[id];
  }

  // Tab moved groups.
  if (change && typeof change.groupId !== 'undefined') {
    tabDidChangeGroups(id, change, tab);
  } else if (tab.groupId > -1) {  
    // if tab.groupId == -1, that means it's not in a group.
    tabDidChangeProperties(id, change, tab);
  }
}

async function tabDidChangeGroups(id, change, tab) {
  if (change.groupId == -1) {
    const previousGroupId = existingTabToGroup[tab.id];
    if (typeof previousGroupId !== 'undefined' && previousGroupId != -1) {
      const group = await chrome.tabGroups.get(previousGroupId);
      const tabs = await tabsForGroup(group);
      const folder = await folderForGroup(group);  
      updateFolderWithTabs(folder, group, tabs)
      delete existingTabToGroup[id]
    }
  } else {
    // Tab moved groups, also move it in the folders.
    // TODO: Need to find the previous bookmark group id to remove it.
    let group = await chrome.tabGroups.get(tab.groupId);
    let tabs = await tabsForGroup(group);
    let folder = await folderForGroup(group);  
    updateFolderWithTabs(folder, group, tabs)
    existingTabToGroup[id] = tab.groupId;
  }
}

// Handle changes of the tab that are not moving groups.
async function tabDidChangeProperties(id, change, tab) {
  let group = await chrome.tabGroups.get(tab.groupId);
  let tabs = await tabsForGroup(group);
  let folder = await folderForGroup(group);
  let index = tabs.findIndex(t => t.id == id);
  let children = await chrome.bookmarks.getChildren(folder.id);
  let bookmark = children[index];
  chrome.bookmarks.update(bookmark.id, {title: tab.title, url: tab.url});  

}

// 
// Initializer
//
async function onStartup() {
  console.log('Startup', EMOJI_COLORS);
  await updateAllFoldersAndGroups();
  await initializeTabGroupMapping();
  m.mount(document.body, Groups)
}

onStartup();

// Tabstrip Event handling
chrome.tabGroups.onUpdated.addListener(groupUpdated);
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onMoved.addListener(tabMoved);
chrome.tabs.onUpdated.addListener(tabUpdated);
// chrome.tabs.onAttached.addListener()
// chrome.tabs.onDetached.addListener()
// chrome.tabs.onRemoved.addListener()


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


