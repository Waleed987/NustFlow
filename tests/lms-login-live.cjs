// Public-site smoke test using the real extension in a temporary Chrome profile.
// Dummy login requests are intercepted locally and NEVER sent to the university.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chrome', headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--enable-unsafe-extension-debugging']
    });
    try {
        const cdp = await context.browser().newBrowserCDPSession();
        const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '..') });
        const popup = await context.newPage();
        await popup.goto('chrome-extension://' + id + '/popup.html');
        await popup.locator('#username').fill('nustflow-test-user');
        await popup.locator('#password').fill('not-a-real-password');
        await popup.locator('#saveBtn').click();
        await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('saved'));

        for (const mode of (process.env.NUSTFLOW_LIVE_MODE ?
            [process.env.NUSTFLOW_LIVE_MODE] : ['direct', 'google-desktop', 'google-mobile'])) {
            const page = await context.newPage();
            await page.setViewportSize(mode === 'google-mobile' ?
                { width: 390, height: 844 } : { width: 1440, height: 900 });
            const attempts = [];
            let started;
            await page.route('**/*', async route => {
                const request = route.request();
                const url = new URL(request.url());
                if (request.method() === 'POST' && url.hostname === 'lms.nust.edu.pk' &&
                    url.pathname === '/login/index.php') {
                    const data = new URLSearchParams(request.postData());
                    attempts.push({
                        usernameMatches: data.get('username') === 'nustflow-test-user',
                        passwordMatches: data.get('password') === 'not-a-real-password',
                        securityTokenIncluded: !!data.get('logintoken'),
                        millisecondsFromNavigation: Date.now() - started
                    });
                    await route.fulfill({ contentType: 'text/html', body:
                        '<!doctype html><title>NustFlow test</title><h1 id="test-complete">' +
                        'Login form verified. Test submission intercepted locally.</h1>' });
                } else if (!['GET', 'HEAD'].includes(request.method())) {
                    await route.abort();
                } else {
                    if (request.isNavigationRequest() && url.hostname === 'lms.nust.edu.pk') {
                        started = Date.now();
                    }
                    await route.continue();
                }
            });
            if (mode === 'direct') {
                await page.goto('https://lms.nust.edu.pk/', { waitUntil: 'commit', timeout: 30000 });
            } else {
                await page.goto('https://www.google.com/search?q=nust+lms', {
                    waitUntil: 'domcontentloaded', timeout: 30000
                });
                console.log(JSON.stringify({ mode, searchPage: page.url(), title: await page.title(),
                    resultHeadings: await page.locator('h3').allTextContents() }));
                if (page.url().includes('/sorry/') || await page.locator('iframe[src*="recaptcha"]').count()) {
                    throw new Error('Google requires a CAPTCHA in the temporary test profile; real-search verification is blocked.');
                }
                const result = page.locator('a[href^="https://lms.nust.edu.pk/"]').filter({
                    has: page.locator('h3')
                }).first();
                await result.click({ noWaitAfter: true, timeout: 10000 });
            }
            await page.locator('#test-complete').waitFor({ timeout: 30000 });
            assert.equal(attempts.length, 1);
            assert.ok(attempts[0].usernameMatches && attempts[0].passwordMatches && attempts[0].securityTokenIncluded);
            console.log(JSON.stringify({ mode, result: 'PASS (submission intercepted)', ...attempts[0] }));
            await page.close();
        }
    } finally {
        await context.close();
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
