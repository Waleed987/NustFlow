// Load the actual extension against Qalam's public page in a temporary profile.
// Dummy login requests are intercepted locally, before reaching the university.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
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

        for (const mode of ['desktop', 'mobile']) {
            const page = await context.newPage();
            await page.setViewportSize(mode === 'mobile' ?
                { width: 390, height: 844 } : { width: 1440, height: 900 });
            const submissions = [];
            let started;
            await page.route('**/*', async route => {
                const request = route.request();
                const url = new URL(request.url());
                if (request.method() === 'POST' && url.hostname === 'qalam.nust.edu.pk' &&
                    url.pathname === '/web/login') {
                    const data = new URLSearchParams(request.postData());
                    submissions.push({
                        usernameMatches: data.get('login') === 'nustflow-test-user',
                        passwordMatches: data.get('password') === 'not-a-real-password',
                        securityTokenIncluded: !!data.get('csrf_token'),
                        millisecondsFromNavigation: Date.now() - started
                    });
                    await route.fulfill({ contentType: 'text/html', body:
                        '<!doctype html><title>NustFlow test</title><h1 id="test-complete">' +
                        'Qalam form verified. Test submission intercepted locally.</h1>' });
                } else if (!['GET', 'HEAD'].includes(request.method())) {
                    await route.abort();
                } else {
                    if (request.isNavigationRequest() && url.hostname === 'qalam.nust.edu.pk') {
                        started = Date.now();
                    }
                    await route.continue();
                }
            });
            await page.goto('https://qalam.nust.edu.pk/web/login', { waitUntil: 'commit', timeout: 30000 });
            try {
                await page.locator('#test-complete').waitFor({ timeout: 30000 });
            } catch (error) {
                const details = await page.evaluate(() => ({
                    title: document.title,
                    readyState: document.readyState,
                    status: document.querySelector('#nust-qalam-login-status')?.textContent,
                    formDetails: Array.from(document.forms).map(form => ({
                        method: form.method, action: form.action,
                        fields: Array.from(form.elements).map(field => ({
                            name: field.name, type: field.type, disabled: field.disabled
                        })),
                        csrfTokenPresent: !!form.querySelector('[name="csrf_token"]')?.value
                    }))
                }));
                if (details.title === 'Just a moment...' && details.formDetails.length === 0) {
                    throw new Error('Cloudflare browser verification blocked the live Qalam check. No account login was attempted.');
                }
                console.log(JSON.stringify(details));
                throw error;
            }
            assert.equal(submissions.length, 1);
            assert.ok(submissions[0].usernameMatches && submissions[0].passwordMatches && submissions[0].securityTokenIncluded);
            console.log(JSON.stringify({ mode, result: 'PASS (submission intercepted)', ...submissions[0] }));
            await page.close();
        }
    } finally {
        await context.close();
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
