// NUST Auto-Login Content Script - Optimized Version
// This script runs on the current LMS homepage and the archive LMS portal.

console.log('NUST Auto-Login: Content script loaded');

let loginModalRequested = false;
const statusElementId = 'nust-auto-login-status';

function showLoginStatus(message, type = 'error') {
    let status = document.getElementById(statusElementId);
    if (!status) {
        status = document.createElement('div');
        status.id = statusElementId;
        status.setAttribute('role', 'status');
        status.style.cssText = [
            'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
            'max-width:360px', 'padding:12px 16px', 'border-radius:6px',
            'font:14px/1.4 Arial,sans-serif', 'box-shadow:0 2px 10px rgba(0,0,0,.25)'
        ].join(';');
        document.documentElement.appendChild(status);
    }

    status.textContent = `NustFlow: ${message}`;
    status.style.background = type === 'info' ? '#e8f1ff' : '#ffe8e8';
    status.style.color = type === 'info' ? '#174a8b' : '#8a1c1c';
    status.style.border = `1px solid ${type === 'info' ? '#8bb5f0' : '#e09a9a'}`;
    clearTimeout(status._hideTimer);
    status._hideTimer = setTimeout(() => status.remove(), 7000);
}

function reportLoginError(message, error) {
    console.error(`NUST Auto-Login: ${message}`, error || '');
    showLoginStatus(message);
}

// Run immediately when script loads
initAutoLogin();

// Also run on DOMContentLoaded as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoLogin);
}

function initAutoLogin() {
    console.log('NUST Auto-Login: Initializing auto-login');

    // Check login attempt count
    const attemptKey = 'lms_login_attempts';
    const lastUrlKey = 'lms_last_url';
    const timestampKey = 'lms_last_attempt_time';
    const currentUrl = window.location.href;
    const lastUrl = sessionStorage.getItem(lastUrlKey);
    const lastAttemptTime = parseInt(sessionStorage.getItem(timestampKey) || '0');
    const currentTime = Date.now();

    // Reset counter if more than 5 minutes have passed since last attempt
    // This handles session expiry scenarios
    if (lastAttemptTime && (currentTime - lastAttemptTime) > 5 * 60 * 1000) {
        console.log('NUST Auto-Login: More than 5 minutes since last attempt, resetting counter');
        sessionStorage.setItem(attemptKey, '0');
    }

    // Reset counter if we're on a fresh login page (different URL or page reload after successful login)
    // This handles session expiry scenarios where user is redirected back to login
    const usernameField = findUsernameField();
    const passwordField = findPasswordField();

    // The updated LMS keeps the login form inside a modal on the homepage.
    // Open that modal before looking for the fields when necessary.
    if (!usernameField || !passwordField) {
        openLoginModal();
    }

    if (usernameField && passwordField && !usernameField.value && !passwordField.value) {
        // Empty fields indicate a fresh login page or session expiry
        // Reset the counter to allow auto-login
        if (lastUrl && lastUrl !== currentUrl) {
            console.log('NUST Auto-Login: Detected new login page, resetting attempt counter');
            sessionStorage.setItem(attemptKey, '0');
        }
    }

    // Store current URL and timestamp for next check
    sessionStorage.setItem(lastUrlKey, currentUrl);
    sessionStorage.setItem(timestampKey, currentTime.toString());

    const attempts = parseInt(sessionStorage.getItem(attemptKey) || '0');

    if (attempts >= 2) {
        console.log('NUST Auto-Login: Max login attempts reached (2), stopping auto-login');
        showLoginStatus('Automatic login has already been attempted twice. Check your saved credentials and reload the page.');
        return;
    }

    // Increment attempt counter
    sessionStorage.setItem(attemptKey, (attempts + 1).toString());

    // Try to find elements with retry logic
    findElementsWithRetry(0);
}

function findElementsWithRetry(attempt) {
    if (attempt > 10) {
        console.log('NUST Auto-Login: Max retry attempts reached');
        reportLoginError('Could not find the LMS login fields. Try opening the login box again and reload the page.');
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
        openLoginModal();
        // The modal fields are rendered asynchronously after the button click.
        setTimeout(() => findElementsWithRetry(attempt + 1), 300);
    }
}

// Open the homepage login modal used by the current LMS frontend.
function openLoginModal() {
    // Avoid clicking the header button again while its modal is still rendering.
    if (loginModalRequested) return false;
    if (findUsernameField() || findPasswordField()) return false;

    const candidates = document.querySelectorAll('button, a, [role="button"]');
    for (const candidate of candidates) {
        const text = (candidate.textContent || candidate.getAttribute('aria-label') || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        // Do not match the accessibility "Skip to login form" link.
        if (/\blog\s*in\b/.test(text) && !text.includes('skip') && isVisible(candidate)) {
            console.log('NUST Auto-Login: Opening homepage login modal');
            loginModalRequested = true;
            candidate.click();
            return true;
        }
    }

    return false;
}

function fillAndSubmit(usernameField, passwordField, loginButton) {
    // Get credentials and enabled state from storage
    chrome.storage.local.get([
        'nustCredentials',
        'qalamCredentials',
        'qalamUseSame',
        'extensionEnabled'
    ], async (result) => {
        // Check if extension is enabled (default to true if not set)
        const isEnabled = result.extensionEnabled !== false;

        if (!isEnabled) {
            console.log('NUST Auto-Login: Extension is disabled, skipping auto-login');
            showLoginStatus('Auto-login is disabled in the extension settings.', 'info');
            return;
        }

        // The current LMS explicitly uses the same credentials as Qalam.
        // Fall back to Qalam storage when separate LMS credentials were not saved.
        const credentials = result.nustCredentials || result.qalamCredentials;

        if (credentials) {
            const { username, password: encryptedPassword } = credentials;
            console.log('NUST Auto-Login: Credentials found in storage');

            if (typeof username !== 'string' || !username.trim()) {
                reportLoginError('Saved username is empty. Open the extension popup and save your credentials.');
                return;
            }

            if (typeof encryptedPassword !== 'string' || !encryptedPassword) {
                reportLoginError('Saved password is missing. Open the extension popup and save your credentials.');
                return;
            }

            // Decrypt password
            const password = await decryptPassword(encryptedPassword);

            if (!password) {
                reportLoginError('Could not decrypt the saved password. Save your credentials again in the extension popup.');
                return;
            }

            // Check if fields are empty (not already filled)
            if (!usernameField.value && !passwordField.value) {
                console.log('NUST Auto-Login: Filling credentials');

                // Fill both fields immediately
                fillField(usernameField, username.trim());
                fillField(passwordField, password);

                if (!usernameField.value || !passwordField.value) {
                    reportLoginError('The LMS fields could not be filled. Try refreshing the page.');
                    return;
                }

                console.log('NUST Auto-Login: Credentials filled');

                // Click login button with delay for validation
                if (loginButton) {
                    setTimeout(() => {
                        try {
                            if (!loginButton.isConnected || !isVisible(loginButton)) {
                                reportLoginError('The LMS login button disappeared before submission.');
                                return;
                            }
                            console.log('NUST Auto-Login: Clicking login button');
                            loginButton.click();
                            verifyLoginResult(usernameField, passwordField);
                        } catch (error) {
                            reportLoginError('Could not click the LMS login button.', error);
                        }
                    }, 500);
                } else {
                    // Fallback: Try to submit the form directly
                    console.log('NUST Auto-Login: Login button not found, attempting form submission');
                    const form = usernameField.closest('form') || passwordField.closest('form');
                    if (form) {
                        setTimeout(() => {
                            try {
                                console.log('NUST Auto-Login: Submitting form directly');
                                form.requestSubmit ? form.requestSubmit() : form.submit();
                                verifyLoginResult(usernameField, passwordField);
                            } catch (error) {
                                reportLoginError('Could not submit the LMS login form.', error);
                            }
                        }, 500);
                    } else {
                        reportLoginError('Credentials were filled, but the LMS login form could not be found.');
                    }
                }
            } else {
                console.log('NUST Auto-Login: Fields already filled, skipping');
            }
        } else {
            reportLoginError('No saved LMS or Qalam credentials found. Open the extension popup and save them first.');
        }
    });
}

function verifyLoginResult(usernameField, passwordField) {
    setTimeout(() => {
        if (document.contains(usernameField) && document.contains(passwordField) &&
            isVisible(usernameField) && isVisible(passwordField)) {
            showLoginStatus('Login did not complete. Check your username and password.');
        }
    }, 2500);
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
        '#login-username',
        'input[name="username"]',
        'input[placeholder="Username" i]',
        'input[type="text"]:not([type="hidden"])',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[autocomplete="username" i]',
        'input[aria-label*="user" i]',
        '[role="textbox"][aria-label*="user" i]',
        '[role="textbox"][placeholder*="user" i]'
    ];

    const field = findFirstVisible(selectors);
    if (field) return field;

    // Last-resort fallback for custom controls: the first visible textbox that
    // is not clearly a password field.
    const textboxes = document.querySelectorAll('input, [role="textbox"]');
    return Array.from(textboxes).find(element => {
        const type = (element.getAttribute('type') || '').toLowerCase();
        const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''}`.toLowerCase();
        return type !== 'password' && !label.includes('search') && isVisible(element);
    }) || null;
}

// Helper function to find password field
function findPasswordField() {
    const selectors = [
        '#login-password',
        'input[name="password"]',
        'input[placeholder="Password" i]',
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[id*="pass" i]',
        'input[autocomplete="current-password" i]',
        'input[aria-label*="pass" i]',
        '[role="textbox"][aria-label*="pass" i]',
        '[role="textbox"][placeholder*="pass" i]'
    ];

    return findFirstVisible(selectors);
}

// Helper function to find the login button
function findLoginButton() {
    const selectors = [
        '#header-form-login input[type="submit"]',
        '#header-form-login button[type="submit"]',
        'button[type="submit"]',
        'input[type="submit"]',
        'button[id*="login" i]',
        'button[name*="login" i]',
        'input[id*="login" i]',
        'input[name*="login" i]',
        'button.btn-primary',
        'button.btn',
        'a.btn',
        '#loginbtn',
        'button[data-action="submit"]'
    ];

    let button = findFirstVisible(selectors);

    if (!button) {
        // Fallback 1: find any button with "log" in its text
        const buttons = document.querySelectorAll('button, input[type="submit"], a.btn, input[type="button"]');
        for (const btn of buttons) {
            const text = btn.textContent || btn.value || '';
            if (text.toLowerCase().includes('log') && isVisible(btn)) {
                console.log('NUST Auto-Login: Found login button by text content:', text);
                button = btn;
                break;
            }
        }
    }

    // Fallback 2: Try to find the form and get its submit button
    if (!button) {
        const form = document.querySelector('form');
        if (form) {
            const formButton = form.querySelector('button[type="submit"], input[type="submit"]');
            if (formButton && isVisible(formButton)) {
                console.log('NUST Auto-Login: Found login button within form');
                button = formButton;
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
        return null;
    }
}
