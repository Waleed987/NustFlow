// Get DOM elements
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDiv = document.getElementById('status');
const enableToggle = document.getElementById('enableToggle');
const toggleStatus = document.getElementById('toggleStatus');
const qalamSameToggle = document.getElementById('qalamSameToggle');
const qalamFields = document.getElementById('qalamFields');
const qalamUsernameInput = document.getElementById('qalamUsername');
const qalamPasswordInput = document.getElementById('qalamPassword');

// Load saved credentials and toggle state when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadCredentials();
    loadToggleState();
    loadQalamToggleState();
});

// Save credentials
saveBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showStatus('Please enter both username and password', 'error');
        return;
    }

    const useSameForQalam = qalamSameToggle.checked;
    let qalamUsername = username;
    let qalamPassword = password;

    if (!useSameForQalam) {
        qalamUsername = qalamUsernameInput.value.trim();
        qalamPassword = qalamPasswordInput.value.trim();

        if (!qalamUsername || !qalamPassword) {
            showStatus('Please enter Qalam credentials or toggle "Same as LMS"', 'error');
            return;
        }
    }

    try {
        // Encrypt passwords
        const encryptedLmsPassword = await encryption.encrypt(password);
        const encryptedQalamPassword = await encryption.encrypt(qalamPassword);

        // Save to Chrome storage
        chrome.storage.local.set({
            nustCredentials: {
                username: username,
                password: encryptedLmsPassword
            },
            qalamCredentials: {
                username: qalamUsername,
                password: encryptedQalamPassword
            },
            qalamUseSame: useSameForQalam
        }, () => {
            showStatus('✓ Credentials saved securely!', 'success');
            // Mask passwords after saving
            setTimeout(() => {
                passwordInput.value = '••••••••';
                if (!useSameForQalam) {
                    qalamPasswordInput.value = '••••••••';
                }
            }, 500);
        });
    } catch (error) {
        console.error('Encryption error:', error);
        showStatus('Error saving credentials', 'error');
    }
});

// Clear credentials
clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear saved credentials?')) {
        chrome.storage.local.remove(['nustCredentials', 'qalamCredentials', 'qalamUseSame'], () => {
            usernameInput.value = '';
            passwordInput.value = '';
            qalamUsernameInput.value = '';
            qalamPasswordInput.value = '';
            qalamSameToggle.checked = true;
            qalamFields.classList.add('hidden');
            showStatus('✓ Credentials cleared', 'info');
        });
    }
});

// Load credentials from storage
function loadCredentials() {
    chrome.storage.local.get(['nustCredentials', 'qalamCredentials'], (result) => {
        if (result.nustCredentials) {
            usernameInput.value = result.nustCredentials.username;
            passwordInput.value = '••••••••';
            passwordInput.placeholder = 'Password saved';
        }

        if (result.qalamCredentials) {
            qalamUsernameInput.value = result.qalamCredentials.username;
            qalamPasswordInput.value = '••••••••';
            qalamPasswordInput.placeholder = 'Password saved';
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

qalamPasswordInput.addEventListener('focus', () => {
    if (qalamPasswordInput.value === '••••••••') {
        qalamPasswordInput.value = '';
        qalamPasswordInput.placeholder = 'Enter new password';
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

// Toggle Qalam same/different credentials
qalamSameToggle.addEventListener('change', () => {
    const useSame = qalamSameToggle.checked;

    if (useSame) {
        qalamFields.classList.add('hidden');
    } else {
        qalamFields.classList.remove('hidden');
    }

    chrome.storage.local.set({ qalamUseSame: useSame });
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

// Load Qalam toggle state
function loadQalamToggleState() {
    chrome.storage.local.get('qalamUseSame', (result) => {
        // Default to same credentials if not set
        const useSame = result.qalamUseSame !== false;
        qalamSameToggle.checked = useSame;

        if (useSame) {
            qalamFields.classList.add('hidden');
        } else {
            qalamFields.classList.remove('hidden');
        }
    });
}

// Update toggle status text
function updateToggleStatus(isEnabled) {
    toggleStatus.textContent = isEnabled
        ? 'Auto-login is active'
        : 'Auto-login is disabled';
    toggleStatus.style.color = isEnabled ? '#27ae60' : '#e74c3c';
}

// CGPA Privacy Toggle
const showCgpaToggle = document.getElementById('showCgpaToggle');

if (showCgpaToggle) {
    showCgpaToggle.addEventListener('change', () => {
        const showCgpa = showCgpaToggle.checked;

        chrome.storage.local.set({ showCgpa: showCgpa }, () => {
            showStatus(
                showCgpa ? '✓ CGPA will be visible' : '✓ CGPA will be hidden',
                'info'
            );
        });
    });

    // Load CGPA toggle state on startup
    chrome.storage.local.get('showCgpa', (result) => {
        // Default to showing CGPA if not set
        const showCgpa = result.showCgpa !== false;
        showCgpaToggle.checked = showCgpa;
    });
}
