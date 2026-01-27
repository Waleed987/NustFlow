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

    // Check if we're on the index page
    if (window.location.href.includes('lms.nust.edu.pk/lms/index.php')) {
        console.log('NUST Auto-Redirect: Detected index page, redirecting to portal...');

        // Redirect immediately to portal
        window.location.href = 'https://lms.nust.edu.pk/portal/';
    }
});
