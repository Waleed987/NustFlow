// Get DOM elements
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDiv = document.getElementById('status');
const enableToggle = document.getElementById('enableToggle');
const toggleStatus = document.getElementById('toggleStatus');

// Load saved credentials and toggle state when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadCredentials();
    loadToggleState();
});

// Save credentials
saveBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showStatus('Please enter both username and password', 'error');
        return;
    }

    // Save to Chrome storage
    chrome.storage.local.set({
        nustCredentials: {
            username: username,
            password: password
        }
    }, () => {
        showStatus('✓ Credentials saved successfully!', 'success');
        // Mask password after saving
        setTimeout(() => {
            passwordInput.value = '••••••••';
        }, 500);
    });
});

// Clear credentials
clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear saved credentials?')) {
        chrome.storage.local.remove('nustCredentials', () => {
            usernameInput.value = '';
            passwordInput.value = '';
            showStatus('✓ Credentials cleared', 'info');
        });
    }
});

// Load credentials from storage
function loadCredentials() {
    chrome.storage.local.get('nustCredentials', (result) => {
        if (result.nustCredentials) {
            usernameInput.value = result.nustCredentials.username;
            // Show masked password to indicate it's saved
            passwordInput.value = '••••••••';
            passwordInput.placeholder = 'Password saved';
        }
    });
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} show`;

    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 3000);
}

// Clear password mask when user clicks to edit
passwordInput.addEventListener('focus', () => {
    if (passwordInput.value === '••••••••') {
        passwordInput.value = '';
        passwordInput.placeholder = 'Enter new password';
    }
});

// Toggle extension enabled/disabled
enableToggle.addEventListener('change', () => {
    const isEnabled = enableToggle.checked;

    chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
        updateToggleStatus(isEnabled);
        showStatus(
            isEnabled ? '✓ Extension enabled' : '✓ Extension disabled',
            'info'
        );
    });
});

// Load toggle state
function loadToggleState() {
    chrome.storage.local.get('extensionEnabled', (result) => {
        // Default to enabled if not set
        const isEnabled = result.extensionEnabled !== false;
        enableToggle.checked = isEnabled;
        updateToggleStatus(isEnabled);
    });
}

// Update toggle status text
function updateToggleStatus(isEnabled) {
    toggleStatus.textContent = isEnabled
        ? 'Auto-login is active'
        : 'Auto-login is disabled';
    toggleStatus.style.color = isEnabled ? '#27ae60' : '#e74c3c';
}
