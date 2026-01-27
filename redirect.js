// NUST Auto-Redirect Script
// Automatically redirects from index page to portal login

console.log('NUST Auto-Redirect: Script loaded on index page');

// Check if extension is enabled before redirecting
chrome.storage.local.get('extensionEnabled', (result) => {
    const isEnabled = result.extensionEnabled !== false;

    if (!isEnabled) {
        console.log('NUST Auto-Redirect: Extension is disabled, skipping redirect');
        return;
    }

    // Check if we're on the index page (with or without www)
    const currentUrl = window.location.href;
    if (currentUrl.includes('lms.nust.edu.pk/lms/index.php')) {
        console.log('NUST Auto-Redirect: Detected index page, redirecting to portal...');

        // Redirect to portal (use the same subdomain as current page)
        const targetUrl = currentUrl.includes('www.')
            ? 'https://www.lms.nust.edu.pk/portal/'
            : 'https://lms.nust.edu.pk/portal/';

        window.location.href = targetUrl;
    }
});
