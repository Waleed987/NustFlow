const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '..');
const username = 'nustflow-onboarding-test';
const password = ' not-a-real-password ';
let context;
let control;
let installedWelcome;
let extensionUrl;
let submissions = [];

before(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--enable-unsafe-extension-debugging']
    });
    context.setDefaultTimeout(8000);
    // No real account or university requests: both portals are local fixtures.
    await context.route('http{s,}://**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const qalam = url.hostname === 'qalam.nust.edu.pk';
        if (!qalam && url.hostname !== 'lms.nust.edu.pk') return route.abort();
        if (request.method() === 'POST') {
            submissions.push({ url: url.href, fields: new URLSearchParams(request.postData()) });
            return route.fulfill({ contentType: 'text/html', body:
                '<!doctype html><body class="loggedin"><h1 id="test-complete">Test login received</h1>' +
                '<a href="/web/session/logout">Log out</a><a href="/login/logout.php">Log out</a></body>' });
        }
        return route.fulfill({ contentType: 'text/html', body:
            '<!doctype html><html><body><form method="post" action="' + (qalam ? '/web/login' : '/login/index.php') + '">' +
            '<input name="' + (qalam ? 'login' : 'username') + '">' +
            '<input name="password" type="password">' +
            '<input type="hidden" name="' + (qalam ? 'csrf_token' : 'logintoken') + '" value="test-token">' +
            '<button type="submit">Log in</button></form></body></html>' });
    });
    const autoTab = context.waitForEvent('page');
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: repo });
    extensionUrl = 'chrome-extension://' + id;
    installedWelcome = await autoTab;
    await installedWelcome.waitForURL(extensionUrl + '/welcome.html');
    await installedWelcome.waitForFunction(() => !document.querySelector('#setupFields').disabled);
    control = await context.newPage();
    await control.goto(extensionUrl + '/popup.html');
});

after(async () => { await context?.close(); });
beforeEach(async () => {
    submissions = [];
    await control.evaluate(() => chrome.storage.local.clear());
});

async function welcome(t) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(async () => {
        if (!page.isClosed()) await page.close();
        assert.deepEqual(errors, [], 'No unhandled page errors');
    });
    await page.goto(extensionUrl + '/welcome.html');
    await page.waitForFunction(() => !document.querySelector('#setupFields').disabled ||
        !document.querySelector('#existing').hidden || !document.querySelector('#status').hidden);
    return page;
}

async function fill(page) {
    await page.getByLabel('LMS username', { exact: true }).fill('  ' + username + '  ');
    await page.getByLabel('Password', { exact: true }).fill(password);
}

async function save(page) {
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    await page.locator('#success').waitFor({ state: 'visible' });
}

async function storage() {
    return control.evaluate(() => chrome.storage.local.get(null));
}

async function screenshot(page, name) {
    if (process.env.NUSTFLOW_SCREENSHOT_DIR) {
        await page.screenshot({ path: path.join(process.env.NUSTFLOW_SCREENSHOT_DIR, name + '.png'), fullPage: true });
    }
}

test('a real fresh install automatically opens exactly one ready welcome tab', async t => {
    t.after(() => installedWelcome.close());
    assert.equal(context.pages().filter(page => page.url().endsWith('/welcome.html')).length, 1);
    assert.equal(await installedWelcome.locator('#useSame').isChecked(), true);
    assert.equal(await installedWelcome.locator('#qalamFields').isVisible(), false);
    assert.deepEqual(await storage(), {}, 'Simply opening setup saves no data');
    await screenshot(installedWelcome, 'nustflow-welcome-desktop');
});

test('install listener ignores updates and Chrome updates and requests no extra permissions', () => {
    let listener;
    const opened = [];
    vm.runInNewContext(fs.readFileSync(path.join(repo, 'background.js'), 'utf8'), {
        chrome: {
            runtime: {
                onInstalled: { addListener(fn) { listener = fn; } },
                getURL(file) { return 'chrome-extension://test/' + file; }
            },
            tabs: { create(tab) { opened.push(tab.url); return Promise.resolve(); } }
        }, console
    });
    for (const reason of ['update', 'chrome_update', 'shared_module_update']) listener({ reason });
    assert.deepEqual(opened, []);
    listener({ reason: 'install' });
    assert.deepEqual(opened, ['chrome-extension://test/welcome.html']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'))).permissions, ['storage']);
});

test('shared setup encrypts passwords, preserves whitespace, and both portal links log in', async t => {
    const page = await welcome(t);
    await fill(page);
    await save(page);
    const saved = await storage();
    assert.equal(saved.extensionEnabled, true);
    assert.equal(saved.qalamUseSame, true);
    assert.equal(saved.nustCredentials.username, username);
    assert.deepEqual(saved.nustCredentials, saved.qalamCredentials);
    assert.notEqual(saved.nustCredentials.password, password);
    assert.equal(await page.evaluate(async () => encryption.decrypt(
        (await chrome.storage.local.get('nustCredentials')).nustCredentials.password)), password);
    assert.equal(await page.locator('#password').inputValue(), '');
    assert.equal(await page.locator('#qalamPassword').inputValue(), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'successTitle');
    await screenshot(page, 'nustflow-welcome-success');

    for (const portal of ['Open LMS', 'Open Qalam']) {
        const newTab = context.waitForEvent('page');
        await page.getByRole('link', { name: portal, exact: true }).click();
        const tab = await newTab;
        t.after(() => tab.close());
        await tab.locator('#test-complete').waitFor();
    }
    assert.equal(submissions.length, 2);
    assert.equal(submissions[0].url, 'https://lms.nust.edu.pk/login/index.php');
    assert.equal(submissions[0].fields.get('username'), username);
    assert.equal(submissions[0].fields.get('password'), password);
    assert.equal(submissions[0].fields.get('logintoken'), 'test-token');
    assert.equal(submissions[1].url, 'https://qalam.nust.edu.pk/web/login');
    assert.equal(submissions[1].fields.get('login'), username);
    assert.equal(submissions[1].fields.get('password'), password);
    assert.equal(submissions[1].fields.get('csrf_token'), 'test-token');
});

test('separate details use the same encryption key and remain readable in settings', async t => {
    const page = await welcome(t);
    await fill(page);
    await page.getByLabel('Use the same details for Qalam').uncheck();
    await page.getByLabel('Qalam username', { exact: true }).fill('qalam-only-test');
    await page.getByLabel('Qalam password', { exact: true }).fill('different-test-password');
    await save(page);
    const saved = await storage();
    assert.equal(saved.qalamUseSame, false);
    assert.equal(saved.qalamCredentials.username, 'qalam-only-test');
    assert.notEqual(saved.nustCredentials.password, saved.qalamCredentials.password);
    assert.equal(await page.evaluate(async () => encryption.decrypt(
        (await chrome.storage.local.get('nustCredentials')).nustCredentials.password)), password);
    assert.equal(await page.evaluate(async () => encryption.decrypt(
        (await chrome.storage.local.get('qalamCredentials')).qalamCredentials.password)), 'different-test-password');
    await control.reload();
    await control.waitForFunction(() => document.querySelector('#qalamUsername').value === 'qalam-only-test');
    assert.equal(await control.locator('#username').inputValue(), username);
    assert.equal(await control.locator('#password').inputValue(), '••••••••');
    assert.equal(await control.locator('#qalamSameToggle').isChecked(), false);
});

test('skip closes only setup, saves nothing, and popup provides a way back', async t => {
    const page = await welcome(t);
    await fill(page);
    await page.getByLabel('Use the same details for Qalam').uncheck();
    const closed = page.waitForEvent('close');
    await page.getByRole('button', { name: 'Set up later' }).click();
    await closed;
    assert.deepEqual(await storage(), {});
    const opened = context.waitForEvent('page');
    await control.getByRole('link', { name: 'Quick setup & help' }).click();
    const resumed = await opened;
    t.after(() => resumed.close());
    await resumed.waitForURL(extensionUrl + '/welcome.html');
    await resumed.waitForFunction(() => !document.querySelector('#setupFields').disabled);
    assert.equal(await resumed.locator('#username').inputValue(), '');
    assert.equal(await resumed.locator('#useSame').isChecked(), true);
});

test('empty and whitespace-only usernames and missing separate fields cannot be saved', async t => {
    const page = await welcome(t);
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    assert.deepEqual(await storage(), {});
    await fill(page);
    await page.locator('#username').fill('   ');
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    assert.deepEqual(await storage(), {});
    await page.locator('#username').fill(username);
    await page.locator('#useSame').uncheck();
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    assert.deepEqual(await storage(), {});
    await page.locator('#useSame').check();
    await page.locator('#password').press('Enter');
    await page.locator('#success').waitFor({ state: 'visible' });
});

test('failed storage writes show an error without success and allow a retry', async t => {
    const page = await welcome(t);
    await fill(page);
    await page.evaluate(() => {
        window.originalStorageSet = chrome.storage.local.set;
        chrome.storage.local.set = async data => {
            if (data.nustCredentials) throw new Error('Simulated write failure');
            return window.originalStorageSet.call(chrome.storage.local, data);
        };
    });
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    await page.getByRole('alert').waitFor({ state: 'visible' });
    assert.match(await page.getByRole('alert').textContent(), /Could not save/);
    assert.equal(await page.locator('#success').isVisible(), false);
    assert.equal(await page.locator('#saveBtn').isEnabled(), true);
    const saved = await storage();
    assert.ok(saved._encryptionKey);
    assert.equal(saved.nustCredentials, undefined);
    assert.equal(saved.qalamCredentials, undefined);
    assert.equal(saved.extensionEnabled, undefined);
    await page.evaluate(() => { chrome.storage.local.set = window.originalStorageSet; });
    await save(page);
});

test('encryption failure does not save plaintext credentials', async t => {
    await control.evaluate(() => chrome.storage.local.set({ _encryptionKey: { invalid: true } }));
    const page = await welcome(t);
    await fill(page);
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    await page.getByRole('alert').waitFor({ state: 'visible' });
    const saved = await storage();
    assert.equal(saved.nustCredentials, undefined);
    assert.equal(saved.qalamCredentials, undefined);
    assert.equal(saved.extensionEnabled, undefined);
});

test('unreadable storage keeps setup disabled and explains how to recover', async () => {
    const elements = new Map();
    // Inject the failure before initialization without relying on Chrome's API
    // injection timing in extension-page init scripts.
    vm.runInNewContext(fs.readFileSync(path.join(repo, 'welcome.js'), 'utf8'), {
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, {
                    disabled: true, hidden: true, addEventListener() {}
                });
                return elements.get(id);
            }
        },
        chrome: { storage: { local: { get: async () => { throw new Error('Simulated read failure'); } } } }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('setupFields').disabled, true);
    assert.equal(elements.get('status').hidden, false);
    assert.match(elements.get('status').textContent, /Could not read your settings/);
});

test('existing saved details and a disabled extension are not overwritten or re-enabled', async t => {
    const existing = { nustCredentials: { username: 'existing-test', password: 'existing-ciphertext' },
        extensionEnabled: false, hideCgpa: true, qalamUseSame: false };
    await control.evaluate(saved => chrome.storage.local.set(saved), existing);
    const page = await welcome(t);
    assert.equal(await page.locator('#existing').isVisible(), true);
    assert.equal(await page.locator('#setup').isVisible(), false);
    assert.deepEqual(await storage(), existing);
    assert.equal(await page.getByRole('link', { name: 'Open settings' }).getAttribute('href'), 'popup.html');
});

test('a stale setup tab does not overwrite details saved in the popup meanwhile', async t => {
    const page = await welcome(t);
    await fill(page);
    const existing = { qalamCredentials: { username: 'another-test', password: 'saved-ciphertext' }, extensionEnabled: false };
    await control.evaluate(saved => chrome.storage.local.set(saved), existing);
    await page.getByRole('button', { name: 'Save & Enable' }).click();
    await page.locator('#existing').waitFor({ state: 'visible' });
    assert.deepEqual(await storage(), existing);
    assert.equal(await page.locator('#password').inputValue(), '');
});

test('rapid repeated submits only save one credential set', async t => {
    const page = await welcome(t);
    await fill(page);
    await page.evaluate(() => {
        const set = chrome.storage.local.set.bind(chrome.storage.local);
        window.credentialWrites = 0;
        chrome.storage.local.set = async data => {
            if (data.nustCredentials) window.credentialWrites++;
            return set(data);
        };
        for (let i = 0; i < 4; i++) document.querySelector('#setupForm').requestSubmit();
    });
    await page.locator('#success').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.credentialWrites), 1);
});

test('two setup tabs saving together do not overwrite each other', async t => {
    const first = await welcome(t);
    const second = await welcome(t);
    await fill(first);
    await fill(second);
    await second.locator('#username').fill('second-test-user');
    await second.locator('#password').fill('second-test-password');
    await Promise.all([first, second].map(page =>
        page.getByRole('button', { name: 'Save & Enable' }).click()));
    await Promise.all([first, second].map(page => page.waitForFunction(() =>
        !document.querySelector('#success').hidden || !document.querySelector('#existing').hidden)));
    const successCount = Number(await first.locator('#success').isVisible()) +
        Number(await second.locator('#success').isVisible());
    assert.equal(successCount, 1);
    const saved = await storage();
    assert.deepEqual(saved.nustCredentials, saved.qalamCredentials);
    const expected = saved.nustCredentials.username === username ? password : 'second-test-password';
    assert.equal(await first.evaluate(async () => encryption.decrypt(
        (await chrome.storage.local.get('nustCredentials')).nustCredentials.password)), expected);
});

test('popup and welcome share one encryption key even when first used concurrently', async t => {
    const page = await welcome(t);
    // Delay key reads so the two operations overlap even on a fast machine.
    const delayReads = () => {
        const get = chrome.storage.local.get.bind(chrome.storage.local);
        chrome.storage.local.get = async keys => {
            const value = await get(keys);
            if (keys === '_encryptionKey') await new Promise(resolve => setTimeout(resolve, 50));
            return value;
        };
    };
    await page.evaluate(delayReads);
    await control.evaluate(delayReads);
    const [first, second] = await Promise.all([
        page.evaluate(() => encryption.encrypt('welcome-test-password')),
        control.evaluate(() => encryption.encrypt('popup-test-password'))
    ]);
    assert.equal(await control.evaluate(value => encryption.decrypt(value), first), 'welcome-test-password');
    assert.equal(await page.evaluate(value => encryption.decrypt(value), second), 'popup-test-password');
    await control.reload();
});

test('setup fits narrow screens and separate fields remain usable', async t => {
    const page = await welcome(t);
    await page.setViewportSize({ width: 320, height: 700 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#useSame').uncheck();
    await page.getByLabel('Qalam password', { exact: true }).fill('test');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await screenshot(page, 'nustflow-welcome-mobile');
});

test('loading the unpacked extension again does not reopen welcome or change saved settings', async () => {
    const existing = { extensionEnabled: false, hideCgpa: true };
    await control.evaluate(saved => chrome.storage.local.set(saved), existing);
    const sentinel = await context.newPage();
    const cdp = await context.browser().newBrowserCDPSession();
    await cdp.send('Extensions.loadUnpacked', { path: repo });
    // Give any accidental onInstalled tab creation time to be observed.
    await sentinel.waitForTimeout(700);
    if (!control.isClosed()) await control.close();
    control = await context.newPage();
    await control.goto(extensionUrl + '/popup.html');
    await control.waitForFunction(() => !document.querySelector('#enableToggle').checked);
    assert.equal(context.pages().filter(page => page.url().endsWith('/welcome.html')).length, 0);
    assert.deepEqual(await storage(), existing);
    await sentinel.close();
});
