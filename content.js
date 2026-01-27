// NUST Auto-Login Content Script - Optimized Version
// This script runs on lms.nust.edu.pk/portal/* pages

console.log('NUST Auto-Login: Content script loaded');

// Run immediately when script loads
initAutoLogin();

// Also run on DOMContentLoaded as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoLogin);
}

function initAutoLogin() {
    console.log('NUST Auto-Login: Initializing auto-login');

    // Try to find elements with retry logic
    findElementsWithRetry(0);
}

function findElementsWithRetry(attempt) {
    if (attempt > 5) {
        console.log('NUST Auto-Login: Max retry attempts reached');
        return;
    }

    const usernameField = findUsernameField();
    const passwordField = findPasswordField();
    const loginButton = findLoginButton();

    console.log(`NUST Auto-Login: Attempt ${attempt + 1} - Found:`, {
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
    chrome.storage.local.get(['nustCredentials', 'extensionEnabled'], (result) => {
        // Check if extension is enabled (default to true if not set)
        const isEnabled = result.extensionEnabled !== false;

        if (!isEnabled) {
            console.log('NUST Auto-Login: Extension is disabled, skipping auto-login');
            return;
        }

        if (result.nustCredentials) {
            const { username, password } = result.nustCredentials;
            console.log('NUST Auto-Login: Credentials found in storage');

            // Check if fields are empty (not already filled)
            if (!usernameField.value && !passwordField.value) {
                console.log('NUST Auto-Login: Filling credentials');

                // Fill both fields immediately
                fillField(usernameField, username);
                fillField(passwordField, password);

                console.log('NUST Auto-Login: Credentials filled');

                // Click login button with minimal delay
                if (loginButton) {
                    setTimeout(() => {
                        console.log('NUST Auto-Login: Clicking login button');
                        loginButton.click();
                    }, 200); // Reduced from 800ms to 200ms
                } else {
                    console.log('NUST Auto-Login: Login button not found, credentials filled only');
                }
            } else {
                console.log('NUST Auto-Login: Fields already filled, skipping');
            }
        } else {
            console.log('NUST Auto-Login: No credentials saved');
        }
    });
}

function fillField(field, value) {
    // Focus the field
    field.focus();

    // Set value using native setter
    setNativeValue(field, value);

    // Trigger all necessary events at once
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));
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
                console.log('NUST Auto-Login: Found element with selector:', selector);
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
