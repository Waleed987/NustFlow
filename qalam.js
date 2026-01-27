// NUST Qalam Auto-Login Content Script
// This script runs on qalam.nust.edu.pk/web/login

console.log('NUST Qalam Auto-Login: Content script loaded');

// Run immediately when script loads
initQalamAutoLogin();

// Also run on DOMContentLoaded as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQalamAutoLogin);
}

function initQalamAutoLogin() {
    console.log('NUST Qalam Auto-Login: Initializing auto-login');

    // Check login attempt count
    const attemptKey = 'qalam_login_attempts';
    const attempts = parseInt(sessionStorage.getItem(attemptKey) || '0');

    if (attempts >= 2) {
        console.log('NUST Qalam Auto-Login: Max login attempts reached (2), stopping auto-login');
        return;
    }

    // Increment attempt counter
    sessionStorage.setItem(attemptKey, (attempts + 1).toString());

    // Try to find elements with retry logic
    findElementsWithRetry(0);
}

function findElementsWithRetry(attempt) {
    if (attempt > 3) {
        console.log('NUST Qalam Auto-Login: Max retry attempts reached');
        return;
    }

    const usernameField = findUsernameField();
    const passwordField = findPasswordField();
    const loginButton = findLoginButton();

    console.log(`NUST Qalam Auto-Login: Attempt ${attempt + 1} - Found:`, {
        username: !!usernameField,
        password: !!passwordField,
        button: !!loginButton
    });

    if (usernameField && passwordField) {
        fillAndSubmit(usernameField, passwordField, loginButton);
    } else {
        // Retry after a short delay
        setTimeout(() => findElementsWithRetry(attempt + 1), 200);
    }
}

function fillAndSubmit(usernameField, passwordField, loginButton) {
    // Get credentials and enabled state from storage
    chrome.storage.local.get(['qalamCredentials', 'extensionEnabled'], async (result) => {
        // Check if extension is enabled (default to true if not set)
        const isEnabled = result.extensionEnabled !== false;

        if (!isEnabled) {
            console.log('NUST Qalam Auto-Login: Extension is disabled, skipping auto-login');
            return;
        }

        if (result.qalamCredentials) {
            const { username, password: encryptedPassword } = result.qalamCredentials;
            console.log('NUST Qalam Auto-Login: Credentials found in storage');

            // Decrypt password
            const password = await decryptPassword(encryptedPassword);

            if (!password) {
                console.log('NUST Qalam Auto-Login: Failed to decrypt password');
                return;
            }

            // Check if fields are empty (not already filled)
            if (!usernameField.value && !passwordField.value) {
                console.log('NUST Qalam Auto-Login: Filling credentials');

                // Fill both fields immediately
                fillField(usernameField, username);
                fillField(passwordField, password);

                console.log('NUST Qalam Auto-Login: Credentials filled');

                // Click login button with delay for validation
                if (loginButton) {
                    setTimeout(() => {
                        console.log('NUST Qalam Auto-Login: Clicking login button');
                        loginButton.click();
                    }, 500);
                } else {
                    console.log('NUST Qalam Auto-Login: Login button not found, credentials filled only');
                }
            } else {
                console.log('NUST Qalam Auto-Login: Fields already filled, skipping');
            }
        } else {
            console.log('NUST Qalam Auto-Login: No credentials saved');
        }
    });
}

function fillField(field, value) {
    // Focus the field
    field.focus();

    // Set value using native setter
    setNativeValue(field, value);

    // Trigger comprehensive events for form validation
    const events = [
        new Event('input', { bubbles: true, cancelable: true }),
        new Event('change', { bubbles: true, cancelable: true }),
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true }),
        new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
        new Event('blur', { bubbles: true, cancelable: true }),
        new FocusEvent('focusout', { bubbles: true, cancelable: true })
    ];

    events.forEach(event => field.dispatchEvent(event));
}

// Helper function to find username field
function findUsernameField() {
    const selectors = [
        'input[placeholder="Username"]',
        'input[type="text"]:not([type="hidden"])',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[autocomplete="username"]'
    ];

    return findFirstVisible(selectors);
}

// Helper function to find password field
function findPasswordField() {
    const selectors = [
        'input[placeholder="Password"]',
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[id*="pass" i]',
        'input[autocomplete="current-password"]'
    ];

    return findFirstVisible(selectors);
}

// Helper function to find the login button
function findLoginButton() {
    const selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button.btn-primary',
        'button.btn',
        'a.btn'
    ];

    let button = findFirstVisible(selectors);

    if (!button) {
        // Fallback: find any button with "log" in its text
        const buttons = document.querySelectorAll('button, input[type="submit"], a.btn');
        for (const btn of buttons) {
            const text = btn.textContent || btn.value || '';
            if (text.toLowerCase().includes('log') && isVisible(btn)) {
                button = btn;
                break;
            }
        }
    }

    return button;
}

// Find first visible element from selectors
function findFirstVisible(selectors) {
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && isVisible(element)) {
                console.log('NUST Qalam Auto-Login: Found element with selector:', selector);
                return element;
            }
        } catch (e) {
            // Invalid selector, skip
            continue;
        }
    }
    return null;
}

// Set value using native setter (works better with React/Angular forms)
function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set ||
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;

    if (valueSetter) {
        valueSetter.call(element, value);
    } else {
        element.value = value;
    }
}

// Check if element is visible
function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
}

// Decrypt password using Web Crypto API
async function decryptPassword(encryptedPassword) {
    if (!encryptedPassword) return null;

    try {
        // Get encryption key
        const result = await chrome.storage.local.get('_encryptionKey');
        if (!result._encryptionKey) return encryptedPassword; // Fallback for unencrypted

        const key = await crypto.subtle.importKey(
            'jwk',
            result._encryptionKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['decrypt']
        );

        // Convert from base64
        const combined = Uint8Array.from(atob(encryptedPassword), c => c.charCodeAt(0));

        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);

        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedData
        );

        return new TextDecoder().decode(decryptedData);
    } catch (error) {
        console.error('Decryption failed:', error);
        return encryptedPassword; // Fallback to original if decryption fails
    }
}
