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
  }
});

document.addEventListener('DOMContentLoaded', function() {
  var root = document.body
  m.mount(root, WindowManager)
  var searchEl = document.getElementById("search");
  searchEl.oninput = searchInput;
  searchEl.onkeypress = searchKey;
  searchEl.focus();
  //handleInput();
})

window.addEventListener("focus", function(event) { 
  var searchEl = document.getElementById("search");
  searchEl.focus();
  document.execCommand('selectAll',false,null)
}, false);

window.addEventListener("click", function(event) { 
  if (contextTarget && !event.target.closest("menu")) {
    clearContext();
    m.redraw();
  }
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
var activeQueryItems = undefined;
var activeQueryIndex = 0;

function searchInput(e) {
  if (!e) return;
  var query = e ? e.target.value : undefined;
  activeQuery = query;
  activeQueryItems = [];
  activeQueryIndex = 0;
  m.redraw.sync();

  let tab = document.querySelector(".tab") 
  focusTab(parseInt(tab.getAttribute("id")))
}

function searchKey(e) {

  if (e.key == "Escape" && isMenuMode) {
    window.close();
    return;
  }
  if (e.key == "Enter") {
    let tabs = document.getElementsByClassName("tab");
    let tab = Array.from(tabs).filter(t => t.classList.contains('active'))[0];
    console.log("active", tab, tabs)
    let id = parseInt(tab.getAttribute('id'))
    let wid =  parseInt(tab.getAttribute('wid'))
    focusTab(id, wid, true);
    e.target.value = "";
    activeQuery = ""
    activeQueryItems = undefined
    activeQueryIndex = 0;
    m.redraw;
    return;
  }
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

      let groups = {}

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
        if (tab.pinned) return;
        if (preserveGroups && tab.groupId > 0) return;
        orderedIds.push(tab.id);
        let cluster = tab.hostname;
        if (cluster) {
          if (!groups[cluster]) groups[cluster] = [];
          groups[cluster].push(tab.id) 
        }
      });
      console.log(orderedIds)
      chrome.tabs.move(orderedIds, {index:-1, windowId:w.id});
      //if (!preserveGroups) 
      chrome.tabs.ungroup(orderedIds)
      .then(() => {
        var otherTabs = [];
        if (type == 'domain') {
          for (var cluster in groups) {
            let tabIds = groups[cluster];
            if (tabIds.length > 1) {
              let components = cluster.split(".");
              if (components[0] == "www") components.shift();
              components.pop();
              let name = components.reverse().join(" • ");

              chrome.tabs.group({tabIds:tabIds, createProperties:{windowId:w.id}})
              .then(group => { chrome.tabGroups.update(group, {title: name})})
            } else {
              otherTabs.push(tabIds[0])
            }
          }

          console.log("otherTabs", otherTabs)
          chrome.tabs.group({tabIds:otherTabs, createProperties:{windowId:w.id}})
          .then(gid => chrome.tabGroups.update(gid, {title: "Other"}))
          .then(group => chrome.tabGroups.move(group.id, {index:-1, windowId:w.id}))
          .then(() => chrome.tabs.ungroup(otherTabs))
        }
      })
    })
  });
} 

function removeDuplicates() {
  chrome.runtime.sendMessage({action:'removeDuplicates'}, (response) => {
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
  "www.google.com": /(?<title>.*) - (?<app>Google) Search/,
  "www.amazon.com": /(?<app>Amazon)\.com: (?<title>.*)/,
  "app.slack.com": /(?<app>Slack) \| (?<title>.*)/,
}

var iconReplacements = {
  "www.google.com": /(.*) - Google Search/
}

function titleForTab(tab) {
  let title = tab.title;
  let app = undefined;
  if (tab.url.length) {
    let url;

    try {
      url = new URL(tab.url);
    } catch (e) {
      console.log(`cannot read url "${tab.url}"`, e)
    }

    //app = url.host;

    if (simplifyTitles) {
      let replacement = titleReplacements[url.hostname];

      if (replacement) {
        let match = title.match(replacement);
        
        if (match) {
          title = match.groups.title;
          app = match.groups.app;
    
        }
        //title = tab.title.replace(replacement, '$1')
      } else {
        let components = tab.title.split(/\s[-–—•|]\s/g);
        if (components.length > 1) app = components.pop();
        title = components.join(' • ');
      }
    }
  }
  return {title, app};
}

//
// Drag and Drop
//

var draggedItem = undefined;
document.addEventListener("dragstart", function( event ) {
    let target = event.target;
    target = target.closest("[index]");
    draggedItem = target
    draggedItem.classList.add("dragged");

    let url = "about:blank";
    var dt = event.dataTransfer;
    dt.effectAllowed = 'all';
    dt.setDragImage(draggedItem, 24,12);
    dt.setData("text/uri-list", url);
    dt.setData("text/plain", url);

  })

document.addEventListener("dragenter", function( event ) {
  event.preventDefault();
  let target = event.target;
  target = target.closest('[index]');  
  if (!target) return;

  let dragIndex = parseInt(draggedItem.getAttribute("index"));
  let dropIndex = parseInt(target.getAttribute("index"));
  
  console.log("target", target)
  if (!target || target == draggedItem) return;
  if (target) target.classList.add("droptarget", true);
  console.log("target2", target)
}, false);

document.addEventListener("dragleave", function( event ) {
  event.preventDefault();
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");
  if (!target) return;
  console.log("leave", target)
  if (target) {
    target.classList.remove("droptarget", true);
    target.classList.remove("after", true);
  }
}, false);

document.addEventListener("dragover", function( event ) {
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");
  if (target) {
    event.preventDefault();
    let bottomHalf = event.offsetY >= target.clientHeight / 2;
    target.classList.toggle("after", bottomHalf);

    let dropIndex = parseInt(target.getAttribute("index")) || -1;
    //console.log("dropping on ", bottomHalf, event.offsetY);

  }
}, false);

document.addEventListener("drop", function( event ) {
  let target = event.target;
  if (target != document.body) target = target.closest("[index]");


  let after = target.classList.contains("after");
  if (target) {
    target.classList.remove("droptarget", true);
    target.classList.remove("after", true);
  }

  draggedItem.classList.remove("dragged");
  if (!target || target == draggedItem) return;
  event.preventDefault();

  console.log("dragging", draggedItem, target)
  let dragId = parseInt(draggedItem.getAttribute("id"));
  let dragIndex = parseInt(draggedItem.getAttribute("index"));
  let dropIndex = target.getAttribute("index") ? parseInt(target.getAttribute("index")) : -1;
  let dropWid = parseInt(target.getAttribute("wid")) || parseInt(draggedItem.getAttribute("wid"));
  let dragGid = parseInt(draggedItem.getAttribute("gid")) || -1;
  let dropGid = parseInt(target.getAttribute("gid")) || -1;
  let groupDrag = draggedItem.classList.contains("header");


  if (after) dropIndex++;
  console.log(`move from ${dragIndex} to ${dropIndex}  in w:${dropWid} > g:${dropGid}`)
if (dropIndex > dragIndex) dropIndex--;
  console.log(`move from ${dragIndex} to ${dropIndex}  in w:${dropWid} > g:${dropGid}`)


  if (groupDrag) {
    chrome.tabGroups.move(dragGid, {index:dropIndex, windowId:dropWid})
    
  } else {
    chrome.tabs.query({highlighted:true, windowId:dropWid})
    .then(tabs => {
      var tabIds = tabs.map(tab => tab.id);
      if (!tabIds.includes(dragId)) tabIds = [dragId];
      chrome.tabs.move(tabIds, {index:dropIndex, windowId:dropWid}, () => {
        if (dropGid == -1) {
          chrome.tabs.ungroup(tabIds)
        } else {
          chrome.tabs.group({groupId:dropGid, tabIds:tabIds})
        }
      })
    })
  }

}, false);

document.addEventListener("dragend", function( event ) {
  draggedItem.classList.remove("dragged");
  draggedItem = undefined;
})

window.onkeydown = function(event) {
  if (event.key == "ArrowUp" || event.key == "ArrowDown") {
    let direction = event.key == "ArrowDown" ? 1 : -1;
    event.preventDefault();

    if(!isMenuMode) {
      let tabs = document.querySelectorAll(".tab")
      tabs = Array.from(tabs);
      console.log("tabs", tabs)
      let index = tabs.findIndex(t => t.classList.contains("active"))
      console.log("index", index)
  
      index = index + direction;
      let tab = tabs[index] || tabs[0];
      focusTab(parseInt(tab.getAttribute("id")))
    }
  } 
  if (event.metaKey && event.key == 't') { // C-T
    chrome.tabs.create({})
      .then ((tab) => {    
        console.log("tab", tab)
        chrome.windows.update(tab.windowId, { "focused": true })
      }) 
    event.preventDefault(); 
  } else if(event.metaKey && event.key == 's') {  // C-S
    event.preventDefault(); 
  } else if(event.metaKey && event.key == 'g') {  // C-G
    groupTabs(event);
    event.preventDefault(); 
    event.stopPropagation();
  } else if(event.metaKey && event.key == 'r') {  // C-R
    let options = event.shiftKey ? {} : undefined;
    chrome.tabs.query({highlighted:true, windowId: lastWindowId})
    .then((tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id, options)
      })
    });
    event.preventDefault(); 
  } else if ((event.key == "Backspace" && event.target == document.body)
     || (event.metaKey && event.key == 'w')) { 
    event.preventDefault();     
    closeTab();
    return false;
  }
  if (event.key == "Enter" && event.target != document.body) { 
    let header = event.target.closest('.header');
    let gid = parseInt(header.getAttribute("gid"));
    chrome.tabGroups.update(gid, {title: event.target.innerText.trim()})
    event.target.blur();
    groupBeingEdited = undefined;
    event.preventDefault();
    event.stopPropagation();
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
    window.close();
  });
}

function showMenu() {
}



//
// tab lifecycle
//


var windows = []
function sortWindows(w1,w2) {
  let i, j;
  for (i = 0; i < w1.tabs.length; i++) { if (!w1.tabs[i] || !w1.tabs[i].pinned) break; }
  for (j = 0; j < w1.tabs.length; j++) { if (!w2.tabs[j] || !w2.tabs[j].pinned) break; } 
  if (j - i == 0) return w2.tabs.length - w1.tabs.length;
  return j - i;
}
function updateWindows(...args) {
  //console.log("update", this, args)
  var b = {}
  var groupId = undefined;
  var windowId = -1;
  var groupEl = undefined;
  chrome.windows.getAll({populate:true, windowTypes:['normal']}, w => {
    windows = w;
    windows.sort(sortWindows);
    if (!lastWindowId) lastWindowId = windows[0].id;
    m.redraw();

    if (this == 'tabs.onActivated') {
      let id = args[0].tabId;
      let el = document.getElementById(id);
      scrollToElement(el);
    }
  });
  return;
}

function scrollToElement(el) {
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var elemTop = rect.top;
  var elemBottom = rect.bottom;

  // Only completely visible elements return true:
  var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);

  el.scrollIntoView({behavior: "smooth", block: "nearest"});
}

function updateTab(tabId, changeInfo, tab) {
  
  for (var w of windows) {
    if (w.id == tab.windowId) {
      w.tabs[tab.index] = tab;
      if (changeInfo.groupId != -1) m.redraw();
      return;
    }
  }
}
function updateGroup(tabGroup) {
  groupInfo[tabGroup.id] = tabGroup;
  m.redraw();
}

function tabCreated(tab) {
  if (tab.pendingUrl == "chrome://newtab/") {
    focusWindow(tab.windowId)
  }
  updateWindows();
}

chrome.tabs.onActivated.addListener(updateWindows.bind("tabs.onActivated"));
chrome.tabs.onAttached.addListener(updateWindows.bind("tabs.onAttached"));
chrome.tabs.onCreated.addListener(tabCreated);
chrome.tabs.onDetached.addListener(updateWindows.bind("tabs.onDetached"));
chrome.tabs.onHighlighted.addListener(updateWindows.bind("tabs.onHighlighted"));
chrome.tabs.onMoved.addListener(updateWindows.bind("tabs.onMoved"));
chrome.tabs.onRemoved.addListener(updateWindows.bind("tabs.onRemoved"));
chrome.tabs.onReplaced.addListener(updateWindows.bind("tabs.onReplaced"));
chrome.tabs.onUpdated.addListener(updateTab);
chrome.tabGroups.onCreated.addListener(updateWindows.bind(""));
chrome.tabGroups.onMoved.addListener(updateWindows.bind(""));
chrome.tabGroups.onRemoved.addListener(updateWindows.bind(""));
chrome.tabGroups.onUpdated.addListener(updateGroup);
chrome.windows.onCreated.addListener(updateWindows.bind(""));
chrome.windows.onRemoved.addListener(updateWindows.bind(""));
chrome.windows.onFocusChanged.addListener((w) => {
  if (w != myWindowId && w > 0) {
    lastWindowId = w;
    updateWindows();
  }
});

updateWindows()




//
// Mithril Classes
//

var WindowManager = function(vnode) {
  return {
    view: function(vnode) {
      return [
        m(Toolbar),
        m(WindowList, {windows:windows}),
        m(ContextMenu),
        m(ArchivedGroups)
      ] 
    }
  }
}

function discardAllTabs() {
  windows.forEach(w => {
    w.tabs.forEach(tab => {
      if (!tab.active && !tab.discarded) chrome.tabs.discard(tab.id)
    })  
  })
}

function refresh() {
  chrome.runtime.sendMessage({action:'reload'}, (response) => {
    window.location.reload()
  });
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
          m('div', {onclick:() => { removeDuplicates() }}, "Remove Duplicates"),
          m('div', {onclick:() => { discardAllTabs() }}, "Unload all tabs"),
          m('hr'),

          m('div', {onclick:() => { sortTabs('domain') }}, "Group by Domain"),
            //m('div.disabled', {onclick:() => { sortTabs('type') }}, "Sort by Type"),
            m('div', {onclick:() => { sortTabs('title') }}, "Sort by Title"),
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
            m('div', {onclick: refresh},"Refresh")
          )
        )
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
      return m('div.windows#windows', vnode.attrs.windows.map(w => { return m(Window, {window:w, key:w.id})}));
      
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

      return m('div.window', {class:classList,
            onclick:(e) => {clearContext(); e.preventDefault();},
            oncontextmenu: (e) => {e.preventDefault();}}, [
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


let contextTarget = undefined;
let contextEvent = undefined;
function clearContext() {
  contextTarget = undefined;
  contextEvent = undefined;
}

function showContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  contextTarget = this;
  contextEvent = e;
}


// var ContextMenu = function(vnode) {
//   return {
//     view: function() {
//       if (contextTarget) {
//         if (contextTarget.groupId) {
//           return m(TabMenu, {tab:contextTarget}) 
//         } else {
//           return m(TabGroupMenu, {group:contextTarget}) 
//         }
//       }
//       return undefined;
//     }
//   }
// }

var ContextMenu = function(vnode) {
  return {
     view: function(vnode) {
      if (!contextTarget) return undefined;
       let item = contextTarget;
       let isTab = contextTarget.groupId != undefined;
       let e = contextEvent;
       let target = e.target.closest("[index]");
       let style = {}
       var rect = target.getBoundingClientRect();
       style.top = window.scrollY + (rect.bottom - 2) + "px";
       if (e.clientX < window.innerWidth / 2) {
        style.left = e.clientX + "px";
       } else {
        style.right = Math.max(window.innerWidth - rect.right, 4) + "px";
       }

       if (isTab) {
        return m("div.menu#contextmenu", {class:'visible', style:style},
          m('div.action.group-tabs', {title:'Group', onclick:groupTabs.bind(item)},
            m('span.material-icons',"layers"), 'Group Tabs'),
            m('div.action.archive', {title:'Archive', onclick:archiveTab.bind(item)}, 
              m('span.material-icons',"save_alt"), "Archive"),
            m('div.action.close', {onclick: close.bind(item)}, m('span.material-icons',"close"), "Close")
          // m('div.action.popout', {title:'Pop Out', onclick:popOutTab.bind(item)},
          //   m('span.material-icons',"open_in_new"), 'Move to new window')
        );
       } else {
        return m("div.menu#contextmenu", {class:'visible', style:style},
          m('div.action.archive', {title:'Archive', onclick:archiveGroup.bind(item)},
            m('span.material-icons',"save_alt"), "Archive group"),
          m('div.action.close', {title:'Close', onclick:closeGroup.bind(item)},
            m('span.material-icons',"close"), 'Close group'),
            m('hr'),

          m('div.action.popout', {title:'Open in new window', onclick:popOutGroup.bind(item)},
            m('span.material-icons',"open_in_new"), 'Move to new window'),
          m('div.action.ungroup', {title:'Ungroup', onclick:ungroupGroup.bind(item)},
            m('span.material-icons',"layers_clear"), 'Ungroup'),
          m('div.action.rename', {title:'Rename', onclick:editGroup.bind(item.id)},
            m('span.material-icons',"edit"), 'Rename'),


          );
      }

    }
  }
}


function popOutGroup(e) {
  e.stopPropagation();
  clearContext();

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

function archiveTab(e) {
  e.stopPropagation();
}


let colorEmoji = { grey: "⚪️", blue: "🔵", red: "🔴", yellow: "🟡", green: "🟢", pink: "🌸", purple: "🟣", cyan: "🌐" }



function emojiTitleForGroupInfo(info) {
  return `${colorEmoji[info.color]} ${info.title || info.color}`;
}

function archiveGroupToDataURL(group) {
  let links = group.tabs.map((tab) => `<p><a href="${tab.url}">${tab.title}</a>`)
  let html = [
    `${group.info.title || group.info.color}`,
    `${links.join('')}`,
    `<meta charset="UTF-8">`,
    `<title>${group.info.title}</title>`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<style>b{color:${group.info.color}}\nbody{max-width:30em;margin:10vh auto;padding:2em;font-family:system-ui;}</style>`
  ].join('');

  let url = 'data:text/html,' + encodeURIComponent(html).replace(/%20/g, " ");
  return chrome.bookmarks.create({parentId: "1", title: emojiTitleForGroupInfo(group.info), url:url})
}

async function archiveGroup(e) {
  e.stopPropagation();
  let group = this;
  let title = group.info.title || group.info.color;
  let fancyTitle = `${colorEmoji[group.info.color]} ${title}`;

  let info = {
    title: group.info.title,
    color: group.info.color,
    tabs: group.tabs.map( (tab) => ({url: tab.url, title:tab.title}) )
  };
  
  let key = 'group-' + title;
  let record = {};
  record[key] = info
  
  let storage = chrome.storage.sync;
  storage.set(record, (r1) => {
    groupList[key] = info;
    m.redraw();
    storage.get(key, (r2) => {
          console.log("Set",r2);

    })
  })

  chrome.tabs.remove(this.tabs.reverse().map(t => t.id))
  
  // getBookmarkRoot()
  // .then(rootId => {
  //   console.log("got id", rootId, group)
  //   // return chrome.bookmarks.create({parentId: rootId, title: title})
  // })
  // .then((folder) => {
  //   let promises = [];
  //   let urlArray = group.tabs.map(tab => {return tab.url;})
  //   urlArray = encodeURIComponent(JSON.stringify(urlArray))
  //   return chrome.bookmarks.create({parentId: "1", title: fancyTitle, url:url})
  //   group.tabs.forEach(tab => {
  //     promises.push(chrome.bookmarks.create({parentId: folder.id, title: tab.title, url: tab.url}))
  //   })
  //   return Promise.all(promises);
  // })
  // .then(results => {
  //   chrome.tabs.remove(this.tabs.map(t => t.id))
  // })
}

var bookmarkRoot = getDefault(v({bookmarkRoot}));
let BOOKMARK_FOLDER_TITLE = "Tab Archive​";

async function getBookmarkRoot() {
  getDefault(v({bookmarkRoot}));
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
      folder = await chrome.bookmarks.create({parentId: '2', 'title': BOOKMARK_FOLDER_TITLE, index:0});
    }

    if (folder.id) {
      setDefault(v({bookmarkRoot}), bookmarkRoot = folder.id)      
    }
  }
  return bookmarkRoot;
}



function closeGroup(e) {
  e.stopPropagation();
  clearContext();
  chrome.tabs.remove(this.tabs.map(t => t.id))
}

function ungroupGroup(e) {
  e.stopPropagation();
  clearContext();
  chrome.tabs.ungroup(this.tabs.map(t => t.id))
}

function groupTabs(e) {
  e.stopPropagation();
  clearContext();
  //let title = prompt("New Group")
  let windowID = this ? this.windowId : lastWindowId;
  if (true) {
    chrome.tabs.query({highlighted:true, windowId:windowID})
    .then(tabs => {
      chrome.tabs.group({tabIds:tabs.map(t => t.id), createProperties:{windowId:windowID}})
      .then(group => { 
        setTimeout(editGroup.bind(group), 50);
//        chrome.tabGroups.update(group, {title: title})
      })
    })
  }
}

function popOutTab(e){

 }


 
function editGroup(e) {

  groupBeingEdited = this;
  m.redraw();
  if (e) e.stopPropagation();
  clearContext();
  let el = document.getElementById(this + "-title")
  el.focus();
  el.onblur = () => {
    window.getSelection().removeAllRanges();
    groupBeingEdited = undefined;
  }
  document.execCommand('selectAll',false,null)
}

function groupRenameEvent(e) {
  if (e.key == "Enter") {
    let group = this;
    let title = e.target.innerText.trim();
    console.log(title, e);

    chrome.tabGroups.update(this.id, {title: title})
  }
}

function newTabInGroup(e) {
  e.preventDefault();
  e.stopPropagation();
  clearContext();
  chrome.windows.update(lastWindowId, { "focused": true })
  .then((win) => 
    chrome.tabs.create({windowId:win.id})
  ).then ((tab) =>
    chrome.tabs.group({groupId:this.id, tabIds:[tab.id]})
  )
}

function openerForTab(tab) {
  return tab.openerTabId || tabOpeners[tab.id];
}

let groupBeingEdited = undefined;
var TabGroup = function(vnode) {
  function onclick (e) {
    chrome.tabGroups.update(this.id, { 'collapsed': !this.info.collapsed });
    clearContext();
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
        attrs.oncontextmenu = showContextMenu.bind(group)
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

      let tabs = group.tabs;
      tabs.forEach((tab, i) => {
        let isQuery = tab.url.startsWith("https://www.google.com/search")
        if (isQuery) tab.isQuery = true;

        
        let opener = tab.openerTabId || tabOpeners[tab.id];

        let index = openerStack.indexOf(opener);
        if (isQuery) index = -1;
        if (index == -1 && (lastTab.indent > 1)) {
          lastTab.endOfCluster = true;
        }
        openerStack.splice(index + 1)
        tab.indent = isQuery ? 0 : openerStack.length + 1;

        if (lastTab.id == openerStack[0]) {
          lastTab.startOfCluster = true;
        }
        openerStack.push(tab.id);
  
        tab.openerStack = openerStack.join(".")
        if (opener) {
          if (!tabOpeners[tab.id]) {
            tabOpeners[tab.id] = tab.openerTabId;
            saveOpeners();
          } 
        }

        lastTab = tab;

        if (activeQuery) {
          if (!tab.title.toLowerCase().includes(activeQuery) 
           && !tab.url.includes(activeQuery)
            ) {
            return;
          }
          if (activeQueryIndex == activeQueryItems.length) tab.activeResult = true;
          console.log("t", tab.activeResult, tab.title)
          activeQueryItems.push(tab.id);
        }
        children.push(m(Tab, {tab}))
      })
      
      if (collapsed && (!activeQuery  || activeQuery.length <= 1)) classList.push("collapsed");
      let height = collapsed ? 0 : children.length + 1;

      attrs.draggable = true;
      attrs.index = group.tabs[0].index

      if (contextTarget && (group.id == contextTarget.id)) attrs.class = ("showingMenu");

      if (activeQuery && !children.length) return;

      if (groupBeingEdited == group.id) classList.push("editing");

      return m('div.group', {class:classList.join(" "), style:`flex-grow:${height}`},
        m('div.header', attrs,
          m('div.actions',
            m('div.action.edit', {title:'Rename', onclick:editGroup.bind(group.id)}, m('span.material-icons',"edit")),
            m('div.action.newtab', {title:'New tab in group', onclick:newTabInGroup.bind(group)}, m('span.material-icons',"add_circle_outline")),
            m('div.action.more', {title:'Menu', onclick:showContextMenu.bind(group)}, m('span.material-icons',"more_vert"))
            //m('div.action.archive', {title:'Menu', onclick:showContextMenu.bind(group)}, m('span.material-icons',"close"))
          ),
          m('div.title', {id: group.id + "-title", contenteditable:true}, m.trust(title)),
          group.info ? m(ColorPicker, {color:group.info.color, gid:group.id}) : undefined
        ),
        children
      )
       
  
    }
  }
}


let groupList = []

async function loadGroups() {
  let storage = chrome.storage.sync;
  storage.get(null, (result) => {
    for (var key in result) {
      if (!key.startsWith("group")) continue;
      groupList.push(result[key])
    }
    console.log("Loaded Groups",groupList);
  });
}
loadGroups()


let restoreGroup = async (group) => {
  console.log("restore", group)

  let existing = (await chrome.tabGroups.query({title: group.title}))[0]
  if (existing) {
    console.log("existing", existing)
  } else {
    let promises = group.tabs.map((tab, i) => chrome.tabs.create({url: tab.url, selected:false, active:false}))
    Promise.all(promises)
    .then (tabs => {
      return chrome.tabs.group({tabIds:tabs.map(t => t.id), createProperties:{windowId: tabs[0].windowId}})
      .then((gid) => {
        chrome.tabs.update(tabs[0].id, { 'active': true });
        chrome.tabGroups.update(gid, {title:title, color:color})
      })
    }); 
  } 
};

var ArchivedGroups = function(vnode) {


  return {
    view: function(vnode) {
      return m('div.group-archive',
        groupList.map( g => m('div.group-token', {class:g.color, onclick:restoreGroup.bind(null,g)}, g.title || g.color))
      )
    }
  }
}


var ColorPicker = function(vnode) {
  let selectColor = (gid, color) => {
    chrome.tabGroups.update(gid, {color: color});
  }
  return {
    view: function(vnode) {
      let attrs = vnode.attrs;
      let colors = [];
      for (let color in colorEmoji) {
        colors.push(m('div.color', {class:color, onclick:() => selectColor(attrs.gid, color)}))
      }
      return m('div.colorpicker',
        colors
      )
    }
  }
}




let favicons = {
  "chrome": "./img/newtab.png"
}

function focusTab(id, wid, focusTheWindow) {
  chrome.tabs.update(id, { 'active': true });
  
  if (wid && (focusTheWindow || wid != lastWindowId)) { 
    focusWindow(wid, myWindowId && !focusTheWindow)
  }
}

async function focusWindow(wid, reactivateSelf) {
  await chrome.windows.update(wid, { "focused": true });
  if (reactivateSelf) {
    chrome.windows.update(myWindowId, { "focused": true })
  }
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
      focusTab(this.id, this.windowId)
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
      if (tab.highlighted) classList.push('highlighted');
      if (host) classList.push("host-" + host.replace(/\./g,"-"))
      classList.push(tab.status)

      if (tab.audible) classList.push('audible');
      if (tab.discarded) classList.push('discarded');
      if (tab.startOfCluster) classList.push('cluster-start');
      if (tab.endOfCluster) classList.push('cluster-end');
      if (tab.isQuery && simplifyTitles) classList.push('query');
      if (tab.indent != undefined) {
        classList.push('indent-' + tab.indent);
      }


      if (contextTarget && (tab.id == contextTarget.id)) classList.push("showingMenu");
      let titles = titleForTab(tab)
      
      let emojicon = undefined;
      let match = titles.title.match(/(\p{Extended_Pictographic}+)/u)
      if ( match ) {
        emojicon = match[1];// runes(match[1]);
        titles.title = titles.title.replace(match[1], "")
      }

      let attrs = {
        id: tab.id,
        opener:tab.openerTabId || tabOpeners[tab.id],
        wid: tab.windowId,
        gid: tab.groupId,
        index: tab.index,
        title:tab.title + "\n" + host,
        class:classList.join(" "),
        oncontextmenu: showContextMenu.bind(tab)
      }
      attrs.onclick = onclick.bind(tab)
      attrs.draggable = true;
      
      //titles.title = `${tab.openerStack} - ${titles.title}`
      return m('div.tab', attrs,
        m('div.loader'),
        m('div.actions',
          m('div.action.archive', {title:'Archive', onclick:archiveTab.bind(tab)}, m('span.material-icons',"save_alt")),
          
          m('div.action.close', {onclick: close.bind(tab)}, m('span.material-icons',"close"))
        ),
        emojicon ? m('span.icon', emojicon) : m('img.icon', {src: favIconUrl}),
        m('div.title', titles.title, titles.app ? m('span.app', " • " + titles.app) : undefined)
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
