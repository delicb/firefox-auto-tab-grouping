// Popup script for Auto Tab Grouper - New separated groups and rules model
document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');
  const regroupBtn = document.getElementById('regroupBtn');
  const ungroupBtn = document.getElementById('ungroupBtn');
  
  // Pinned tabs toggle elements
  const pinnedTabsIndicator = document.getElementById('pinnedTabsIndicator');
  const pinnedTabsText = document.getElementById('pinnedTabsText');
  const pinnedTabsToggleBtn = document.getElementById('pinnedTabsToggleBtn');
  
  // Group management elements
  const groupNameInput = document.getElementById('groupName');
  const addGroupBtn = document.getElementById('addGroupBtn');
  const groupsList = document.getElementById('groupsList');
  
  // Rule management elements
  const patternTypeSelect = document.getElementById('patternType');
  const patternInput = document.getElementById('pattern');
  const patternLabel = document.getElementById('patternLabel');
  const patternHelp = document.getElementById('patternHelp');
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

  // Pattern type change handler
  patternTypeSelect.addEventListener('change', () => {
    const isRegex = patternTypeSelect.value === 'regex';
    const addConfigDiv = patternTypeSelect.closest('.add-config');
    
    if (isRegex) {
      addConfigDiv.classList.add('pattern-type-regex');
      patternLabel.textContent = 'Regular Expression Pattern:';
      patternInput.placeholder = '.*\\.github\\.com.*|.*stackoverflow.*';
      patternHelp.textContent = 'Use regex patterns for advanced matching. Examples: ".*\\.github\\.com.*", "https://.*\\.reddit\\.com/r/.*"';
    } else {
      addConfigDiv.classList.remove('pattern-type-regex');
      patternLabel.textContent = 'URL Pattern (e.g., github.com or github.com/organization):';
      patternInput.placeholder = 'example.com or example.com/path';
      patternHelp.textContent = 'Simple patterns match domains and paths. Examples: "github.com", "github.com/microsoft"';
    }
  });

  // Add rule
  addRuleBtn.addEventListener('click', async () => {
    const pattern = patternInput.value.trim();
    const groupId = groupSelect.value;
    const patternType = patternTypeSelect.value;
    
    if (!pattern || !groupId) {
      showNotification('Please enter a URL pattern and select a group', 'warning');
      return;
    }
    
    // Validate pattern format
    if (!isValidPattern(pattern, patternType)) {
      if (patternType === 'regex') {
        showNotification('Please enter a valid regular expression', 'warning');
      } else {
        showNotification('Please enter a valid URL pattern (e.g., example.com or example.com/path)', 'warning');
      }
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
        groupId: groupId,
        type: patternType
      });
      
      // Clear inputs
      patternInput.value = '';
      groupSelect.value = '';
      patternTypeSelect.value = 'simple';
      // Trigger the change event to update UI
      patternTypeSelect.dispatchEvent(new Event('change'));
      
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

  // Pinned tabs toggle functionality
  pinnedTabsToggleBtn.addEventListener('click', async () => {
    pinnedTabsToggleBtn.disabled = true;
    try {
      const response = await sendMessage({ action: 'toggleIgnorePinnedTabs' });
      await updateStatus();
      showNotification(
        response.ignorePinnedTabs ? 'Now ignoring pinned tabs' : 'Now grouping pinned tabs',
        'success'
      );
    } catch (error) {
      console.error('Error toggling pinned tabs setting:', error);
      showNotification('Failed to update pinned tabs setting', 'error');
    }
    pinnedTabsToggleBtn.disabled = false;
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
      const ignorePinnedTabs = response.ignorePinnedTabs;
      currentGroups = response.groups || [];
      currentRules = response.rules || [];
      
      statusIndicator.className = `status-indicator ${isEnabled ? 'enabled' : 'disabled'}`;
      statusText.textContent = isEnabled ? 'Auto-grouping enabled' : 'Auto-grouping disabled';
      toggleBtn.textContent = isEnabled ? 'Disable' : 'Enable';
      
      // Update pinned tabs status
      pinnedTabsIndicator.className = `status-indicator ${ignorePinnedTabs ? 'enabled' : 'disabled'}`;
      pinnedTabsText.textContent = ignorePinnedTabs ? 'Ignoring pinned tabs' : 'Grouping pinned tabs';
      pinnedTabsToggleBtn.textContent = ignorePinnedTabs ? 'Include Pinned' : 'Ignore Pinned';
      
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
      <div class="config-item" data-group-id="${escapeHtml(group.groupId)}">
        <div class="config-info">
          <div class="config-pattern">${escapeHtml(group.name)}</div>
          <div class="config-group">
            <div class="config-color color-${group.color}"></div>
            ${escapeHtml(group.color)} color
          </div>
        </div>
        <div class="item-actions">
          <button class="edit-btn" data-group-id="${escapeHtml(group.groupId)}">Edit</button>
          <button class="remove-btn" data-group-id="${escapeHtml(group.groupId)}">Remove</button>
        </div>
      </div>
    `).join('');
    
    // Add event listeners for edit buttons
    groupsList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupId = e.target.dataset.groupId;
        showGroupEditForm(groupId);
      });
    });
    
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
      <div class="config-item" data-pattern="${escapeHtml(rule.pattern)}">
        <div class="config-info">
          <div class="config-pattern">
            ${escapeHtml(rule.pattern)}
            ${rule.type === 'regex' ? '<span class="pattern-type-indicator regex">REGEX</span>' : '<span class="pattern-type-indicator">SIMPLE</span>'}
          </div>
          <div class="config-group">
            <div class="config-color color-${rule.groupColor}"></div>
            ${escapeHtml(rule.groupName)}
          </div>
        </div>
        <div class="item-actions">
          <button class="edit-btn" data-pattern="${escapeHtml(rule.pattern)}">Edit</button>
          <button class="remove-btn" data-pattern="${escapeHtml(rule.pattern)}">Remove</button>
        </div>
      </div>
    `).join('');
    
    // Add event listeners for edit buttons
    rulesList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pattern = e.target.dataset.pattern;
        showRuleEditForm(pattern);
      });
    });
    
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

  function showGroupEditForm(groupId) {
    const group = currentGroups.find(g => g.groupId === groupId);
    if (!group) return;
    
    const groupItem = groupsList.querySelector(`[data-group-id="${groupId}"]`);
    if (!groupItem) return;
    
    // Hide existing edit forms
    hideAllEditForms();
    
    // Create edit form
    const editForm = document.createElement('div');
    editForm.className = 'edit-form';
    editForm.innerHTML = `
      <div class="form-row">
        <input type="text" class="edit-group-name" value="${escapeHtml(group.name)}" placeholder="Group name">
      </div>
      <div class="form-row">
        <div class="color-select-mini">
          ${['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'].map(color => `
            <div class="color-option-mini color-${color} ${group.color === color ? 'selected' : ''}" data-color="${color}"></div>
          `).join('')}
        </div>
      </div>
      <div class="edit-form-actions">
        <button class="cancel-btn">Cancel</button>
        <button class="save-btn">Save</button>
      </div>
    `;
    
    groupItem.appendChild(editForm);
    
    // Color selection logic for edit form
    let editSelectedColor = group.color;
    const colorOptions = editForm.querySelectorAll('.color-option-mini');
    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        editSelectedColor = option.dataset.color;
      });
    });
    
    // Cancel button
    editForm.querySelector('.cancel-btn').addEventListener('click', () => {
      hideAllEditForms();
    });
    
    // Save button
    editForm.querySelector('.save-btn').addEventListener('click', async () => {
      const nameInput = editForm.querySelector('.edit-group-name');
      const newName = nameInput.value.trim();
      
      if (!newName) {
        showNotification('Please enter a group name', 'warning');
        return;
      }
      
      // Check for duplicate group names (excluding current group)
      if (currentGroups.some(g => g.name === newName && g.groupId !== groupId)) {
        showNotification('A group with this name already exists', 'warning');
        return;
      }
      
      const saveBtn = editForm.querySelector('.save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
        await sendMessage({
          action: 'updateGroup',
          groupId: groupId,
          name: newName,
          color: editSelectedColor
        });
        
        hideAllEditForms();
        await updateStatus();
        showNotification('Group updated successfully', 'success', 2000);
      } catch (error) {
        console.error('Error updating group:', error);
        showNotification('Failed to update group', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
    
    // Focus on name input
    editForm.querySelector('.edit-group-name').focus();
  }

  function showRuleEditForm(pattern) {
    const rule = currentRules.find(r => r.pattern === pattern);
    if (!rule) return;
    
    const ruleItem = rulesList.querySelector(`[data-pattern="${pattern}"]`);
    if (!ruleItem) return;
    
    // Hide existing edit forms
    hideAllEditForms();
    
    // Create edit form
    const editForm = document.createElement('div');
    editForm.className = 'edit-form';
    editForm.innerHTML = `
      <div class="form-row">
        <select class="edit-pattern-type">
          <option value="simple" ${rule.type === 'simple' ? 'selected' : ''}>Simple</option>
          <option value="regex" ${rule.type === 'regex' ? 'selected' : ''}>Regex</option>
        </select>
        <input type="text" class="edit-pattern" value="${escapeHtml(rule.pattern)}" placeholder="Pattern">
      </div>
      <div class="form-row">
        <select class="edit-group-select">
          ${currentGroups.map(group => `
            <option value="${escapeHtml(group.groupId)}" ${group.groupId === rule.groupId ? 'selected' : ''}>
              ${escapeHtml(group.name)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="edit-form-actions">
        <button class="cancel-btn">Cancel</button>
        <button class="save-btn">Save</button>
      </div>
    `;
    
    ruleItem.appendChild(editForm);
    
    // Pattern type change handler
    const patternTypeSelect = editForm.querySelector('.edit-pattern-type');
    const patternInput = editForm.querySelector('.edit-pattern');
    
    const updatePatternPlaceholder = () => {
      if (patternTypeSelect.value === 'regex') {
        patternInput.placeholder = '.*\\.github\\.com.*|.*stackoverflow.*';
      } else {
        patternInput.placeholder = 'example.com or example.com/path';
      }
    };
    
    patternTypeSelect.addEventListener('change', updatePatternPlaceholder);
    updatePatternPlaceholder();
    
    // Cancel button
    editForm.querySelector('.cancel-btn').addEventListener('click', () => {
      hideAllEditForms();
    });
    
    // Save button
    editForm.querySelector('.save-btn').addEventListener('click', async () => {
      const newPattern = patternInput.value.trim();
      const newType = patternTypeSelect.value;
      const newGroupId = editForm.querySelector('.edit-group-select').value;
      
      if (!newPattern || !newGroupId) {
        showNotification('Please enter a pattern and select a group', 'warning');
        return;
      }
      
      // Validate pattern format
      if (!isValidPattern(newPattern, newType)) {
        if (newType === 'regex') {
          showNotification('Please enter a valid regular expression', 'warning');
        } else {
          showNotification('Please enter a valid URL pattern', 'warning');
        }
        return;
      }
      
      // Check for duplicate patterns (excluding current rule)
      if (currentRules.some(r => r.pattern === newPattern && r.pattern !== pattern)) {
        showNotification('A rule for this pattern already exists', 'warning');
        return;
      }
      
      const saveBtn = editForm.querySelector('.save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
        await sendMessage({
          action: 'updateRule',
          oldPattern: pattern,
          newPattern: newPattern,
          groupId: newGroupId,
          type: newType
        });
        
        hideAllEditForms();
        await updateStatus();
        showNotification('Rule updated successfully', 'success', 2000);
      } catch (error) {
        console.error('Error updating rule:', error);
        showNotification('Failed to update rule', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
    
    // Focus on pattern input
    patternInput.focus();
  }

  function hideAllEditForms() {
    document.querySelectorAll('.edit-form').forEach(form => {
      form.remove();
    });
  }

  function isValidPattern(pattern, type = 'simple') {
    if (type === 'regex') {
      // Validate regex pattern
      try {
        new RegExp(pattern);
        return pattern.length > 0 && pattern.length <= 1000; // Reasonable length limit
      } catch (error) {
        return false;
      }
    }
    
    // Simple pattern validation - can be hostname or hostname/path
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
