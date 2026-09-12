const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const username = 'nustflow-test-user';
const password = 'not-a-real-password';
const attemptKey = 'nustflow_qalam_submissions';
let context;
let popup;
let shared;
let separate;

before(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--enable-unsafe-extension-debugging']
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '..') });
    popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup.html');
    await popup.locator('#username').fill(username);
    await popup.locator('#password').fill(password);
    await popup.locator('#saveBtn').click();
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('saved'));
    shared = await popup.evaluate(() => chrome.storage.local.get(null));
    assert.notEqual(shared.qalamCredentials.password, password);
    await popup.locator('label.switch').filter({ has: popup.locator('#qalamSameToggle') }).click();
    assert.equal(await popup.locator('#qalamSameToggle').isChecked(), false);
    await popup.locator('#qalamUsername').fill('qalam-only-user');
    await popup.locator('#qalamPassword').fill('qalam-only-test-password');
    await popup.locator('#saveBtn').click();
    await popup.waitForFunction(async () => (await chrome.storage.local.get('qalamCredentials'))
        .qalamCredentials.username === 'qalam-only-user');
    separate = await popup.evaluate(() => chrome.storage.local.get(null));
});

after(async () => { await context?.close(); });
beforeEach(async () => {
    await popup.evaluate(async storage => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set({ ...storage, extensionEnabled: true });
    }, shared);
});

function fixture(options = {}) {
    if (options.dashboard) return '<!doctype html><div class="user_heading_content">CGPA: <span>3.00</span></div>';
    return '<!doctype html><html><head><title>Qalam fixture</title></head><body>' +
        '<form method="get" action="/search"><input name="search" type="text"><button>Search</button></form>' +
        '<form id="qalam-form" method="post" action="' + (options.action || '/web/login') + '" ' +
        'onsubmit="if (!window.__cfRLUnblockHandlers) return false; this.action = \'/web/login\' + location.hash">' +
        '<input type="hidden" name="csrf_token" value="' + (options.token ?? 'qalam-test-csrf') + '">' +
        '<input id="login" name="login" placeholder="Username" value="' + (options.partial || '') + '">' +
        '<input id="password" name="password" placeholder="Password" type="password">' +
        '<div class="mb-2">' + (options.error ? 'Wrong login/password' : '') + '</div>' +
        '<button type="submit">Login</button>' +
        (options.streaming ? '<script src="/held-parser.js"></script>' : '') +
        '<input type="hidden" name="redirect" value="/student/dashboard?tab=academics">' +
        (options.extraRequired ? '<input name="extra" required>' : '') +
        '</form>' +
        (options.slow ? '<img src="/held-image.png"><script src="/held-theme.js"></script>' : '') +
        '</body></html>';
}

async function setup(t, options = {}) {
    const page = await context.newPage();
    const submissions = [];
    const errors = [];
    let release;
    let assetRequested;
    const gate = new Promise(resolve => { release = resolve; });
    const waitingForAsset = new Promise(resolve => { assetRequested = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    // All HTTP requests, including submissions, are handled locally.
    await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() === 'POST') {
            submissions.push({ url: request.url(), data: new URLSearchParams(request.postData()), time: Date.now() });
            await route.fulfill({ contentType: 'text/html', body: fixture({ dashboard: true }) +
                '<script>history.replaceState(null,"","/student/dashboard"+location.hash);</script>' });
        } else if (url.pathname.startsWith('/held-')) {
            assetRequested();
            await gate;
            await route.fulfill({ body: '', contentType: 'text/javascript' }).catch(() => {});
        } else if (url.hostname === 'www.google.com') {
            await route.fulfill({ contentType: 'text/html', body:
                '<a href="https://qalam.nust.edu.pk/web/login?redirect=%2Fstudent%2Fdashboard">Qalam</a>' });
        } else {
            await route.fulfill({ contentType: 'text/html', body: fixture(options) });
        }
    });
    t.after(async () => {
        release();
        await page.close();
        assert.deepEqual(errors, [], 'No browser JavaScript errors');
    });
    return { page, submissions, release, waitingForAsset };
}

async function expectLogin(page, submissions, expected = { username, password }) {
    await page.waitForURL('**/student/dashboard*', { waitUntil: 'domcontentloaded', timeout: 8000 });
    assert.equal(submissions.length, 1, 'Exactly one native POST');
    assert.equal(submissions[0].data.get('login'), expected.username);
    assert.equal(submissions[0].data.get('password'), expected.password);
    assert.equal(submissions[0].data.get('csrf_token'), 'qalam-test-csrf');
    assert.equal(submissions[0].data.get('redirect'), '/student/dashboard?tab=academics');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), attemptKey), null);
}

test('Qalam submits before stalled scripts/images finish, even when onsubmit cancels clicks', async t => {
    const { page, submissions } = await setup(t, { slow: true });
    await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
});

test('Qalam search-result navigation works with a redirect query and preserves return fields', async t => {
    const { page, submissions } = await setup(t);
    await page.goto('https://www.google.com/search?q=qalam+nust');
    await page.getByRole('link', { name: 'Qalam' }).click({ noWaitAfter: true });
    await expectLogin(page, submissions);
});

test('Qalam preserves the hash normally added by its inline submit handler', async t => {
    const { page, submissions } = await setup(t);
    await page.goto('https://qalam.nust.edu.pk/web/login#action=42', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
    assert.equal(new URL(page.url()).hash, '#action=42');
});

test('Qalam waits for the entire streamed form, including hidden fields after the password', async t => {
    const { page, submissions, release, waitingForAsset } = await setup(t, { streaming: true });
    await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit' });
    await waitingForAsset;
    await page.waitForTimeout(400);
    assert.equal(submissions.length, 0);
    release();
    await expectLogin(page, submissions);
});

test('Qalam waits for a delayed token, tolerates resizing, then submits without a one-second delay', async t => {
    const { page, submissions } = await setup(t, { token: '' });
    await page.goto('https://qalam.nust.edu.pk/web/login');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(submissions.length, 0);
    const readyAt = Date.now();
    await page.locator('[name="csrf_token"]').evaluate(field => { field.value = 'qalam-test-csrf'; });
    await expectLogin(page, submissions);
    assert.ok(submissions[0].time - readyAt < 900, 'No fixed one-second submit delay');
});

test('Qalam uses separate credentials when Same as LMS is disabled', async t => {
    await popup.evaluate(storage => chrome.storage.local.set(storage), separate);
    const { page, submissions } = await setup(t);
    await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit' });
    await expectLogin(page, submissions, { username: 'qalam-only-user', password: 'qalam-only-test-password' });
});

test('Qalam permits a remembered matching username and fills the missing password', async t => {
    const { page, submissions } = await setup(t, { partial: username });
    await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
});

test('Qalam resumes paused page discovery once, without duplicate submits', async t => {
    const { page, submissions } = await setup(t, { token: '' });
    await page.goto('https://qalam.nust.edu.pk/web/login');
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        document.querySelector('[name="csrf_token"]').value = 'qalam-test-csrf';
    });
    await page.waitForTimeout(300);
    assert.equal(submissions.length, 0);
    await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });
    await expectLogin(page, submissions);
});

test('Qalam ignores obsolete discovery counters', async t => {
    const { page, submissions } = await setup(t);
    await page.addInitScript(() => sessionStorage.setItem('qalam_login_attempts', '2'));
    await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit' });
    await expectLogin(page, submissions);
});

test('Qalam stops after two actual attempts and allows retry after credentials are saved', async t => {
    const { page, submissions } = await setup(t);
    await page.addInitScript(key => sessionStorage.setItem(key, JSON.stringify({ count: 2, time: Date.now() })), attemptKey);
    await page.goto('https://qalam.nust.edu.pk/web/login');
    await page.getByRole('status').waitFor();
    assert.match(await page.getByRole('status').textContent(), /two submissions/);
    assert.equal(submissions.length, 0);
    await popup.evaluate(async () => {
        const { nustCredentials } = await chrome.storage.local.get('nustCredentials');
        await chrome.storage.local.set({ nustCredentials: { ...nustCredentials, updated: true } });
    });
    await expectLogin(page, submissions);
});

for (const [name, storage, message] of [
    ['disabled', { extensionEnabled: false }, null],
    ['missing separate credentials', { qalamUseSame: false, qalamCredentials: null }, /No saved credentials/],
    ['corrupt encryption', { qalamUseSame: false, qalamCredentials: { username, password: 'broken-ciphertext' } }, /Could not decrypt/]
]) {
    test('Qalam ' + name + ' does not fill or submit', async t => {
        await popup.evaluate(data => chrome.storage.local.set(data), storage);
        const { page, submissions } = await setup(t);
        await page.goto('https://qalam.nust.edu.pk/web/login');
        if (message) {
            await page.getByRole('status').waitFor();
            assert.match(await page.getByRole('status').textContent(), message);
        } else await page.waitForTimeout(400);
        assert.equal(submissions.length, 0);
        assert.equal(await page.locator('#login').inputValue(), '');
        assert.equal(await page.locator('#password').inputValue(), '');
    });
}

for (const options of [
    { partial: 'another-user' }, { error: true },
    { action: 'https://untrusted.example/web/login' }, { extraRequired: true }
]) {
    test('Qalam does not submit: ' + JSON.stringify(options), async t => {
        const { page, submissions } = await setup(t, options);
        await page.goto('https://qalam.nust.edu.pk/web/login');
        await page.waitForTimeout(400);
        assert.equal(submissions.length, 0);
    });
}

test('Qalam dashboard clears the counter without starting a login loop', async t => {
    const { page, submissions } = await setup(t, { dashboard: true });
    await page.addInitScript(key => sessionStorage.setItem(key, JSON.stringify({ count: 2, time: Date.now() })), attemptKey);
    await page.goto('https://qalam.nust.edu.pk/student/dashboard');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), attemptKey), null);
    assert.equal(submissions.length, 0);
    assert.equal(await page.getByRole('status').count(), 0);
});

test('Qalam password reset and other login subroutes are left alone', async t => {
    const { page, submissions } = await setup(t);
    await page.goto('https://qalam.nust.edu.pk/web/login/totp');
    await page.waitForTimeout(400);
    assert.equal(submissions.length, 0);
    assert.equal(await page.locator('#password').inputValue(), '');
});
