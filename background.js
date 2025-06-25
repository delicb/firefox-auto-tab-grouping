// Background script for Auto Tab Grouper

// Global state management
let groupDefinitions = new Map(); // groupId -> {name, color}
let patternRules = new Map(); // pattern -> {groupId, type} (type: 'simple' or 'regex')
let activeGroups = new Map(); // windowId -> Map(groupId -> tabGroupId)
let isEnabled = true;
let ignorePinnedTabs = true; // Default: don't group pinned tabs
let tabPlacement = 'last'; // Default: place new tabs at the end of the group ('first' or 'last')
let initialized = false;

// TOP-LEVEL EVENT LISTENERS (Required by Firefox)
// These must be registered synchronously at the top level

browser.tabs.onCreated.addListener((tab) => {
  if (!initialized) return;
  if (isEnabled) {
    console.log('Tab created:', tab.url, 'in window:', tab.windowId);
    handleTabChange(tab);
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!initialized) return;
  if (isEnabled && changeInfo.url) {
    console.log('Tab URL updated:', tab.url);
    handleTabChange(tab);
  }
});

browser.tabs.onActivated.addListener((activeInfo) => {
  if (!initialized) return;
  if (isEnabled) {
    browser.tabs.get(activeInfo.tabId).then(tab => {
      console.log('Tab activated:', tab.url);
      handleTabChange(tab);
    }).catch(error => {
      console.error('Error getting activated tab:', error);
    });
  }
});

browser.tabGroups.onRemoved.addListener((group) => {
  if (!initialized) return;
  console.log('Group removed:', group.id);
  
  // Remove group from tracking across all windows
  for (const [windowId, windowGroups] of activeGroups.entries()) {
    for (const [groupId, tabGroupId] of windowGroups.entries()) {
      if (tabGroupId === group.id) {
        windowGroups.delete(groupId);
        console.log(`Removed group from window ${windowId} tracking:`, groupId);
        
        // Clean up empty window entries
        if (windowGroups.size === 0) {
          activeGroups.delete(windowId);
        }
        return; // Found and removed, exit
      }
    }
  }
});

// Add window event listeners
browser.windows.onRemoved.addListener((windowId) => {
  if (!initialized) return;
  console.log('Window removed:', windowId);
  
  // Clean up tracking for this window
  activeGroups.delete(windowId);
  console.log('Cleaned up group tracking for window:', windowId);
});

browser.runtime.onStartup.addListener(() => {
  console.log('Runtime startup detected, reinitializing...');
  initializeExtension();
});

browser.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  initializeExtension();
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleMessage(message, sender, sendResponse);
});

// UTILITY FUNCTIONS

function getWindowGroups(windowId) {
  if (!activeGroups.has(windowId)) {
    activeGroups.set(windowId, new Map());
  }
  return activeGroups.get(windowId);
}

function debugLogActiveGroups() {
  console.log('=== Active Groups Debug ===');
  for (const [windowId, windowGroups] of activeGroups.entries()) {
    console.log(`Window ${windowId}:`);
    for (const [groupId, tabGroupId] of windowGroups.entries()) {
      const groupDef = groupDefinitions.get(groupId);
      console.log(`  - Group "${groupDef ? groupDef.name : 'Unknown'}" (${groupId}) -> TabGroup ${tabGroupId}`);
    }
  }
  console.log('=== End Debug ===');
}

function extractHostname(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, ''); // Remove www prefix
  } catch (e) {
    return null; // Invalid URL
  }
}

function extractUrlPattern(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, ''); // Remove www prefix
    const pathname = urlObj.pathname;
    
    // Return hostname + pathname, but remove trailing slash for consistency
    return hostname + (pathname === '/' ? '' : pathname.replace(/\/$/, ''));
  } catch (e) {
    return null; // Invalid URL
  }
}

function matchesPattern(url, pattern, patternType = 'simple') {
  if (!url) return false;
  console.log('Matching URL:', url, 'against pattern:', pattern, 'of type:', patternType);
  if (patternType === 'regex') {
    try {
      // Create regex from pattern string
      const regex = new RegExp(pattern, 'i'); // Case insensitive
      return regex.test(url);
    } catch (error) {
      console.warn('Invalid regex pattern:', pattern, error);
      return false;
    }
  }
  
  // Simple pattern matching (existing logic)
  const urlPattern = extractUrlPattern(url);
  if (!urlPattern) return false;
  
  // If pattern is just hostname (no slash), match hostname exactly
  if (!pattern.includes('/')) {
    const hostname = extractHostname(url);
    return hostname === pattern;
  }
  
  // If pattern includes path, check if URL pattern starts with the pattern
  return urlPattern.startsWith(pattern);
}

async function loadConfig() {
  try {
    const result = await browser.storage.local.get(['groupDefinitions', 'patternRules', 'isEnabled', 'ignorePinnedTabs', 'tabPlacement']);
    
    if (result.groupDefinitions) {
      groupDefinitions = new Map(Object.entries(result.groupDefinitions));
    }
    
    if (result.patternRules) {
      const rulesEntries = Object.entries(result.patternRules);
      patternRules = new Map();
      
      // Handle both old format (pattern -> groupId) and new format (pattern -> {groupId, type})
      for (const [pattern, value] of rulesEntries) {
        if (typeof value === 'string') {
          // Old format: pattern -> groupId
          patternRules.set(pattern, { groupId: value, type: 'simple' });
        } else if (value && typeof value === 'object') {
          // New format: pattern -> {groupId, type}
          patternRules.set(pattern, {
            groupId: value.groupId,
            type: value.type || 'simple'
          });
        }
      }
    }
    
    if (result.isEnabled !== undefined) {
      isEnabled = result.isEnabled;
    }
    
    if (result.ignorePinnedTabs !== undefined) {
      ignorePinnedTabs = result.ignorePinnedTabs;
    }
    
    if (result.tabPlacement !== undefined) {
      tabPlacement = result.tabPlacement;
    }
    
    console.log('Configuration loaded:', { 
      groupCount: groupDefinitions.size, 
      ruleCount: patternRules.size, 
      isEnabled,
      ignorePinnedTabs,
      tabPlacement
    });
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

async function saveConfig() {
  try {
    const groupDefinitionsObj = Object.fromEntries(groupDefinitions);
    const patternRulesObj = Object.fromEntries(patternRules);
    
    await browser.storage.local.set({
      groupDefinitions: groupDefinitionsObj,
      patternRules: patternRulesObj,
      isEnabled: isEnabled,
      ignorePinnedTabs: ignorePinnedTabs,
      tabPlacement: tabPlacement
    });
    console.log('Configuration saved');
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

async function scanExistingGroups() {
  try {
    console.log('Scanning for existing tab groups...');
    
    // Get all existing tab groups
    const existingGroups = await browser.tabGroups.query({});
    
    // Clear our current group tracking
    activeGroups.clear();
    
    // Group the tab groups by window
    const groupsByWindow = new Map();
    for (const group of existingGroups) {
      // Get tabs in this group to determine the window
      const groupTabs = await browser.tabs.query({ groupId: group.id });
      if (groupTabs.length > 0) {
        const windowId = groupTabs[0].windowId;
        if (!groupsByWindow.has(windowId)) {
          groupsByWindow.set(windowId, []);
        }
        groupsByWindow.get(windowId).push(group);
      }
    }
    
    // Check each existing group against our group definitions
    for (const [windowId, windowGroups] of groupsByWindow.entries()) {
      const windowGroupMap = getWindowGroups(windowId);
      
      for (const group of windowGroups) {
        // Look for a group definition that matches this group's title
        for (const [groupId, groupDef] of groupDefinitions.entries()) {
          if (groupDef.name === group.title) {
            // Found a matching group, track it for this window
            windowGroupMap.set(groupId, group.id);
            console.log(`Found existing group "${group.title}" (ID: ${group.id}) in window ${windowId} for groupId: ${groupId}`);
            
            // Optionally update the group's color to match our configuration
            try {
              await browser.tabGroups.update(group.id, {
                color: groupDef.color
              });
            } catch (error) {
              console.warn(`Could not update color for group "${group.title}":`, error);
            }
            
            break; // Found a match, move to next group
          }
        }
      }
    }
    
    let totalGroups = 0;
    for (const windowGroups of activeGroups.values()) {
      totalGroups += windowGroups.size;
    }
    console.log(`Tracking ${totalGroups} existing groups across ${activeGroups.size} windows`);
    debugLogActiveGroups();
  } catch (error) {
    console.error('Error scanning existing groups:', error);
  }
}

// CORE FUNCTIONALITY

async function handleTabChange(tab) {
  if (!tab.url || tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:')) {
    return;
  }

  // Skip pinned tabs if the option is enabled
  if (ignorePinnedTabs && tab.pinned) {
    console.log('Skipping pinned tab:', tab.url);
    return;
  }

  // Check if we have a pattern rule for this URL
  let matchingPattern = null;
  let groupId = null;
  
  // Check all patterns to find a match
  for (const [pattern, ruleData] of patternRules.entries()) {
    if (matchesPattern(tab.url, pattern, ruleData.type)) {
      matchingPattern = pattern;
      groupId = ruleData.groupId;
      break;
    }
  }
  
  if (!groupId) {
    // No pattern rule found - ungroup the tab if it's in a group
    if (tab.groupId !== -1) {
      try {
        await browser.tabs.ungroup([tab.id]);
      } catch (error) {
        console.error('Error ungrouping tab:', error);
      }
    }
    return;
  }

  // Get the group definition
  const groupDef = groupDefinitions.get(groupId);
  if (!groupDef) {
    console.warn(`No group definition found for groupId: ${groupId}`);
    return;
  }

  try {
    // Check if tab is already in the correct group
    if (tab.groupId !== -1) {
      const currentGroup = await browser.tabGroups.get(tab.groupId);
      if (currentGroup.title === groupDef.name) {
        return; // Already in correct group
      }
    }

    // Get window-specific groups
    const windowGroups = getWindowGroups(tab.windowId);
    
    // Find or create group for this definition in this specific window
    let targetTabGroupId = windowGroups.get(groupId);
    
    if (!targetTabGroupId) {
      // Check if a group with this name exists in this window but we're not tracking it
      try {
        const existingGroups = await browser.tabGroups.query({ windowId: tab.windowId });
        const matchingGroup = existingGroups.find(group => group.title === groupDef.name);
        
        if (matchingGroup) {
          // Found existing group in this window, start tracking it
          targetTabGroupId = matchingGroup.id;
          windowGroups.set(groupId, targetTabGroupId);
          console.log(`Found and started tracking existing group "${groupDef.name}" (ID: ${targetTabGroupId}) in window ${tab.windowId}`);
          
          // Update color to match our definition
          try {
            await browser.tabGroups.update(targetTabGroupId, {
              color: groupDef.color
            });
          } catch (error) {
            console.warn(`Could not update color for existing group "${groupDef.name}":`, error);
          }
        }
      } catch (error) {
        console.warn('Error checking for existing groups:', error);
      }
    }
    
    if (!targetTabGroupId) {
      // Create new group by grouping the tab with createProperties
      targetTabGroupId = await browser.tabs.group({
        tabIds: [tab.id],
        createProperties: {}
      });
      
      // Update the group with title and color
      await browser.tabGroups.update(targetTabGroupId, {
        title: groupDef.name,
        color: groupDef.color
      });
      
      windowGroups.set(groupId, targetTabGroupId);
      console.log(`Created new group "${groupDef.name}" (ID: ${targetTabGroupId}) in window ${tab.windowId} for pattern: ${matchingPattern}`);
      debugLogActiveGroups();
    } else {
      // Move tab to the existing group in the same window
      await browser.tabs.group({
        tabIds: [tab.id],
        groupId: targetTabGroupId
      });
      
      // Position the tab within the group based on tabPlacement setting
      await positionTabInGroup(tab.id, targetTabGroupId);
      
      console.log(`Moved tab to existing group "${groupDef.name}" in window ${tab.windowId} for pattern: ${matchingPattern}`);
    }

  } catch (error) {
    console.error('Error grouping tab:', error);
  }
}

async function positionTabInGroup(tabId, groupId) {
  try {
    if (tabPlacement === 'first') {
      // Get all tabs in the group
      const groupTabs = await browser.tabs.query({ groupId: groupId });
      
      if (groupTabs.length > 1) {
        // Find the current tab and the first tab in the group
        const currentTab = groupTabs.find(t => t.id === tabId);
        const firstTab = groupTabs.reduce((min, tab) => tab.index < min.index ? tab : min);
        
        if (currentTab && firstTab && currentTab.id !== firstTab.id) {
          // Move the tab to the position of the first tab
          await browser.tabs.move(tabId, { index: firstTab.index });
          console.log(`Moved tab ${tabId} to first position in group ${groupId}`);
        }
      }
    }
    // For 'last' placement, no action needed as tabs are added at the end by default
  } catch (error) {
    console.warn('Error positioning tab in group:', error);
  }
}

async function groupExistingTabs() {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      await handleTabChange(tab);
    }
  } catch (error) {
    console.error('Error grouping existing tabs:', error);
  }
}

async function toggleEnabled() {
  isEnabled = !isEnabled;
  await saveConfig();
  
  if (isEnabled) {
    await groupExistingTabs();
  }
  return isEnabled;
}

async function toggleIgnorePinnedTabs() {
  ignorePinnedTabs = !ignorePinnedTabs;
  await saveConfig();
  
  if (isEnabled) {
    await groupExistingTabs();
  }
  return ignorePinnedTabs;
}

async function setTabPlacement(placement) {
  if (placement !== 'first' && placement !== 'last') {
    throw new Error('Invalid tab placement. Must be "first" or "last"');
  }
  
  tabPlacement = placement;
  await saveConfig();
  return tabPlacement;
}

async function ungroupAllTabs() {
  try {
    const tabs = await browser.tabs.query({});
    const groupedTabs = tabs.filter(tab => tab.groupId !== -1);
    
    if (groupedTabs.length > 0) {
      await browser.tabs.ungroup(groupedTabs.map(tab => tab.id));
    }
    
    // Clear our group tracking for all windows
    activeGroups.clear();
  } catch (error) {
    console.error('Error ungrouping tabs:', error);
  }
}

// GROUP DEFINITION MANAGEMENT

async function addGroupDefinition(groupId, name, color) {
  groupDefinitions.set(groupId, { name, color });
  await saveConfig();
}

async function removeGroupDefinition(groupId) {
  // First remove any pattern rules that reference this group
  const rulesToRemove = [];
  for (const [pattern, ruleData] of patternRules.entries()) {
    if (ruleData.groupId === groupId) {
      rulesToRemove.push(pattern);
    }
  }
  
  for (const pattern of rulesToRemove) {
    patternRules.delete(pattern);
  }
  
  // Get the group name before removing it
  const groupDef = groupDefinitions.get(groupId);
  const groupName = groupDef ? groupDef.name : null;
  
  // Remove the group definition
  groupDefinitions.delete(groupId);
  
  // Remove from active groups across all windows
  for (const [windowId, windowGroups] of activeGroups.entries()) {
    windowGroups.delete(groupId);
    if (windowGroups.size === 0) {
      activeGroups.delete(windowId);
    }
  }
  
  await saveConfig();
  
  if (isEnabled && groupName) {
    // Ungroup tabs that were using this group
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.groupId !== -1) {
        try {
          const group = await browser.tabGroups.get(tab.groupId);
          if (group.title === groupName) {
            await browser.tabs.ungroup([tab.id]);
          }
        } catch (error) {
          // Group might have been deleted already
        }
      }
    }
  }
}

async function updateGroupDefinition(groupId, name, color) {
  const existing = groupDefinitions.get(groupId);
  if (!existing) {
    throw new Error('Group definition not found');
  }
  
  groupDefinitions.set(groupId, { name, color });
  await saveConfig();
  
  // Update any active browser tab groups across all windows
  for (const [windowId, windowGroups] of activeGroups.entries()) {
    const tabGroupId = windowGroups.get(groupId);
    if (tabGroupId) {
      try {
        await browser.tabGroups.update(tabGroupId, {
          title: name,
          color: color
        });
      } catch (error) {
        console.warn(`Could not update browser tab group in window ${windowId}:`, error);
      }
    }
  }
}

function getGroupDefinitions() {
  return Array.from(groupDefinitions.entries()).map(([groupId, def]) => ({
    groupId,
    name: def.name,
    color: def.color
  }));
}

// PATTERN RULE MANAGEMENT

async function addPatternRule(pattern, groupId, type = 'simple') {
  // Verify the group exists
  if (!groupDefinitions.has(groupId)) {
    throw new Error('Group definition not found');
  }
  
  // Validate regex pattern if type is regex
  if (type === 'regex') {
    try {
      new RegExp(pattern);
    } catch (error) {
      throw new Error('Invalid regex pattern: ' + error.message);
    }
  }
  
  patternRules.set(pattern, { groupId, type });
  await saveConfig();
  
  if (isEnabled) {
    await groupExistingTabs();
  }
}

async function removePatternRule(pattern) {
  const ruleData = patternRules.get(pattern);
  patternRules.delete(pattern);
  await saveConfig();
  
  if (isEnabled && ruleData) {
    // Ungroup tabs that no longer have a rule
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (matchesPattern(tab.url, pattern, ruleData.type) && tab.groupId !== -1) {
        await browser.tabs.ungroup([tab.id]);
      }
    }
  }
}

async function updatePatternRule(oldPattern, newPattern, groupId, type = 'simple') {
  // Verify the group exists
  if (!groupDefinitions.has(groupId)) {
    throw new Error('Group definition not found');
  }
  
  // Validate regex pattern if type is regex
  if (type === 'regex') {
    try {
      new RegExp(newPattern);
    } catch (error) {
      throw new Error('Invalid regex pattern: ' + error.message);
    }
  }
  
  // Remove old rule
  patternRules.delete(oldPattern);
  
  // Add new rule
  patternRules.set(newPattern, { groupId, type });
  
  await saveConfig();
  
  if (isEnabled) {
    // Ungroup tabs that matched the old pattern but don't match the new one
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (matchesPattern(tab.url, oldPattern) && !matchesPattern(tab.url, newPattern, type) && tab.groupId !== -1) {
        await browser.tabs.ungroup([tab.id]);
      }
    }
    
    // Regroup all tabs to apply new rules
    await groupExistingTabs();
  }
}

function getPatternRules() {
  return Array.from(patternRules.entries()).map(([pattern, ruleData]) => {
    const groupDef = groupDefinitions.get(ruleData.groupId);
    return {
      pattern,
      groupId: ruleData.groupId,
      type: ruleData.type || 'simple',
      groupName: groupDef ? groupDef.name : 'Unknown Group',
      groupColor: groupDef ? groupDef.color : 'grey'
    };
  });
}

// LEGACY COMPATIBILITY (for old UI)

async function addGroupConfig(pattern, groupName, color) {
  // Generate a unique group ID
  const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add group definition
  await addGroupDefinition(groupId, groupName, color);
  
  // Add pattern rule
  await addPatternRule(pattern, groupId);
}

async function removeGroupConfig(pattern) {
  await removePatternRule(pattern);
}

function getGroupConfigs() {
  return getPatternRules().map(rule => ({
    pattern: rule.pattern,
    groupName: rule.groupName,
    color: rule.groupColor
  }));
}



// INITIALIZATION

async function initializeExtension() {
  try {
    console.log('Initializing Auto Tab Grouper...');
    
    // Load saved configuration
    await loadConfig();
    
    // Scan for existing groups that match our configurations
    await scanExistingGroups();
    
    // Initial grouping of existing tabs
    await groupExistingTabs();
    
    // Mark as initialized
    initialized = true;
    
    console.log('Auto Tab Grouper initialized successfully');
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// MESSAGE HANDLING

function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'ping':
      // Simple ping to test if background script is responsive
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(),
        initialized: initialized
      });
      break;
      
    case 'toggle':
      toggleEnabled().then(enabled => {
        sendResponse({ enabled });
      }).catch(error => {
        console.error('Error toggling enabled state:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep message channel open for async response
      
    case 'toggleIgnorePinnedTabs':
      toggleIgnorePinnedTabs().then(ignorePinnedTabs => {
        sendResponse({ ignorePinnedTabs });
      }).catch(error => {
        console.error('Error toggling ignore pinned tabs:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep message channel open for async response

    case 'setTabPlacement':
      setTabPlacement(message.placement).then(tabPlacement => {
        sendResponse({ tabPlacement });
      }).catch(error => {
        console.error('Error setting tab placement:', error);
        sendResponse({ error: error.message });
      });
      return true; // Keep message channel open for async response
      
    case 'ungroup':
      ungroupAllTabs().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error ungrouping tabs:', error);
        sendResponse({ error: error.message });
      });
      return true;
      
    case 'regroup':
      groupExistingTabs().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error regrouping tabs:', error);
        sendResponse({ error: error.message });
      });
      return true;
      
    case 'getStatus':
      try {
        sendResponse({ 
          enabled: isEnabled,
          ignorePinnedTabs: ignorePinnedTabs,
          tabPlacement: tabPlacement,
          configs: getGroupConfigs(),
          groups: getGroupDefinitions(),
          rules: getPatternRules(),
          initialized: initialized
        });
      } catch (error) {
        console.error('Error getting status:', error);
        sendResponse({ error: error.message });
      }
      break;

    // Group definition management
    case 'addGroup':
      addGroupDefinition(
        message.groupId,
        message.name,
        message.color
      ).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error adding group:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'removeGroup':
      removeGroupDefinition(message.groupId).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error removing group:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'updateGroup':
      updateGroupDefinition(
        message.groupId,
        message.name,
        message.color
      ).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error updating group:', error);
        sendResponse({ error: error.message });
      });
      return true;

    // Pattern rule management  
    case 'addRule':
      addPatternRule(
        message.pattern,
        message.groupId,
        message.type || 'simple'
      ).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error adding rule:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'removeRule':
      removePatternRule(message.pattern).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error removing rule:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'updateRule':
      updatePatternRule(
        message.oldPattern,
        message.newPattern,
        message.groupId,
        message.type || 'simple'
      ).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error updating rule:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'addConfig':
      addGroupConfig(
        message.pattern, 
        message.groupName, 
        message.color
      ).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error adding config:', error);
        sendResponse({ error: error.message });
      });
      return true;

    case 'removeConfig':
      removeGroupConfig(message.pattern).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error removing config:', error);
        sendResponse({ error: error.message });
      });
      return true;

    default:
      console.warn('Unknown message action:', message.action);
      sendResponse({ error: 'Unknown action' });
      break;
  }
}

// START THE EXTENSION
initializeExtension();
