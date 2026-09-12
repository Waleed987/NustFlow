// Qalam uses a native POST form. Submit as soon as its fields and CSRF token
// are parsed, without waiting for page assets or the old one-second click delay.
(() => {
    const statusElementId = 'nust-qalam-login-status';
    const attemptKey = 'nustflow_qalam_submissions';
    const attemptWindowMs = 5 * 60 * 1000;
    let running = false;
    let finished = false;
    let generation = 0;
    let observer = null;
    let progressTimer = null;
    let retryTimer = null;
    let deadlineTimer = null;
    let verificationTimer = null;
    let savedCredentials = null;

    function isLoginSurface() {
        return location.protocol === 'https:' && location.hostname === 'qalam.nust.edu.pk' &&
            location.pathname.replace(/\/+$/, '') === '/web/login';
    }

    function isAuthenticated() {
        return !!document.querySelector('a[href*="/web/session/logout"]') ||
            (location.pathname.replace(/\/+$/, '') === '/student/dashboard' &&
                !!document.querySelector('.user_heading_content'));
    }

    function isActivePage() {
        return !document.prerendering && document.visibilityState !== 'hidden';
    }

    function showStatus(message) {
        if (!document.documentElement) return;
        let status = document.getElementById(statusElementId);
        if (!status) {
            status = document.createElement('div');
            status.id = statusElementId;
            status.setAttribute('role', 'status');
            status.style.cssText = [
                'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
                'max-width:360px', 'padding:12px 16px', 'border-radius:6px',
                'font:14px/1.4 Arial,sans-serif', 'box-shadow:0 2px 10px rgba(0,0,0,.25)',
                'background:#ffe8e8', 'color:#8a1c1c'
            ].join(';');
            document.documentElement.appendChild(status);
        }
        status.textContent = 'NustFlow: ' + message;
        clearTimeout(status._hideTimer);
        status._hideTimer = setTimeout(() => status.remove(), 10000);
    }

    function pause() {
        running = false;
        generation++;
        observer?.disconnect();
        observer = null;
        clearTimeout(progressTimer);
        clearInterval(retryTimer);
        clearTimeout(deadlineTimer);
        clearTimeout(verificationTimer);
        progressTimer = retryTimer = deadlineTimer = verificationTimer = null;
        savedCredentials = null;
    }

    function stop(message) {
        pause();
        finished = true;
        if (message) showStatus(message);
    }

    function clearAttempts() {
        try { sessionStorage.removeItem(attemptKey); } catch { /* Storage may be unavailable. */ }
    }

    function recordSubmission(checkOnly = false) {
        try {
            const now = Date.now();
            let previous;
            try { previous = JSON.parse(sessionStorage.getItem(attemptKey)); } catch { /* Corrupt record. */ }
            const count = previous && Number.isInteger(previous.count) && previous.count > 0 &&
                Number.isFinite(previous.time) && now >= previous.time &&
                now - previous.time < attemptWindowMs ? previous.count : 0;
            if (count >= 2) {
                stop('Auto-login paused after two submissions. Check your saved credentials. Save them again to retry, or log in manually.');
                return false;
            }
            // Discovery, resizing, and page activation never consume an attempt.
            if (!checkOnly) sessionStorage.setItem(attemptKey, JSON.stringify({ count: count + 1, time: now }));
            return true;
        } catch {
            stop('Browser session storage is unavailable. Allow storage for Qalam or log in manually.');
            return false;
        }
    }

    function isVisible(element) {
        if (!element?.isConnected || !element.getClientRects().length) return false;
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none';
    }

    function hasLoginError() {
        return Array.from(document.querySelectorAll(
            'form .alert-danger, form [role="alert"], form .oe_login_error, form .mb-2'
        )).some(element => element.textContent.trim() &&
            !element.closest('[hidden], .hidden') && isVisible(element));
    }

    function isFormParsed(form) {
        if (document.readyState !== 'loading') return true;
        // During streaming, a following sibling proves the parser has left the
        // form. Include fields after the password, such as Odoo's redirect field.
        for (let node = form; node && node !== document.documentElement; node = node.parentElement) {
            if (node.nextSibling) return true;
        }
        return false;
    }

    function findLoginForm() {
        for (const form of document.forms) {
            let action;
            try { action = new URL(form.action, location.href); } catch { continue; }
            if (form.method.toLowerCase() !== 'post' || action.origin !== location.origin ||
                action.pathname.replace(/\/+$/, '') !== '/web/login' || !isFormParsed(form)) continue;
            const username = form.querySelector('input[name="login"]');
            const password = form.querySelector('input[name="password"]');
            const token = form.querySelector('input[name="csrf_token"]');
            if (!username || !password || !token?.value ||
                username.form !== form || password.form !== form || token.form !== form ||
                username.matches(':disabled') || password.matches(':disabled') ||
                token.matches(':disabled') || username.readOnly || password.readOnly) continue;
            return { form, username, password, action };
        }
    }

    function setField(field, value) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function loadCredentials() {
        const result = await chrome.storage.local.get([
            'extensionEnabled', 'nustCredentials', 'qalamCredentials', 'qalamUseSame', '_encryptionKey'
        ]);
        if (result.extensionEnabled === false) return null;
        const credentials = result.qalamUseSame === false ? result.qalamCredentials :
            (result.nustCredentials || result.qalamCredentials);
        if (!credentials) throw new Error('No saved credentials. Open NustFlow and save your Qalam credentials first.');
        if (typeof credentials.username !== 'string' || !credentials.username.trim()) {
            throw new Error('Saved username is empty. Open NustFlow and save your credentials again.');
        }
        if (typeof credentials.password !== 'string' || !credentials.password) {
            throw new Error('Saved password is missing. Open NustFlow and save your credentials again.');
        }
        let password = credentials.password;
        if (result._encryptionKey) {
            try {
                const key = await crypto.subtle.importKey(
                    'jwk', result._encryptionKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
                );
                const combined = Uint8Array.from(atob(password), c => c.charCodeAt(0));
                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12)
                );
                password = new TextDecoder().decode(decrypted);
            } catch {
                throw new Error('Could not decrypt the saved password. Open NustFlow and save your credentials again.');
            }
        }
        if (!password) throw new Error('Saved password is empty. Open NustFlow and save your credentials again.');
        return { username: credentials.username.trim(), password };
    }

    function progress() {
        progressTimer = null;
        if (!running || !savedCredentials) return;
        if (!isActivePage()) { pause(); return; }
        if (isAuthenticated()) { clearAttempts(); stop(); return; }
        if (!isLoginSurface()) { stop(); return; }
        if (hasLoginError()) {
            stop('Qalam reported a login error. Check your saved credentials or log in manually.');
            return;
        }
        const fields = findLoginForm();
        if (!fields) return;
        if (!recordSubmission(true)) return;
        const { form, username, password, action } = fields;
        // Leave different credentials under the user's control. A remembered
        // matching username can be completed with the saved password.
        if ((username.value && username.value !== savedCredentials.username) ||
            (password.value && password.value !== savedCredentials.password)) {
            stop();
            return;
        }
        setField(username, savedCredentials.username);
        setField(password, savedCredentials.password);
        if (!username.value || !password.value || !form.checkValidity()) {
            stop('The Qalam login form could not be completed. Check the fields or log in manually.');
            return;
        }
        if (!recordSubmission()) return;
        // Stop observers before submission so input changes cannot log in twice.
        // Keep all native fields, including csrf_token and any return URL.
        stop();
        try {
            // Qalam's inline onsubmit only adds location.hash, but its page
            // loader can cancel that event until scripts finish. Preserve the
            // hash ourselves and submit the validated native form directly.
            action.hash = location.hash;
            form.action = action.href;
            HTMLFormElement.prototype.submit.call(form);
            verificationTimer = setTimeout(() => {
                if (isAuthenticated()) { clearAttempts(); return; }
                if (form.isConnected && isActivePage()) {
                    showStatus('Qalam has not completed login yet. If it stays here, check the login form for an error.');
                }
            }, 10000);
        } catch {
            showStatus('Could not submit the Qalam login form. Try logging in manually.');
        }
    }

    function scheduleProgress() {
        if (running && progressTimer === null) progressTimer = setTimeout(progress, 0);
    }

    async function start() {
        if (finished || running || !isActivePage()) return;
        if (isAuthenticated()) { clearAttempts(); stop(); return; }
        if (!isLoginSurface()) return;
        running = true;
        const currentGeneration = ++generation;
        observer = new MutationObserver(scheduleProgress);
        observer.observe(document, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['value', 'disabled', 'readonly', 'class', 'hidden']
        });
        // The observer handles parsed/inserted forms immediately; the fallback
        // also catches input.value updates that produce no DOM mutation.
        retryTimer = setInterval(scheduleProgress, 250);
        deadlineTimer = setTimeout(() => stop(
            'The Qalam login form is not ready. Try reloading the page or logging in manually.'
        ), 30000);
        try {
            const credentials = await loadCredentials();
            if (currentGeneration !== generation) return;
            if (!credentials) { stop(); return; }
            savedCredentials = credentials;
            scheduleProgress();
        } catch (error) {
            if (currentGeneration === generation) stop(
                error.message?.startsWith('Saved ') || error.message?.startsWith('No saved ') ||
                error.message?.startsWith('Could not decrypt ') ? error.message :
                    'Could not read saved credentials. Reload NustFlow in Chrome and refresh Qalam.'
            );
        }
    }

    // Speculative loads and back/forward restores need activation hooks;
    // DOMContentLoaded alone misses documents Chrome has already loaded.
    if (window.top !== window) return;
    if (isAuthenticated()) clearAttempts();
    // At document_start the dashboard's account menu/body may not exist yet.
    // Clear the submission budget after it is parsed, without starting login there.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isAuthenticated()) clearAttempts();
        }, { once: true });
    }
    if (!isLoginSurface()) return;
    document.addEventListener('DOMContentLoaded', scheduleProgress, { once: true });
    document.addEventListener('prerenderingchange', start);
    document.addEventListener('visibilitychange', () => {
        if (isActivePage()) start();
        else pause();
    });
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', event => {
        if (event.persisted) finished = false;
        start();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !['nustCredentials', 'qalamCredentials', 'qalamUseSame', 'extensionEnabled']
            .some(key => key in changes)) return;
        pause();
        clearAttempts();
        finished = false;
        start();
    });
    start();
})();
