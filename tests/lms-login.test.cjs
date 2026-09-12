const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const username = 'nustflow-test-user';
const password = 'not-a-real-password';
const attemptKey = 'nustflow_lms_submissions';
let context;
let popup;
let saved;

before(async () => {
    // A temporary, separate Chrome profile loads the real extension/manifest.
    context = await chromium.launchPersistentContext('', {
        channel: 'chrome', headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--enable-unsafe-extension-debugging']
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup.html');
    await popup.locator('#username').fill(username);
    await popup.locator('#password').fill(password);
    await popup.locator('#saveBtn').click();
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('saved'));
    saved = await popup.evaluate(() => chrome.storage.local.get([
        'nustCredentials', 'qalamCredentials', '_encryptionKey'
    ]));
    assert.notEqual(saved.nustCredentials.password, password, 'Popup must encrypt the test password');
});

after(async () => { await context?.close(); });

beforeEach(async () => {
    await popup.evaluate(async storage => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({ ...storage, extensionEnabled: true });
    }, saved);
});

function fixture({ token = 'fixture-csrf-token', partial = '', dashboard = false,
    error = false, slow = false, malicious = false, pathname = '/' } = {}) {
    const action = pathname.startsWith('/portal') ? '/portal/login/index.php' : '/login/index.php';
    const form = id => '<form hidden id="' + id + '" method="post" action="' +
        (malicious ? 'https://untrusted.example/login/index.php' : action) + '">' +
        '<input name="username" value="' + partial + '"><input name="password" type="password">' +
        '<input type="hidden" name="logintoken" value="' + token + '">' +
        '<input type="submit" value="Log in"></form>';
    return '<!doctype html><html><head><title>LMS test fixture</title></head><body class="' +
        (dashboard ? 'loggedin' : 'notloggedin') + '">' +
        (error ? '<div id="loginerrormessage">Invalid login, please try again</div>' : '') +
        '<a href="#themeskipto-login">Skip to login form</a>' +
        '<button id="menu">Menu</button><button id="open-login">Log in</button>' +
        '<form action="/course/search.php"><input type="text" name="search"><button>Search</button></form>' +
        form('menu-form-login') + form('header-form-login') +
        '<script>window.buttonClicks=0;document.addEventListener("click",e=>{' +
        'if(e.target.closest("button"))window.buttonClicks++});</script>' +
        (slow ? '<img src="/slow-image.jpg"><script src="/slow-theme.js"></script>' : '') +
        '</body></html>';
}

async function setup(t, options = {}) {
    const page = await context.newPage();
    const submissions = [];
    const errors = [];
    let release;
    const assets = new Promise(resolve => { release = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    // Every HTTP request is intercepted: no test credentials reach real LMS.
    await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'POST') {
            submissions.push({ url: request.url(), data: new URLSearchParams(request.postData()) });
            await route.fulfill({ contentType: 'text/html', body: fixture({ dashboard: true }) +
                '<script>history.replaceState(null,"","/my/");</script>' });
        } else if (url.pathname.startsWith('/slow-')) {
            await assets;
            await route.fulfill({ body: '', contentType: 'text/javascript' }).catch(() => {});
        } else if (url.hostname === 'www.google.com') {
            await route.fulfill({ contentType: 'text/html', body: '<a href="' +
                (options.target || 'https://lms.nust.edu.pk/') + '">NUST LMS: Home</a>' });
        } else {
            await route.fulfill({ contentType: 'text/html', body: fixture({
                ...options, pathname: url.pathname,
                dashboard: options.dashboard || url.pathname === '/my/'
            }) });
        }
    });
    t.after(async () => {
        release();
        await page.close();
        assert.deepEqual(errors, [], 'No browser JavaScript errors');
    });
    return { page, submissions, release };
}

async function expectLogin(page, submissions) {
    await page.waitForURL('**/my/', { timeout: 8000, waitUntil: 'domcontentloaded' });
    assert.equal(submissions.length, 1, 'Exactly one form submission');
    assert.equal(submissions[0].data.get('username'), username);
    assert.equal(submissions[0].data.get('password'), password);
    assert.equal(submissions[0].data.get('logintoken'), 'fixture-csrf-token');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), attemptKey), null,
        'A successfully loaded account page resets the retry counter');
}

test('direct URL: hidden native form logs in with the encrypted popup credentials', async t => {
    const { page, submissions } = await setup(t);
    await page.goto('https://lms.nust.edu.pk/', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
});

test('Google result click: logs in even while theme scripts and images are stalled', async t => {
    const { page, submissions, release } = await setup(t, { slow: true });
    await page.goto('https://www.google.com/search?q=nust+lms');
    await page.getByRole('link', { name: 'NUST LMS: Home' }).click({ noWaitAfter: true });
    await expectLogin(page, submissions);
    release();
});

for (const target of [
    'https://lms.nust.edu.pk/?redirect=0',
    'https://www.lms.nust.edu.pk/index.php?redirect=0',
    'https://lms.nust.edu.pk/login/index.php',
    'https://archivelms.nust.edu.pk/portal/'
]) {
    test('search-link URL variant: ' + target, async t => {
        const { page, submissions } = await setup(t, { target });
        await page.goto('https://www.google.com/search?q=nust+lms');
        await page.getByRole('link', { name: 'NUST LMS: Home' }).click({ noWaitAfter: true });
        await expectLogin(page, submissions);
    });
}

test('resize and delayed security token: waits for token, submits once without opening menus', async t => {
    const { page, submissions } = await setup(t, { token: '' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('https://lms.nust.edu.pk/');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(submissions.length, 0);
    assert.equal(await page.evaluate(() => window.buttonClicks), 0);
    await page.evaluate(() => {
        document.querySelectorAll('[name="logintoken"]').forEach(field => { field.value = 'fixture-csrf-token'; });
    });
    await expectLogin(page, submissions);
});

test('page restoration resumes paused discovery without duplicate submissions', async t => {
    const { page, submissions } = await setup(t, { token: '' });
    await page.goto('https://lms.nust.edu.pk/');
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        document.querySelectorAll('[name="logintoken"]').forEach(field => { field.value = 'fixture-csrf-token'; });
    });
    await page.waitForTimeout(300);
    assert.equal(submissions.length, 0);
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await expectLogin(page, submissions);
});

test('disabled extension does not fill fields or submit', async t => {
    await popup.evaluate(() => chrome.storage.local.set({ extensionEnabled: false }));
    const { page, submissions } = await setup(t);
    await page.goto('https://lms.nust.edu.pk/');
    await page.waitForTimeout(500);
    assert.equal(submissions.length, 0);
    assert.equal(await page.locator('#header-form-login [name="username"]').inputValue(), '');
});

test('missing credentials show a useful error and no submission', async t => {
    await popup.evaluate(() => chrome.storage.local.remove(['nustCredentials', 'qalamCredentials']));
    const { page, submissions } = await setup(t);
    await page.goto('https://lms.nust.edu.pk/');
    await page.getByRole('status').waitFor();
    assert.match(await page.getByRole('status').textContent(), /No saved credentials/);
    assert.equal(submissions.length, 0);
});

test('corrupt encrypted password stops with an error', async t => {
    await popup.evaluate(() => chrome.storage.local.set({
        nustCredentials: { username: 'nustflow-test-user', password: 'invalid-ciphertext' }
    }));
    const { page, submissions } = await setup(t);
    await page.goto('https://lms.nust.edu.pk/');
    await page.getByRole('status').waitFor();
    assert.match(await page.getByRole('status').textContent(), /Could not decrypt/);
    assert.equal(submissions.length, 0);
});

test('legacy discovery counters do not block a fresh login', async t => {
    const { page, submissions } = await setup(t);
    await page.addInitScript(() => {
        sessionStorage.setItem('lms_login_attempts', '2');
        sessionStorage.setItem('lms_last_attempt_time', String(Date.now()));
    });
    await page.goto('https://lms.nust.edu.pk/', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
});

test('two actual submissions pause login; saving corrected credentials permits retry', async t => {
    const { page, submissions } = await setup(t);
    await page.addInitScript(key => {
        sessionStorage.setItem(key, JSON.stringify({ count: 2, time: Date.now() }));
    }, attemptKey);
    await page.goto('https://lms.nust.edu.pk/');
    await page.getByRole('status').waitFor();
    assert.equal(submissions.length, 0);
    assert.equal(await page.locator('#header-form-login [name="username"]').inputValue(), '');
    await popup.evaluate(async () => {
        const { nustCredentials } = await chrome.storage.local.get('nustCredentials');
        await chrome.storage.local.set({ nustCredentials: { ...nustCredentials, updated: true } });
    });
    await expectLogin(page, submissions);
});

for (const options of [
    { dashboard: true }, { partial: 'user-is-typing' }, { error: true }, { malicious: true }
]) {
    test('does not submit: ' + JSON.stringify(options), async t => {
        const { page, submissions } = await setup(t, options);
        await page.goto('https://lms.nust.edu.pk/');
        await page.waitForTimeout(500);
        assert.equal(submissions.length, 0);
        assert.equal(await page.evaluate(() => window.buttonClicks), 0);
    });
}
