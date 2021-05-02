

let v = (nameObject) => { for(let varName in nameObject) { return varName; } }


// Stored Values
var autofocus = getDefault(v({autofocus}), false);
var preserveGroups = getDefault(v({preserveGroups}), true);
var simplifyTitles = getDefault(v({simplifyTitles}), true); 

setTimeout(() => location.reload(), 60 * 1000 * 1000)

var myWindowId = undefined;
var lastWindowId = undefined;
var isMenuMode = false;
chrome.tabs.getCurrent((sidebar) => {
  if (sidebar) {
    myWindowId = sidebar.windowId
  } else {
    isMenuMode = true;
    document.body.classList.add("menu")
    document.body.style.height = window.screen.availHeight;
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var root = document.body
  m.mount(root, WindowManager)
  var searchEl = document.getElementById("search");
  searchEl.oninput = searchInput;
  searchEl.focus();
  //handleInput();
})

window.addEventListener("focus", function(event) { 
  var searchEl = document.getElementById("search");
  searchEl.focus();
}, false);


// Window auto-focus

var focusTimeout = undefined;
if (navigator.platform == 'MacIntel') {
  document.addEventListener('mouseenter', e => {
    if (myWindowId && autofocus) {
      chrome.windows.update(myWindowId, { "focused": true })
    }
    focusTimeout = setTimeout(e => {
      //console.log("timeout")
      },1000)
    })

  document.addEventListener('mouseleave', e => {
    clearTimeout(focusTimeout);
  })
}

var activeQuery = undefined;
function searchInput(e) {
  if (!e) return;
  if (e.key == "Escape" && isMenuMode) {
    window.close();
    return;
  }

  var query = e ? e.target.value : undefined;
  activeQuery = query;
  m.redraw();
}
  
function sortByDomain(a,b) {
  return a.reverseHost.localeCompare(b.reverseHost);
}
function sortByTitle(a,b) {
  return a.title.localeCompare(b.title);
}

function typeForTab(tab) {
  if (/[docs|sheets|slides]\.google\.com/.test(tab.hostname)) {
    return "Document";
  }
  if (/[calendar|mail]\.google\.com/.test(tab.hostname)) {
    return "App";
  }
  if (/.*\.slack\.com/.test(tab.hostname)) {
    return "Communication";
  }
  return "Other"
}
function sortTabs(type) {
  chrome.windows.getAll({populate:true, windowTypes:['normal']}, (windows) => {
    windows.forEach(w => {
      let tabs = w.tabs
      tabs.forEach((tab) => {
        tab.domain = tab.url
        try {
          let hostname =  new URL(tab.url).hostname;
          tab.hostname = hostname;
          tab.reverseHost = hostname.split('.').reverse().join('.');;
        } catch (e) {
          tab.reverseHost = "zzzz." + tab.url; // lol
        } 
        tab.type = typeForTab(tab);
      });

      if (type == 'domain') {
        tabs.sort(sortByDomain);
        console.log(tabs.map(t=>t.reverseHost))
      } else if (type == 'title') {
        tabs.sort(sortByTitle);
      } else if (type == 'type') {
        tabs.sort(sortByType); 
      }

      let orderedIds = [];      
      tabs.forEach((tab) => {
        if (tab.groupId < 0 && !tab.pinned) {
          orderedIds.push(tab.id);
        }
      });
      console.log(orderedIds)
      chrome.tabs.move(orderedIds,  {index:-1, windowId:w.id});

    })
  });
} 

function removeDuplicates() {
  chrome.runtime.sendMessage('remove-duplicates', (response) => {
    console.log('received response', response);
  });
  return;
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




//
// Utility functions
//

function getDefault(key, fallback) {
  let value = localStorage.getItem(key);
  if (value == undefined) return fallback;
  return JSON.parse(value);
}

function setDefault(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


var titleReplacements = {
  "www.google.com": /(.*) - Google Search/,
  "www.amazon.com": /Amazon\.com: (.*)/,
  "app.slack.com": /Slack \| (.*)/,
}

var iconReplacements = {
  "www.google.com": /(.*) - Google Search/
}

function titleForTab(tab) {
  if (!tab.url.length) return tab.title;
  let url;

  try {
     url = new URL(tab.url);
  } catch (e) {
    console.log(`cannot read url "${tab.url}"`, e)
  }

  let replacement = titleReplacements[url.hostname];

  if (replacement) {
    return tab.title.replace(replacement, '$1')
  } else if (simplifyTitles) {
    let components = tab.title.split(/\s[-–—•|]\s/g);
    if (components.length > 1) components.pop();
    return components.join(' • ');
  }

  return tab.title;
}

//
// Drag and Drop
//

var draggedTab = undefined;
document.addEventListener("dragstart", function( event ) {
    let target = event.target;
    target = target.closest("[index]");
    draggedTab = target
    draggedTab.classList.add("dragged");

    let url = "about:blank";
    var dt = event.dataTransfer;
    dt.effectAllowed = 'all';
    dt.setDragImage(draggedTab, 24,12);
    dt.setData("text/uri-list", url);
    dt.setData("text/plain", url);
  })

document.addEventListener("dragenter", function( event ) {
  event.preventDefault();
  let target = event.target;
  target = target.closest('[index]');  
  if (!target) return;

  let dragIndex = parseInt(draggedTab.getAttribute("index"));
  let dropIndex = parseInt(target.getAttribute("index"));
  
  if (dropIndex == dragIndex - 1) return; // TODO: Make sure groups aren't different
  if (!target || target == draggedTab) return;
  if (target) target.classList.add("droptarget", true);
}, false);

document.addEventListener("dragleave", function( event ) {
  event.preventDefault();
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");
  if (!target) return;
  if (target) target.classList.remove("droptarget", true);
}, false);

document.addEventListener("dragover", function( event ) {
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");
  if (target) event.preventDefault();
}, false);

document.addEventListener("drop", function( event ) {
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");
  if (target) target.classList.remove("droptarget", true);

  draggedTab.classList.remove("dragged");
  if (!target || target == draggedTab) return;
  event.preventDefault();
  let dragId = parseInt(draggedTab.getAttribute("id"));
  let dragIndex = parseInt(draggedTab.getAttribute("index"));
  let dropIndex = parseInt(target.getAttribute("index")) || -1;
  let wid = parseInt(target.getAttribute("wid")) || parseInt(draggedTab.getAttribute("wid"));
  let gid = parseInt(target.getAttribute("gid")) || -1;

  if (dropIndex > dragIndex) dropIndex--;
  //console.log(`move to ${wid} > ${gid} to ${dropIndex} from ${dragIndex}`)

  chrome.tabs.query({highlighted:true, windowId:wid}, tabs => {
    var tabIds = tabs.map(tab => tab.id);

    if (!tabIds.includes(dragId)) tabIds = [dragId];
    chrome.tabs.move(tabIds, {index:dropIndex, windowId:wid}, () => {
      if (gid == -1) {
        chrome.tabs.ungroup(tabIds)
      } else {
        chrome.tabs.group({groupId:gid, tabIds:tabIds})
      }
    })
  })
}, false);

document.addEventListener("dragend", function( event ) {
  draggedTab.classList.remove("dragged");
  draggedTab = undefined;
})


window.onkeydown = function(event) {

  if (event.metaKey && event.keyCode == 84) { // C-T
    chrome.windows.update(lastWindowId, { "focused": true })
    .then((wind) => {
      chrome.tabs.create({windowId:lastWindowId})
      .then ((tab) => {
        
      })
    })  
    event.preventDefault(); 
  } else if(event.metaKey && event.keyCode == 83) {  // C-S
    event.preventDefault(); 
  } else if(event.metaKey && event.keyCode == 82) {  // C-R
    let options = event.shiftKey ? {} : undefined;
    chrome.tabs.query({highlighted:true, windowId: lastWindowId})
    .then((tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id, options)
      })
    });
    event.preventDefault(); 
  } else if ((event.key == "Backspace" && event.target == document.body)
   || (event.metaKey && event.keyCode == 87)) { 
    event.preventDefault();     
    closeTab();
    return false;
  }
}
function closeTab() {
  chrome.tabs.query({highlighted:true, windowId: lastWindowId})
  .then((tabs) => {
    console.log(tabs)
    chrome.tabs.remove(tabs.map(t => t.id))
  });
}
function popOutSidebar(id) {
  chrome.windows.create({
    url: chrome.runtime.getURL("sidebar.html"),
    type: "popup",
    width:256,
    height:window.screen.availHeight,
    top:0,
    left:0
  }, (w) => {
    w.alwaysOnTop = true;
  });
  window.close();
}

function showMenu() {
}



//
// tab lifecycle
//


var windows = []
function updateTabs() {
  var b = {}
  var groupId = undefined;
  var windowId = -1;
  var groupEl = undefined;
  chrome.windows.getAll({populate:true, windowTypes:['normal']}, w => {
    windows = w;
    if (!lastWindowId) lastWindowId = windows[0].id;
    m.redraw();
  });
  return;
}

function updateGroup(tabGroup) {
  groupInfo[tabGroup.id] = tabGroup;
  m.redraw();
}

chrome.tabs.onActivated.addListener(updateTabs);
chrome.tabs.onAttached.addListener(updateTabs);
chrome.tabs.onCreated.addListener(updateTabs);
chrome.tabs.onDetached.addListener(updateTabs);
chrome.tabs.onHighlighted.addListener(updateTabs);
chrome.tabs.onMoved.addListener(updateTabs);
chrome.tabs.onRemoved.addListener(updateTabs);
chrome.tabs.onReplaced.addListener(updateTabs);
chrome.tabs.onUpdated.addListener(updateTabs);
chrome.tabGroups.onCreated.addListener(updateTabs);
chrome.tabGroups.onMoved.addListener(updateTabs);
chrome.tabGroups.onRemoved.addListener(updateTabs);
chrome.tabGroups.onUpdated.addListener(updateGroup);
chrome.windows.onCreated.addListener(updateTabs);
chrome.windows.onRemoved.addListener(updateTabs);
chrome.windows.onFocusChanged.addListener((w) => {
  if (w != myWindowId && w > 0) {
    lastWindowId = w;
    updateTabs();
  }
});

updateTabs()




//
// Mithril Classes
//

var WindowManager = function(vnode) {
  return {
    view: function(vnode) {
      return [
        m(Toolbar),
        m(WindowList, {windows:windows})
      ] 
    }
  }
}

function discardAllTabs() {
  windows[0].tabs.forEach( (tab) => {
    chrome.tabs.discard(tab.id)
  })
}
function toggle(v) {
  v = !v;
  setDefault(v);
}
var Toolbar = function(vnode) {
  return {
    view: function() {
      return m("div.toolbar", 
        m(Search),
        myWindowId ? undefined : m('div.button#popout', {onclick:popOutSidebar}, m('span.material-icons','open_in_new')),
        m('div.button',
          m('span.material-icons','sort'),
          m('div.sort.menu',
            m('div', {onclick:() => { sortTabs('domain') }}, "Sort by Domain"),
            //m('div.disabled', {onclick:() => { sortTabs('type') }}, "Sort by Type"),
            m('div', {onclick:() => { sortTabs('title') }}, "Sort by Title"),
            m('hr'),
            m('div', {onclick:() => { removeDuplicates() }}, "Remove Duplicates"),
            m('div', {onclick:() => { discardAllTabs() }}, "Unload all tabs"),
            //m('div.disabled', {onclick:() => { discardAllTabs() }}, "Combine Windows"),
            m('hr'),
            m('div', {class: preserveGroups,
              onclick: () => setDefault(v({preserveGroups}), preserveGroups = !preserveGroups)
            }, "Preserve Groups")
          )),
        m('div.button', {onclick:showMenu},
          m('span.material-icons','more_vert'),
          m('div.sort.menu',
            m('div', {class: autofocus, title:"(Mac only), focuses this window when the mouse enters, to reduce the need to click multiple times.",
            onclick: () => setDefault(v({autofocus}), autofocus = !autofocus)
            }, "Aggressive autofocus"),
            m('div', {class: simplifyTitles, title:"Simplify titles",
            onclick: () => setDefault(v({simplifyTitles}), simplifyTitles = !simplifyTitles)
            }, "Simplify titles"),
            m('hr'),
            m('div', {onclick: () => window.location.reload()},"Refresh")
          )
        )
      )   
    }
  }
}

var ContextMenu = function(vnode) {
  return {
    view: function() {
      return m("div.menu#context-menu", 
            m('div', {onclick:() => { sortTabs('domain') }}, "Pin"),
            // m('div.disabled', {onclick:() => { sortTabs('type') }}, "New Grou"),
            m('div', {onclick:() => { sortTabs('title') }}, "Sort by Title"),
            m('hr'),
            m('div', {onclick:() => { removeDuplicates() }}, "Remove Duplicates"),
            m('div', {onclick:() => { discardAllTabs() }}, "Unload all tabs"),
            // m('div.disabled', {onclick:() => { discardAllTabs() }}, "Combine Windows"),
            m('hr'),
            m('div', {class: preserveGroups,
              onclick: () => setDefault(v({preserveGroups}), preserveGroups = !preserveGroups)
            }, "Preserve Groups")
          )
    }
  }
}

var Search = function(vnode) {
  return {
    view: function() {
      return [
        m("div.search", m("input#search", {type:"search", key:"search", placeholder:"Filter", autocomplete:"off"}))
      ]  
    }
  }
}


var WindowList = function(vnode) {
  return {
    view: function(vnode) {
      if (!vnode.attrs.windows.length) return "";
      return vnode.attrs.windows.map(w => { return m(Window, {window:w, key:w.id})})
      
    }
  }
}

var groupInfo = {}
var Window = function(vnode) {
  return {
    view: function(vnode) {
      let w = vnode.attrs.window;
      
      let groups = []
      let children = []
      var b = {}
      var currentGroup = undefined;
      var currentGroupId = undefined;
      w.tabs.forEach((tab, i) => {
        var groupId = tab.groupId;
        if (tab.pinned) groupId = -2;

        if (currentGroupId == undefined || currentGroupId != groupId) {
          if (groupId > 0 && !groupInfo[groupId]) {
            chrome.tabGroups.get(groupId, (info) => {
              groupInfo[info.id] = info
              m.redraw();
            });
          }
          currentGroupId = groupId;
          currentGroup = {id:groupId, tabs:[], info:groupInfo[groupId]}
          groups.push(currentGroup)
        }
        currentGroup.tabs.push(tab)
      }) 

      var classList = [];
      if (w.id == lastWindowId) classList.push('frontmost');

      return m('div.window', {class:classList}, [
          m('div.header', m('div.title', "Window " + w.id)),
          m('div.contents', groups.map((group, i) => m(TabGroup, {group, key:group.id > 0 ? group.id : i})))
      ])
    }
  }
}

var tabOpeners = JSON.parse(localStorage.getItem('tabOpeners')) || {}

setTimeout(updateOpeners, 1000)

function updateOpeners() {
  var promises = [];
  for (let tabId in tabOpeners) {

    promises.push(chrome.tabs.get(parseInt(tabId))
      .then((tab) => {
        //console.log("Found", tabId)
      })
      .catch((error) => {
        delete tabOpeners[tabId];
    }))
  }

  Promise.all(promises).then(saveOpeners)

}
function saveOpeners() {
  localStorage.setItem('tabOpeners',JSON.stringify(tabOpeners))
}
var TabGroup = function(vnode) {
  function onclick (e) {
    chrome.tabGroups.update(this.id, { 'collapsed': !this.info.collapsed });
  }
  function oncontextmenu (e) {
    e.preventDefault();
    let title = prompt("Rename Group", this.info.title)
    console.log(this, title)
    if (title) chrome.tabGroups.update(this.id, {title: title})
  }
  function newTab(e) {
    e.preventDefault();
    e.stopPropagation();
    chrome.windows.update(lastWindowId, { "focused": true })
    .then((win) => 
      chrome.tabs.create({index:0, windowId:win.id})
    ).then ((tab) =>
      chrome.tabs.group({groupId:this.id, tabIds:[tab.id]})
    )
  }

  function popOutGroup(e) {
    e.stopPropagation();
    let groupId = this.id;

    chrome.windows.get(this.info.windowId, {})
    .then(sourceWindow => {      
      chrome.windows.create({
        url: "about:blank",
        type: "normal",
        width:sourceWindow.width,
        height:sourceWindow.height,
        top:sourceWindow.top,
        left:sourceWindow.left
      })
      .then( window => {
        let extraTab = window.tabs[0].id;
        chrome.tabGroups.move(this.id,{windowId:window.id, index:0})
        .then(group => {    
          chrome.tabs.remove(extraTab)
        })  
      })
    })
  }

  function showGroupMenu(e) {

  }


  
  var bookmarkRoot = getDefault(v({bookmarkRoot}));
  let BOOKMARK_FOLDER_TITLE = "Tabs​";

  async function getBookmarkRoot() {
    if (!bookmarkRoot) {
      let folder = await chrome.bookmarks.search({title:BOOKMARK_FOLDER_TITLE})
      console.log("folder", folder)
      folder = folder[0]

      if (!folder) {
        folder = await chrome.bookmarks.create({parentId: '1', 'title': BOOKMARK_FOLDER_TITLE});
      }
  
      if (folder.id) {
        setDefault(v({bookmarkRoot}), bookmarkRoot = folder.id)      
      }
    }
    return bookmarkRoot;
  }

  
  let colorEmoji = {
    grey: "⚪️", blue: "🔵", red: "🔴", yellow: "🟡", green: "🟢", pink: "🟣", purple: "🟣", cyan: "🟢"
  }

  function archiveGroup(e) {
    let group = this;
    e.stopPropagation();

    let title = group.info.title || group.info.color;
    title = colorEmoji[group.info.color] + " " + title;

    getBookmarkRoot()
    .then(rootId => {
      console.log("got id", rootId, group)
      return chrome.bookmarks.create({parentId: rootId, title: title})
    })
    .then((folder) => {
      let promises = [];
     
      promises.push(chrome.bookmarks.create({parentId: folder.id, title: "Open Group", url:chrome.runtime.getURL("?" + folder.id)}))
      group.tabs.forEach(tab => {
        promises.push(chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url}))
      })
      return Promise.all(promises);
    })
    .then(results => {
      console.log("results", results)

      //chrome.tabs.remove(this.tabs.map(t => t.id))
    })
  }



  function closeGroup(e) {
    e.stopPropagation();
    chrome.tabs.remove(this.tabs.map(t => t.id))
  }

  function ungroup(e) {
    e.stopPropagation();
    chrome.tabs.ungroup(this.tabs.map(t => t.id))
  }

  return {
    view: function(vnode) {
      let group = vnode.attrs.group;
      let attrs = {}
      let classList = [];
      let collapsed = false; 
      if (group.info && group.id > 0) {
        classList.push(group.info.color);
        collapsed = group.info.collapsed;
        attrs.onclick = onclick.bind(group)
        attrs.oncontextmenu = oncontextmenu.bind(group)
      } else {
        classList.push("no-group");
      }

      let title = group.info ? (group.info.title || (group.info.color)) : "Ungrouped";
      if (group.id == -2) {
        title = "Pinned";
        classList.push("pinned");
      }
      attrs.wid = group.tabs[0].windowId
      attrs.gid = group.id
      attrs.index = group.tabs[0].index
    
      let children = [];
      let lastTab = {};
      let openerStack = [];

      group.tabs.forEach((tab, i) => {
        let isQuery = tab.url.startsWith("https://www.google.com/search")
        if (isQuery) tab.isQuery = true;

        let opener = tab.openerTabId || tabOpeners[tab.id];
        if (opener) {
          if (!tabOpeners[tab.id]) {
            tabOpeners[tab.id] = tab.openerTabId;
            saveOpeners();
          } 
          if ((opener == lastTab.id && !lastTab.isQuery)
              || (opener == lastTab.openerTabId && lastTab.indent)) {
            
              //console.log(opener, lastTab.id, lastTab.openerTabId, lastTab.isQuery, lastTab.indented, tab.title);
              tab.indent = 2;
          }
        }

        lastTab = tab;
        children.push(m(Tab, {tab}))
      })
      
      if (collapsed) classList.push("collapsed");
      let height = collapsed ? 0 : children.length + 1;

      return m('div.group', {class:classList.join(" "), style:`flex-grow:${height}`},
        m('div.header', attrs,
          m('div.actions',
            m('div.action.newtab', {title:'New tab in group', onclick:newTab.bind(group)}, m('span.material-icons',"add_circle")),
             m('div.action.ungroup', {title:'Ungroup', onclick:ungroup.bind(group)}, m('span.material-icons',"layers_clear")),
            m('div.action.popout', {title:'Open in new window', onclick:popOutGroup.bind(group)}, m('span.material-icons',"open_in_new")),
            m('div.action.more', {title:'Menu', onclick:showGroupMenu.bind(group)}, m('span.material-icons',"more_vert")),
            m('div.action.archive', {title:'Archive', onclick:archiveGroup.bind(group)}, m('span.material-icons',"save_alt")),
            m('div.action.close', {title:'Close', onclick:closeGroup.bind(group)}, m('span.material-icons',"close"))
          ),
          m('div.title', title),
        ),
        children
      )
       
  
    }
  }
}


let favicons = {
  "chrome": "./img/newtab.png"
}

var Tab = function(vnode) {
  function onclick(e) {
      if (e.metaKey) {
        chrome.tabs.update(this.id, { 'highlighted': true });
      } else if (e.shiftKey) {
        let queryOptions = { active: true, windowId:this.windowId };
        chrome.tabs.query(queryOptions)
        .then((activeTab) => {
          let min = Math.min(activeTab[0].index, this.index);
          let max = Math.max(activeTab[0].index, this.index);
          let tabIds = []
          windows.forEach(w => {
            if (w.id == this.windowId) {
              w.tabs.forEach(t => {
                if (t.index >= min && t.index <= max) {
                  chrome.tabs.update(t.id, { 'highlighted': true });
                }
              })
            }
          })

        })
      } else {
        chrome.tabs.update(this.id, { 'active': true }, (tab) => { updateTabs() });
        if (this.windowId != lastWindowId) chrome.windows.update(this.windowId, { "focused": true }, () => {
          if (myWindowId) chrome.windows.update(myWindowId, { "focused": true })
        })  
        
      
    }
  }
  function close(e) {
    e.preventDefault();
    e.stopPropagation();
    chrome.tabs.remove(this.id)
  }
  return {
    view: function(vnode) {
      var tab = vnode.attrs.tab;
      let host = "";
      if (tab.url.startsWith("chrome://")) {
        host = "chrome"
      } else {
         host = tab.url ? new URL(tab.url).hostname : tab.url;
      }

      let favIconUrl = tab.favIconUrl || favicons[host] || (host && host.length ?`https://www.google.com/s2/favicons?domain=${host}` : undefined)

      var classList = [];
      if (tab.pinned) classList.push('pinned')
      if (tab.active) classList.push('active')
      if (host) classList.push("host-" + host.replace(/\./g,"-"))
      classList.push(tab.status)

      if (tab.audible) classList.push('audible');
      if (tab.discarded) classList.push('discarded');
      if (tab.highlighted) classList.push('highlighted');
      if (tab.isQuery) classList.push('query');
      if (tab.indent) {
        classList.push('indent-' + tab.indent);
      }

      let title = titleForTab(tab)
      if (activeQuery) {
        if (!tab.title.toLowerCase().includes(activeQuery)) {
          classList.push('filtered');
        }
      }
      

      let attrs = {
        id: tab.id,
        opener:tab.openerTabId || tabOpeners[tab.id],
        wid: tab.windowId,
        gid: tab.groupId,
        index: tab.index + 1,
        title:tab.title,
        class:classList.join(" ")
      }
      attrs.onclick = onclick.bind(tab)
      attrs.draggable = true;
      

      return m('div.tab', attrs,
        m('div.loader'),
        m('div.actions',
          m('div.action.close', {onclick: close.bind(tab)}, m('span.material-icons',"close"))
        ),
        m('img.icon', {src: favIconUrl}),
        m('div.title', title)
      )
    }
  }
}


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
    if (request.greeting == "hello")
      sendResponse({farewell: "goodbye"});
  }
);
