(() => {
    const form = document.getElementById('setupForm');
    const fields = document.getElementById('setupFields');
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const useSame = document.getElementById('useSame');
    const qalamFields = document.getElementById('qalamFields');
    const qalamUsername = document.getElementById('qalamUsername');
    const qalamPassword = document.getElementById('qalamPassword');
    const save = document.getElementById('saveBtn');
    const skip = document.getElementById('skipBtn');
    const status = document.getElementById('status');
    let saving = false;

    function showError(message) {
        status.textContent = message;
        status.hidden = false;
    }

    function showSection(id) {
        for (const section of ['setup', 'success', 'existing']) {
            document.getElementById(section).hidden = section !== id;
        }
        // Never keep passwords in hidden form controls after setup.
        form.reset();
        password.value = '';
        qalamPassword.value = '';
        status.hidden = true;
        document.getElementById(id + 'Title')?.focus();
    }

    async function hasSavedCredentials() {
        const saved = await chrome.storage.local.get(['nustCredentials', 'qalamCredentials']);
        return Boolean(saved.nustCredentials || saved.qalamCredentials);
    }

    function updateSeparateFields() {
        qalamFields.hidden = useSame.checked;
        qalamFields.disabled = useSame.checked;
        useSame.setAttribute('aria-expanded', String(!useSame.checked));
    }

    useSame.addEventListener('change', updateSeparateFields);
    form.addEventListener('input', () => { status.hidden = true; });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || fields.disabled) return;
        username.value = username.value.trim();
        qalamUsername.value = qalamUsername.value.trim();
        if (!form.reportValidity()) return;

        // Capture before disabling fields. Preserve password whitespace exactly.
        const lmsUser = username.value;
        const lmsPassword = password.value;
        const shared = useSame.checked;
        const qalamUser = shared ? lmsUser : qalamUsername.value;
        const separatePassword = qalamPassword.value;
        saving = true;
        fields.disabled = true;
        skip.disabled = true;
        save.textContent = 'Saving...';
        status.hidden = true;

        try {
            await navigator.locks.request('nustflow-setup-save', async () => {
                // Serialize setup saves across tabs and leave existing accounts alone.
                if (await hasSavedCredentials()) {
                    showSection('existing');
                    return;
                }
                const encryptedLms = await encryption.encrypt(lmsPassword);
                const encryptedQalam = shared ? encryptedLms : await encryption.encrypt(separatePassword);
                if (!encryptedLms || !encryptedQalam) throw new Error('Encryption unavailable');
                // The user may have saved from the settings popup during encryption.
                if (await hasSavedCredentials()) {
                    showSection('existing');
                    return;
                }
                await chrome.storage.local.set({
                    nustCredentials: { username: lmsUser, password: encryptedLms },
                    qalamCredentials: { username: qalamUser, password: encryptedQalam },
                    qalamUseSame: shared,
                    extensionEnabled: true
                });
                showSection('success');
            });
        } catch {
            // Keep a useful, credential-free error on screen until the user retries.
            showError('Could not save your details. Please try again. If this continues, reload the extension.');
        } finally {
            saving = false;
            fields.disabled = false;
            skip.disabled = false;
            save.textContent = 'Save & Enable';
        }
    });

    skip.addEventListener('click', async () => {
        if (saving) return;
        try {
            const tab = await chrome.tabs.getCurrent();
            if (tab?.id === undefined) throw new Error('No setup tab');
            await chrome.tabs.remove(tab.id);
        } catch {
            showError('You can close this tab and set up later from the NustFlow extension icon.');
        }
    });

    // A revisited setup page must not erase credentials or re-enable a paused user.
    (async () => {
        try {
            if (await hasSavedCredentials()) showSection('existing');
            else {
                fields.disabled = false;
                updateSeparateFields();
                username.focus();
            }
        } catch {
            showError('Could not read your settings. Reload this page to try again.');
        }
    })();
})();
