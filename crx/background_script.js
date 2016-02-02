/* global chrome */
var	tabsManifest = {},
	settings = {},
	advSettings = {},
	windowStatus = {},
	moverTimeOut = {},
	listeners = {};	
// Runs initSettings 
initSettings();	

function initSettings(){
	badgeTabs("default");
	createBaseSettingsIfTheyDontExist();
	addEventListeners(function(){
		autoStartIfEnabled(chrome.windows.WINDOW_ID_CURRENT);
	});	
}
// **** Tab Functionality ****
// Start revolving the tabs
function go(windowId) {	
	chrome.tabs.query({"windowId": windowId, "active": true}, function(tab){
			grabTabSettings(windowId, tab[0], function(tabSetting){
				setMoverTimeout(windowId, tabSetting.seconds);
				windowStatus[windowId] = "on";
				badgeTabs('on', windowId);
			});	
		});
}
// Stop revolving the tabs
function stop(windowId) {
	removeTimeout(windowId);
	chrome.tabs.query({"windowId": windowId, "active": true}, function(tab){
		windowStatus[windowId] = "off";
		badgeTabs('', windowId);
	});
}
// Switch to the next tab.
function activateTab(nextTab) {
	grabTabSettings(nextTab.windowId, nextTab, function(tabSetting){
		if(tabSetting.reload && nextTab.url.substring(0,19) != "chrome://extensions"){
			chrome.tabs.reload(nextTab.id, function(){
				chrome.tabs.update(nextTab.id, {selected: true}, function(){
					setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
				});
			});
		} else {
			// Switch Tab right away
			chrome.tabs.update(nextTab.id, {selected: true});
			setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
		}	
	});
}
// Call moveTab if the user isn't interacting with the machine
function moveTabIfIdle(timerWindowId, tabTimeout) {
	if (settings.inactive) {
		// 15 is the lowest allowable number of seconds for this call
		chrome.idle.queryState(15, function(state) {
			if(state == 'idle') {
				windowStatus[timerWindowId] = "on";
				badgeTabs("on", timerWindowId);
				return moveTab(timerWindowId);
			} else {
				windowStatus[timerWindowId] = "pause";
				badgeTabs("pause", timerWindowId);
				return setMoverTimeout(timerWindowId, tabTimeout);
			}
		});
	} else {
		moveTab(timerWindowId);
	}
}
// Switches to next tab in the index, re-requests feed if at end of the index.
function moveTab(timerWindowId) {
	getRotationUrls(function(){
		chrome.tabs.query({"windowId": timerWindowId},function(tabs){		
			synchroniseTabs(tabs, timerWindowId, function(){
				updateSettings(function(){
					var nextTabIndex = 0;
					chrome.tabs.getSelected(timerWindowId, function(currentTab){
						chrome.tabs.getAllInWindow(timerWindowId, function(tabs) {
							
							if(currentTab.index + 1 < tabs.length) {
								nextTabIndex = currentTab.index + 1;
							} else {
								nextTabIndex = 0;
							}
							
							nextTabIndex = tryGetNextTabIndex(tabs, nextTabIndex, nextTabIndex);			

							activateTab(tabs[nextTabIndex]);
						});
					});
				});
			})
		})
	});
}

//try to get the next rotationurl
function tryGetNextTabIndex(tabs,index,original){		
	if(!isARotationUrl(tabs[index].url)){
		if(index < tabs.length-1) {
			index++;
		} else {
			index=0;
		}
		if(index == original) return original;//recursive break
		return tryGetNextTabIndex(tabs, index, original);

	}else{
		return index;
	}
}

// **** Event Listeners ****
// Creates all of the event listeners to start/stop the extension and ensure badge text is up to date.
function addEventListeners(callback){
	chrome.browserAction.onClicked.addListener(function(tab) {
		var windowId = tab.windowId;
		if (windowStatus[windowId] == "on" || windowStatus[windowId] == "pause") {
			stop(windowId);
		} else {
			createTabsManifest(windowId, function(){
				go(windowId);
			});
		}
	});	
	chrome.windows.onRemoved.addListener(
		listeners.onWindowRemoved = function(windowId){
			removeTimeout(windowId);
			delete moverTimeOut[windowId];
			delete windowStatus[windowId];
			delete tabsManifest[windowId];
		}
	);
	chrome.tabs.onCreated.addListener(
		listeners.onCreated = function (tab){
			createTabsManifest(tab.windowId, function(){
				setBadgeStatusOnActiveWindow(tab);	
			});
		}
	);
	chrome.tabs.onUpdated.addListener(
		listeners.onUpdated = function onUpdated(tabId, changeObj, tab){
			setBadgeStatusOnActiveWindow(tab);
			if(changeObj.url) createTabsManifest(tab.windowId, function(){
				return true;
			});
		}
	);
	chrome.tabs.onActivated.addListener(
		listeners.onActivated = function(tab){
			checkIfWindowExists(tab.windowId, function(windowExists){
				if (windowExists == true) setBadgeStatusOnActiveWindow(tab);
			});
		}
	);
	chrome.tabs.onAttached.addListener(
		listeners.onAttached = function(tabId, newWindow){
			createTabsManifest(newWindow.newWindowId, function(){
				return true;
			});
		}
	);
	chrome.tabs.onDetached.addListener(
		listeners.onDetached = function(tabId, detachWindow){
			createTabsManifest(detachWindow.oldWindowId, function(){
				return true;
			});
		}
	);
	chrome.tabs.onRemoved.addListener(
		listeners.onRemoved = function(tabId, removedInfo){
			if(!removedInfo.isWindowClosing){
				createTabsManifest(removedInfo.windowId, function(){
					return true;
				});	
			}
		}
	);
	chrome.windows.onCreated.addListener(
		listeners.onWindowCreated = function(window){
			autoStartIfEnabled(window.id);
		}
	);
	return callback();
};
// **** Badge Status ****
// If the window has revolver tabs enabled, make sure the badge text reflects that.
function setBadgeStatusOnActiveWindow(tab){
	if (windowStatus[tab.windowId] === "on") badgeTabs("on", tab.windowId);
	else if (windowStatus[tab.windowId] === "pause") badgeTabs("pause", tab.windowId);
	else badgeTabs("", tab.windowId);
}
//Change the badge icon/background color.  
function badgeTabs(text, windowId) {
	if(text === "default") {
		chrome.browserAction.setBadgeText({text:"\u00D7"}); //Letter X
 		chrome.browserAction.setBadgeBackgroundColor({color:[255,0,0,100]}); //Red	
	} else {
		chrome.tabs.query({"windowId": windowId, "active": true}, function(tab){
			if(text === "on") {
				chrome.browserAction.setBadgeText({text:"\u2022", tabId: tab[0].id}); //Play button
		  		chrome.browserAction.setBadgeBackgroundColor({color:[0,255,0,100], tabId: tab[0].id}); //Green
			} else
			if (text === "pause"){
				chrome.browserAction.setBadgeText({text:"\u2022", tabId: tab[0].id}); //Play button
				chrome.browserAction.setBadgeBackgroundColor({color:[255,238,0,100], tabId: tab[0].id}); //Yellow
			} else {
				chrome.browserAction.setBadgeText({text:"\u00D7", tabId: tab[0].id}); //Letter X
		 		chrome.browserAction.setBadgeBackgroundColor({color:[255,0,0,100], tabId: tab[0].id}); //Red
			}
		});	
	}	
}		
// **** Timeouts ***
// Generate the timeout and assign it to moverTimeOut object.
function setMoverTimeout(timerWindowId, seconds){
	moverTimeOut[timerWindowId] = setTimeout(function(){
		removeTimeout(timerWindowId);
		moveTabIfIdle(timerWindowId, seconds);
	}, parseInt(seconds)*1000);
}
// Remove the timeout specified.
function removeTimeout(windowId){
	clearTimeout(moverTimeOut[windowId]);
	moverTimeOut[windowId] = "off";
}
// **** Helpers ****
// If a user closes a window, chrome activates each tab (presumably to close them).  This prevents errors when the onActivated listener 
// is fired on the tabs being activated to close them.
function checkIfWindowExists(windowId, callback){		
	chrome.windows.getAll(function(windows){		
		for(var i=0;i<windows.length;i++){		
			if(windows[i].id === windowId){		
				return callback(true);		
			}		
		}		
		return callback(false);		
	});		
}
// Checks if a string exists in an array.
function include(arr,url) {
    return (arr.indexOf(url) != -1);
}
// Returns all the tabs for the current window.
function getAllTabsInCurrentWindow(callback){
	chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, function(tabs){
		callback(tabs);
	});
}
// **** Settings ****
// Checks each tab object for settings, if they don't exist assign them to the object.
function assignBaseSettings(tabs, callback) {
	for(var i = 0;i<tabs.length;i++){
		tabs[i].reload = (tabs[i].reload || settings.reload);
		tabs[i].seconds = (tabs[i].seconds || settings.seconds);	
	};
	callback(tabs);
}
// If there are advanced settings for the URL, set them to the tab.
function assignAdvancedSettings(tabs, callback) {
	for(var y=0;y<tabs.length;y++){
		for(var i=0;i<advSettings.length;i++){
			if(advSettings[i].url == tabs[y].url) {
				tabs[y].reload = advSettings[i].reload;
				tabs[y].seconds = advSettings[i].seconds;
			}
		}	
	}
	callback(tabs);
}
// Get the settings for a tab.
function grabTabSettings(windowId, tab, callback) {
	for(var i=0; i<tabsManifest[windowId].length; i++){
		if(tabsManifest[windowId][i].url === tab.url){
			return callback(tabsManifest[windowId][i]);
		}
	}
}
// Check if the objects exist in local storage, create them if they don't, load them if they do.
function createBaseSettingsIfTheyDontExist(){
	if(!localStorage["revolverSettings"]){
		settings.seconds = 15;
		settings.reload = false;
		settings.inactive = false;
		settings.autoStart = false;
		settings.host = "http://localhost:5000"
		settings.username = ""
		settings.password = ""
		localStorage["revolverSettings"] = JSON.stringify(settings);
	} else {
		settings = JSON.parse(localStorage["revolverSettings"]);
	};
	if(localStorage["revolverAdvSettings"]){
		advSettings = JSON.parse(localStorage["revolverAdvSettings"]);
	}
	return true;
}
// If user has auto start enabled, well then, auto start.
function autoStartIfEnabled(windowId){
	if(settings.autostart) {
		createTabsManifest(windowId, function(){
			go(windowId);
		});
	}
}
// Go through each tab and assign settings to them.
function assignSettingsToTabs(tabs, callback){
	assignBaseSettings(tabs, function(){
		assignAdvancedSettings(tabs, function(){
			callback();
		});	
	});
}
// Create the tabs object with settings in tabsManifest object.
function createTabsManifest(windowId, callback){
	chrome.tabs.query({"windowId" : windowId}, function(tabs){
		assignSettingsToTabs(tabs, function(){
			tabsManifest[windowId] = tabs;
			callback();
		});
	});
}
//If a user changes settings this will update them on the fly.  Called from options_script.js
function updateSettings(callback){
	settings = JSON.parse(localStorage["revolverSettings"]);
	advSettings = JSON.parse(localStorage["revolverAdvSettings"]);	

	getAllTabsInCurrentWindow(function(tabs){
		assignBaseSettings(tabs, function(tabs){
			assignAdvancedSettings(tabs, function(tabs){
				var winId = (tabs.length>0)?tabs[0].windowId : chrome.windows.WINDOW_ID_CURRENT;
				createTabsManifest(winId, function(){
					if(typeof callback === 'function'){
						callback();
					}
					else{
						return true;
					}	
				});				
			});
		});
	});
}
//GETs all urls from the server
function getRotationUrls(callback){
	var xhr = new XMLHttpRequest();
	xhr.open("GET", settings.host + "/rotations", true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {	   
			if(xhr.status == 200) {
				// JSON.parse does not evaluate the attacker's scripts.
				var resp = JSON.parse(xhr.responseText);
				localStorage["revolverAdvSettings"] = JSON.stringify(resp);
				callback();
			}
			else {
				callback()
			}	    
		}
	}
	xhr.send();	
}
//PUTs entire url collection to the server
function addRotationUrls(urls, callback){
	settings = JSON.parse(localStorage["revolverSettings"]);
	var xhr = new XMLHttpRequest();
	xhr.open("PUT", settings.host + "/rotations", true);
	xhr.setRequestHeader("Content-type", "application/json");
	xhr.setRequestHeader("Authorization", "Basic " + btoa(settings.username + ":" + settings.password));	
	xhr.onreadystatechange = function() {
	  	if (xhr.readyState == 4) {
		  	if(xhr.status == 200) {	    	
		    	callback(true, "OPTIONS SAVED");
		    }
		    else if(xhr.status == 401){
		    	callback(false,"AUTHENTICATION FAILED, CHECK USERNAME AND PASSWORD")
		    }
		    else{
		    	callback(false, "AN ERROR OCCURRED, NOT SAVED!")
		    }    
	  	}
	}
	xhr.send(urls);
}

function synchroniseTabs(tabs, windowId, callback){	
	//remove tabs that are not in settings
	for(var i=0;i<tabs.length;i++){
		var orphan=true
		for(var x=0;x<advSettings.length;x++){
			if(advSettings[x].url == tabs[i].url){
				orphan=false;
			}
		}
		if(orphan && !isAChromeUrl(tabs[i].url)){
			chrome.tabs.remove(tabs[i].id)
		}
	}	

	//create tabs that should be open
	for(var i=0;i<advSettings.length;i++){
		var missing=true
		for(var x=0;x<tabs.length;x++){
			if(advSettings[i].url == tabs[x].url){
				missing=false;
			}
		}
		if(missing){
			chrome.tabs.create({ url: advSettings[i].url, windowId: windowId, active: false })
		}
	}
	callback();	
}

function isAChromeUrl(url){
	return (url.substring(0,19) == "chrome://extensions" || url.substring(0,16) == "chrome-extension");
}

function isARotationUrl(url){		
	for(var i=0;i<advSettings.length;i++){
		if(advSettings[i].url==url){
			return true;
		}
	}
	return false;
}