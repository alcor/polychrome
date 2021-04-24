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
  searchEl.focus();
  //handleInput();
})

window.addEventListener("focus", function(event) { 
  var searchEl = document.getElementById("search");
  searchEl.focus();
}, false);


// Window auto-focus

var focusTimeout = undefined;
document.addEventListener('mouseenter', e => {
  if (myWindowId) chrome.windows.update(myWindowId, { "focused": true })
  focusTimeout = setTimeout(e => {
    //console.log("timeout")
    },1000)
  })

  document.addEventListener('mouseleave', e => {
    clearTimeout(focusTimeout);
  })
  

var activeQuery = undefined;
function searchInput(e) {
  if (!e) return;
  if (e.key == "Escape" && isMenuMode) {
    window.close();
    return;
  }

  var query = e ? e.target.value : undefined;
  activeQuery = query;
  //port.postMessage({query: query});
  //chrome.runtime.sendMessage({ action: 'query', query:query}, function(response) {});
}
  
function sortByDomain(a,b) {
  return (a.url > b.url) ? 1 : ((b.url > a.url) ? -1 : 0)
}
function sortTabs() {
  chrome.windows.getAll({populate:true, windowTypes:['normal']}, w => {
    windows = w;
    console.log(w)
    windows.forEach(win => {
      let tabs = win.tabs
      tabs.sort(sortByDomain);
      console.log(tabs.map(t=>t.url))
      win.tabs.forEach(tab => {






      });
    })
  });
} 






//
// Utility functions
//

var titleReplacements = {
  "www.google.com": /(.*) - Google Search/
}

var iconReplacements = {
  "www.google.com": /(.*) - Google Search/
}

function titleForTab(tab) {
  try {
    url = new URL(tab.url);
  } catch (e) {
    console.log("cannot read url", e, tab.url)
  }

  let replacement = titleReplacements[url.hostname];

  if (replacement) {
    return tab.title.replace(replacement, '$1')
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
    console.log("drag", event.target, draggedTab)

    var dt = event.dataTransfer;
    event.dataTransfer.effectAllowed = 'all';

    dt.setDragImage(draggedTab, 24,12);
    dt.setData("text/uri-list", url);
    dt.setData("text/plain", url);
  })

document.addEventListener("dragenter", function( event ) {
  // prevent default to allow drop
  event.preventDefault();
  let target = event.target;
  target = target.closest('[index]');  
  if (!target) return;

  let dragIndex = parseInt(draggedTab.getAttribute("index"));
  let dropIndex = parseInt(target.getAttribute("index"));
  
  console.log("enter", target.getAttribute("index"), event.target.className)

  if (dropIndex == dragIndex - 1) return; // TODO: Make sure groups aren't different
  if (!target || target == draggedTab) return;
  if (target) target.classList.add("droptarget", true);
}, false);

document.addEventListener("dragleave", function( event ) {
  event.preventDefault();
  let target = event.target;
  target = target.closest("[index]");
  if (!target) return;
  console.log("leave", target.getAttribute("index"), event.target.className)
  if (target) target.classList.remove("droptarget", true);
}, false);

document.addEventListener("dragover", function( event ) {
  let target = event.target;
  target = target.closest("[index]");
  if (target) event.preventDefault();
}, false);

document.addEventListener("drop", function( event ) {
  let target = event.target;
  target = target.closest("[index]");
  if (target) target.classList.remove("droptarget", true);

  draggedTab.classList.remove("dragged");
  if (!target || target == draggedTab) return;
  event.preventDefault();

  console.log("drop on", target)
  let dragId = parseInt(draggedTab.getAttribute("id"));
  let dragIndex = parseInt(draggedTab.getAttribute("index"));
  let dropIndex = parseInt(target.getAttribute("index"));
  let wid = parseInt(target.getAttribute("wid"));
  let gid = parseInt(target.getAttribute("gid"));
  //if (gid < 0) gid = undefined;

  if (dropIndex > dragIndex) dropIndex--;
  console.log(`move to ${wid} > ${gid} to ${dropIndex} from ${dragIndex}`)


  chrome.tabs.query({highlighted:true, windowId:wid}, tabs => {
    var tabIds = tabs.map(tab => tab.id);

    if (!tabIds.includes(dragId)) tabIds = [dragId];
    chrome.tabs.move(tabIds, {index:dropIndex, windowId:wid}, () => {
      console.log("ungroup", gid)
      if (gid == -1) {
        chrome.tabs.ungroup(tabIds)
      } else {
        chrome.tabs.group({groupId:gid, tabIds:tabIds})
      }
    })
  })
  //chrome.tabGroups.move(groupId, {index:index});



}, false);




window.onkeydown = function(event) {

  if(event.metaKey && event.keyCode == 84) { 
    event.preventDefault(); 
  }

  if(event.metaKey && event.keyCode == 83) { 
    event.preventDefault(); 
  } 
  
  if(event.metaKey && event.keyCode == 82) { 
    let options = event.shiftKey ? {} : undefined;
    chrome.tabs.query({highlighted:true, windowId: lastWindowId})
    .then((tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id, options)
      })
    });
    event.preventDefault(); 
  }

  if (event.key == "Backspace" || 
      (event.metaKey && event.keyCode == 87)) { 
    console.log("Hey! Ctrl+W event captured!");
    event.preventDefault();     
    chrome.tabs.query({highlighted:true, windowId: lastWindowId})
    .then((tabs) => {
      console.log(tabs)
      chrome.tabs.remove(tabs.map(t => t.id))
    });
    return false;
  }
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


// Header

function showMenu() {

}




//
// tab Lifecycle
//


var windows = []
function updateTabs() {
  chrome.tabs.query({windowType: 'normal'}, function(tabs) {
    var b = {}
    var groupId = undefined;
    var windowId = -1;
    var groupEl = undefined;
    chrome.windows.getAll({populate:true, windowTypes:['normal']}, w => {
      windows = w;
      m.redraw();
    });
    return;
  });
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
chrome.windows.onCreated.addListener(updateTabs);
chrome.windows.onFocusChanged.addListener((w) => {
  if (w != myWindowId) {
    lastWindowId = w;
    updateTabs();
  }
});
chrome.windows.onRemoved.addListener(updateTabs);
chrome.tabGroups.onCreated.addListener(updateTabs);
chrome.tabGroups.onMoved.addListener(updateTabs);
chrome.tabGroups.onRemoved.addListener(updateTabs);
chrome.tabGroups.onUpdated.addListener(updateGroup);

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

var Toolbar = function(vnode) {
  return {
    view: function() {
      return m("div.toolbar", 
        m(Search),
        m('div.button', {onclick:sortTabs}, m('span.material-icons','sort')),
        myWindowId ? undefined : m('div.button#popout', {onclick:popOutSidebar}, m('span.material-icons','open_in_new')),
        m('div.button', {onclick:showMenu}, m('span.material-icons','more_vert'))
      )   
    }
  }
}

var Search = function(vnode) {
  return {
    view: function() {
      return [
        m("div.search#search", m("input", {type:"search", key:"search", placeholder:"Search"}))
      ]  
    }
  }
}


var WindowList = function(vnode) {
  return {
    view: function(vnode) {
      if (!vnode.attrs.windows.length) return ""
      return vnode.attrs.windows.map(w => { return m(Window, {window:w, key:w.id})})
    }
  }
}

var groupInfo = {}
var Window = function(vnode) {
  return {
    view: function(vnode) {
      let w = vnode.attrs.window;
      
      groups = []
      children = []
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
      if (w.focused) classList.push('focused');

      return m('div.window', {class:classList}, [
          m('div.title', "Window " + w.id),
          m('div.contents', groups.map((group, i) => m(TabGroup, {group, key:group.id > 0 ? group.id : i})))
      ])
    }
  }
}

var tabOpeners = JSON.parse(localStorage.getItem('tabOpeners')) || {}

setTimeout(updateOpeners, 1000)

function updateOpeners() {
  var promises = [];
  for (tabId in tabOpeners) {

    promises.push(chrome.tabs.get(parseInt(tabId))
      .then((tab) => {
        //console.log("Found", tabId)
      })
      .catch((error) => {
        console.log("Did not find", tabId, tabOpeners[tabId])
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
    e.butt
    console.log(e)
    chrome.tabGroups.update(this.id, { 'collapsed': !this.info.collapsed });
  }
  function oncontextmenu (e) {
    e.preventDefault();
    let title = prompt("Rename Group", this.info.title)
    console.log(this, title)
    if (title) chrome.tabGroups.update(this.id, {title: title})
  }
  return {
    view: function(vnode) {
      let group = vnode.attrs.group;
      let attrs = {}
      let classList = [];
      if (group.info && group.id > 0) {
        classList.push(group.info.color);
        if (group.info.collapsed) classList.push("collapsed");
        attrs.onclick = onclick.bind(group)
        attrs.oncontextmenu = oncontextmenu.bind(group)
      } else {
        classList.push("no-group");
      }

      let title = group.info ? (group.info.title || (group.info.color)) : "Ungrouped";
      if (group.id == -2) title = "Pinned"
      attrs.wid = group.tabs[0].windowId
      attrs.gid = group.id
      attrs.index = group.tabs[0].index
    
      let children = [];
      let lastTab = {};
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
              || (opener == lastTab.openerTabId && lastTab.indented)) {
            tab.indented = true;
          }
        }

        lastTab = tab;
        children.push(m(Tab, {tab}))
      })

      return m('div.group', {class:classList.join(" ")},
        m('div.header', attrs, m('div.title', title)),
        children
      )
       
  
    }
  }
}


let favicons = {
  "newtab": "about:blank"
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
        chrome.windows.update(this.windowId, { "focused": true }, () => {
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
      let favIconUrl = tab.favIconUrl || favicons[host] || `https://www.google.com/s2/favicons?domain=${host}`

      var classList = [];
      if (tab.pinned) classList.push('pinned')
      if (tab.active) classList.push('active')
      if (host) classList.push("host-" + host.replace(/\./g,"-"))
      classList.push(tab.status)

      if (tab.audible) classList.push('audible');
      if (tab.discarded) classList.push('discarded');
      if (tab.highlighted) classList.push('highlighted');
      if (tab.isQuery) classList.push('query');
      if (tab.indented) {
        classList.push('indented');
        //console.log("OPENER", tab.openerTabId)
      }

      let title = titleForTab(tab)

      let attrs = {
        id: tab.id,
        wid: tab.windowId,
        gid: tab.groupId,
        index: tab.index + 1,
        title:title,
        class:classList.join(" "),
        style:`background-image:url(${tab.favIconUrl})`,
      }

      attrs.onclick = onclick.bind(tab)
      attrs.draggable = true;
      

      return m('div.tab', attrs,
        m('div.loader'),
        m('div.close', {onclick: close.bind(tab)}, '×'),
        m('div.title', title)
      )
    }
  }
}