// Only a fresh installation opens setup. Updates, reloads, and browser startup
// must leave the user's tabs and existing settings alone.
chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') })
            .catch(() => console.warn('NustFlow: Open Quick setup from the extension icon.'));
    }
});
