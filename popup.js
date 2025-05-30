// Popup script for Auto Tab Grouper - New separated groups and rules model
document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');
  const regroupBtn = document.getElementById('regroupBtn');
  const ungroupBtn = document.getElementById('ungroupBtn');
  
  // Group management elements
  const groupNameInput = document.getElementById('groupName');
  const addGroupBtn = document.getElementById('addGroupBtn');
  const groupsList = document.getElementById('groupsList');
  
  // Rule management elements
  const patternInput = document.getElementById('pattern');
  const groupSelect = document.getElementById('groupSelect');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const rulesList = document.getElementById('rulesList');
  
  const colorOptions = document.querySelectorAll('.color-option');
  
  let selectedColor = 'green'; // default
  let currentGroups = [];
  let currentRules = [];

  // Notification system
  function showNotification(message, type = 'error', duration = 4000) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  // Confirmation modal system
  function showConfirmation(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'modal';
      
      const titleEl = document.createElement('h3');
      titleEl.textContent = title;
      
      const messageEl = document.createElement('p');
      messageEl.textContent = message;
      
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'modal-buttons';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-btn secondary';
      cancelBtn.textContent = 'Cancel';
      
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'modal-btn primary';
      confirmBtn.textContent = 'Remove';
      
      buttonsDiv.appendChild(cancelBtn);
      buttonsDiv.appendChild(confirmBtn);
      
      modal.appendChild(titleEl);
      modal.appendChild(messageEl);
      modal.appendChild(buttonsDiv);
      overlay.appendChild(modal);
      
      document.body.appendChild(overlay);
      
      const cleanup = () => {
        document.body.removeChild(overlay);
      };
      
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
    });
  }

  // Color selection logic
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedColor = option.dataset.color;
    });
  });

  // Add group
  addGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    
    if (!groupName) {
      showNotification('Please enter a group name', 'warning');
      return;
    }
    
    // Check for duplicate group names
    if (currentGroups.some(group => group.name === groupName)) {
      showNotification('A group with this name already exists', 'warning');
      return;
    }
    
    addGroupBtn.disabled = true;
    addGroupBtn.textContent = 'Adding...';
    
    try {
      // Generate unique group ID
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await sendMessage({
        action: 'addGroup',
        groupId: groupId,
        name: groupName,
        color: selectedColor
      });
      
      // Clear inputs
      groupNameInput.value = '';
      
      // Refresh the display
      await updateStatus();
      
      addGroupBtn.textContent = 'Added!';
      showNotification('Group added successfully', 'success', 2000);
      setTimeout(() => {
        addGroupBtn.textContent = 'Add Group';
        addGroupBtn.disabled = false;
      }, 1000);
      
    } catch (error) {
      console.error('Error adding group:', error);
      addGroupBtn.textContent = 'Error';
      showNotification('Failed to add group', 'error');
      setTimeout(() => {
        addGroupBtn.textContent = 'Add Group';
        addGroupBtn.disabled = false;
      }, 1000);
    }
  });

  // Add rule
  addRuleBtn.addEventListener('click', async () => {
    const pattern = patternInput.value.trim();
    const groupId = groupSelect.value;
    
    if (!pattern || !groupId) {
      showNotification('Please enter a URL pattern and select a group', 'warning');
      return;
    }
    
    // Validate pattern format
    if (!isValidPattern(pattern)) {
      showNotification('Please enter a valid URL pattern (e.g., example.com or example.com/path)', 'warning');
      return;
    }
    
    // Check for duplicate patterns
    if (currentRules.some(rule => rule.pattern === pattern)) {
      showNotification('A rule for this pattern already exists', 'warning');
      return;
    }
    
    addRuleBtn.disabled = true;
    addRuleBtn.textContent = 'Adding...';
    
    try {
      await sendMessage({
        action: 'addRule',
        pattern: pattern,
        groupId: groupId
      });
      
      // Clear inputs
      patternInput.value = '';
      groupSelect.value = '';
      
      // Refresh the display
      await updateStatus();
      
      addRuleBtn.textContent = 'Added!';
      showNotification('Rule added successfully', 'success', 2000);
      setTimeout(() => {
        addRuleBtn.textContent = 'Add Rule';
        addRuleBtn.disabled = false;
      }, 1000);
      
    } catch (error) {
      console.error('Error adding rule:', error);
      addRuleBtn.textContent = 'Error';
      showNotification('Failed to add rule', 'error');
      setTimeout(() => {
        addRuleBtn.textContent = 'Add Rule';
        addRuleBtn.disabled = false;
      }, 1000);
    }
  });

  // Get initial status
  await updateStatus();

  // Toggle functionality
  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    try {
      const response = await sendMessage({ action: 'toggle' });
      await updateStatus();
    } catch (error) {
      console.error('Error toggling:', error);
    }
    toggleBtn.disabled = false;
  });

  // Regroup all tabs
  regroupBtn.addEventListener('click', async () => {
    regroupBtn.disabled = true;
    regroupBtn.textContent = 'Regrouping...';
    
    try {
      await sendMessage({ action: 'regroup' });
      regroupBtn.textContent = 'Done!';
      setTimeout(() => {
        regroupBtn.textContent = 'Regroup All';
        regroupBtn.disabled = false;
      }, 1000);
    } catch (error) {
      console.error('Error regrouping:', error);
      regroupBtn.textContent = 'Error';
      setTimeout(() => {
        regroupBtn.textContent = 'Regroup All';
        regroupBtn.disabled = false;
      }, 1000);
    }
  });

  // Ungroup all tabs
  ungroupBtn.addEventListener('click', async () => {
    ungroupBtn.disabled = true;
    ungroupBtn.textContent = 'Ungrouping...';
    
    try {
      await sendMessage({ action: 'ungroup' });
      ungroupBtn.textContent = 'Done!';
      setTimeout(() => {
        ungroupBtn.textContent = 'Ungroup All';
        ungroupBtn.disabled = false;
      }, 1000);
    } catch (error) {
      console.error('Error ungrouping:', error);
      ungroupBtn.textContent = 'Error';
      setTimeout(() => {
        ungroupBtn.textContent = 'Ungroup All';
        ungroupBtn.disabled = false;
      }, 1000);
    }
  });

  async function updateStatus() {
    try {
      const response = await sendMessage({ action: 'getStatus' });
      const isEnabled = response.enabled;
      currentGroups = response.groups || [];
      currentRules = response.rules || [];
      
      statusIndicator.className = `status-indicator ${isEnabled ? 'enabled' : 'disabled'}`;
      statusText.textContent = isEnabled ? 'Auto-grouping enabled' : 'Auto-grouping disabled';
      toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
      
      updateGroupSelect();
      renderGroupsList();
      renderRulesList();
    } catch (error) {
      console.error('Error getting status:', error);
      statusText.textContent = 'Error';
    }
  }

  function updateGroupSelect() {
    // Clear existing options except the first one
    groupSelect.innerHTML = '<option value="">Select a group...</option>';
    
    // Add options for each group
    currentGroups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.groupId;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
    
    // Disable rule addition if no groups exist
    addRuleBtn.disabled = currentGroups.length === 0;
    if (currentGroups.length === 0) {
      addRuleBtn.textContent = 'Add Groups First';
    } else if (addRuleBtn.textContent === 'Add Groups First') {
      addRuleBtn.textContent = 'Add Rule';
    }
  }

  function renderGroupsList() {
    if (currentGroups.length === 0) {
      groupsList.innerHTML = '<div class="empty-state">No groups defined yet</div>';
      return;
    }
    
    groupsList.innerHTML = currentGroups.map(group => `
      <div class="config-item">
        <div class="config-info">
          <div class="config-pattern">${escapeHtml(group.name)}</div>
          <div class="config-group">
            <div class="config-color color-${group.color}"></div>
            ${escapeHtml(group.color)} color
          </div>
        </div>
        <button class="remove-btn" data-group-id="${escapeHtml(group.groupId)}">Remove</button>
      </div>
    `).join('');
    
    // Add event listeners for remove buttons
    groupsList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const groupId = e.target.dataset.groupId;
        const group = currentGroups.find(g => g.groupId === groupId);
        const groupName = group ? group.name : 'this group';
        
        // Check if any rules use this group
        const dependentRules = currentRules.filter(rule => rule.groupId === groupId);
        let confirmMessage = `Remove group "${groupName}"?`;
        if (dependentRules.length > 0) {
          confirmMessage += `\n\nThis will also remove ${dependentRules.length} pattern rule(s) that use this group.`;
        }
        
        const confirmed = await showConfirmation('Confirm Removal', confirmMessage);
        if (confirmed) {
          try {
            await sendMessage({
              action: 'removeGroup',
              groupId: groupId
            });
            await updateStatus();
            showNotification('Group removed successfully', 'success', 2000);
          } catch (error) {
            console.error('Error removing group:', error);
            showNotification('Failed to remove group', 'error');
          }
        }
      });
    });
  }

  function renderRulesList() {
    if (currentRules.length === 0) {
      rulesList.innerHTML = '<div class="empty-state">No rules defined yet</div>';
      return;
    }
    
    rulesList.innerHTML = currentRules.map(rule => `
      <div class="config-item">
        <div class="config-info">
          <div class="config-pattern">${escapeHtml(rule.pattern)}</div>
          <div class="config-group">
            <div class="config-color color-${rule.groupColor}"></div>
            ${escapeHtml(rule.groupName)}
          </div>
        </div>
        <button class="remove-btn" data-pattern="${escapeHtml(rule.pattern)}">Remove</button>
      </div>
    `).join('');
    
    // Add event listeners for remove buttons
    rulesList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const pattern = e.target.dataset.pattern;
        
        const confirmed = await showConfirmation('Confirm Removal', `Remove rule for pattern "${pattern}"?`);
        if (confirmed) {
          try {
            await sendMessage({
              action: 'removeRule',
              pattern: pattern
            });
            await updateStatus();
            showNotification('Rule removed successfully', 'success', 2000);
          } catch (error) {
            console.error('Error removing rule:', error);
            showNotification('Failed to remove rule', 'error');
          }
        }
      });
    });
  }

  function isValidPattern(pattern) {
    // Basic pattern validation - can be hostname or hostname/path
    // Allow letters, numbers, dots, hyphens, slashes, and underscores
    const patternRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9])?)*(\/[a-zA-Z0-9\-_\/]*)?$/;
    
    // Check basic format
    if (!patternRegex.test(pattern) || pattern.length > 253) {
      return false;
    }
    
    // Extract hostname part (before first slash if any)
    const hostnamePart = pattern.split('/')[0];
    
    // Validate hostname part more strictly
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return hostnameRegex.test(hostnamePart);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      browser.runtime.sendMessage(message, (response) => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
});
