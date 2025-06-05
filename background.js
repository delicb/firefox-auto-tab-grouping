// Background script for Auto Tab Grouper

// Global state management
let groupDefinitions = new Map(); // groupId -> {name, color}
let patternRules = new Map(); // pattern -> {groupId, type} (type: 'simple' or 'regex')
let activeGroups = new Map(); // groupId -> tabGroupId
let isEnabled = true;
let ignorePinnedTabs = true; // Default: don't group pinned tabs
let initialized = false;

// TOP-LEVEL EVENT LISTENERS (Required by Firefox)
// These must be registered synchronously at the top level

browser.tabs.onCreated.addListener((tab) => {
  if (!initialized) return;
  if (isEnabled) {
    console.log('Tab created:', tab.url);
    console.log("active groups:", activeGroups);
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
  for (const [groupId, tabGroupId] of activeGroups.entries()) {
    if (tabGroupId === group.id) {
      activeGroups.delete(groupId);
      console.log('Removed group from tracking:', groupId);
      break;
    }
  }
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
    const result = await browser.storage.local.get(['groupDefinitions', 'patternRules', 'isEnabled', 'ignorePinnedTabs']);
    
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
    
    console.log('Configuration loaded:', { 
      groupCount: groupDefinitions.size, 
      ruleCount: patternRules.size, 
      isEnabled,
      ignorePinnedTabs
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
      ignorePinnedTabs: ignorePinnedTabs
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
    
    // Check each existing group against our group definitions
    for (const group of existingGroups) {
      // Look for a group definition that matches this group's title
      for (const [groupId, groupDef] of groupDefinitions.entries()) {
        if (groupDef.name === group.title) {
          // Found a matching group, track it
          activeGroups.set(groupId, group.id);
          console.log(`Found existing group "${group.title}" (ID: ${group.id}) for groupId: ${groupId}`);
          
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
    
    console.log(`Tracking ${activeGroups.size} existing groups`);
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

    // Find or create group for this definition
    let targetTabGroupId = activeGroups.get(groupId);
    
    if (!targetTabGroupId) {
      // Check if a group with this name exists but we're not tracking it
      try {
        const existingGroups = await browser.tabGroups.query({});
        const matchingGroup = existingGroups.find(group => group.title === groupDef.name);
        
        if (matchingGroup) {
          // Found existing group, start tracking it
          targetTabGroupId = matchingGroup.id;
          activeGroups.set(groupId, targetTabGroupId);
          console.log(`Found and started tracking existing group "${groupDef.name}" (ID: ${targetTabGroupId})`);
          
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
      
      activeGroups.set(groupId, targetTabGroupId);
      console.log(`Created new group "${groupDef.name}" (ID: ${targetTabGroupId}) for pattern: ${matchingPattern}`);
    } else {
      // Move tab to the existing group
      await browser.tabs.group({
        tabIds: [tab.id],
        groupId: targetTabGroupId
      });
      console.log(`Moved tab to existing group "${groupDef.name}" for pattern: ${matchingPattern}`);
    }

  } catch (error) {
    console.error('Error grouping tab:', error);
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

async function ungroupAllTabs() {
  try {
    const tabs = await browser.tabs.query({});
    const groupedTabs = tabs.filter(tab => tab.groupId !== -1);
    
    if (groupedTabs.length > 0) {
      await browser.tabs.ungroup(groupedTabs.map(tab => tab.id));
    }
    
    // Clear our group tracking
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
  
  // Remove the group definition
  groupDefinitions.delete(groupId);
  
  // Remove from active groups if present
  activeGroups.delete(groupId);
  
  await saveConfig();
  
  if (isEnabled) {
    // Ungroup tabs that were using this group
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.groupId !== -1) {
        try {
          const group = await browser.tabGroups.get(tab.groupId);
          if (group.title === name) {
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
  
  // Update any active browser tab groups
  const tabGroupId = activeGroups.get(groupId);
  if (tabGroupId) {
    try {
      await browser.tabGroups.update(tabGroupId, {
        title: name,
        color: color
      });
    } catch (error) {
      console.warn('Could not update browser tab group:', error);
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
