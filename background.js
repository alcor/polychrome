var FOLDER_TITLE = 'Astrolabe'
var rootFolder = undefined;

chrome.runtime.onInstalled.addListener(function() {
  console.log("Astrolabe Installed");
});