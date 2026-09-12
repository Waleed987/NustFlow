# 🔐 NUST Auto-Login Extension

A browser extension that automatically fills and submits your login Details for the NUST LMS portal, providing instant login experience.

## ✨ Features

- **Quick First-Install Setup**: One welcome tab to save LMS/Qalam details or skip; no welcome tabs on updates or browser startup
- **Auto-Redirect**: Automatically redirects legacy LMS URLs to the current LMS homepage
- **Early LMS Login**: Uses the native login form as soon as its fields and security token are ready, without waiting for the popup or page images
- **Early Qalam Login**: Submits Qalam's completed native form without waiting for page assets or adding a one-second delay; preserves its security token and return URL
- **Archive LMS Support**: Also supports `https://archivelms.nust.edu.pk/portal/`
- **Instant Auto-Login**: Automatically fills username and password when you visit the NUST LMS login page
- **Auto-Submit**: Automatically clicks the login button for seamless access
- **Local Storage**: Passwords are encrypted locally; usernames and the encryption key are stored in the same browser profile
- **Privacy First**: Login details are sent only to NUST when signing you in; no analytics or third-party credential servers
- **Easy Management**: Simple popup interface to save, update, or clear your credentials
- **Lightning Fast**: Optimized for speed with minimal delays.

## 📖 How to Use

### First Time Setup

1. A short welcome page opens when you first install NustFlow.
2. Enter your LMS username and password. Keep **Use the same details for Qalam** checked, or uncheck it to enter separate Qalam details.
3. Click **Save & Enable**, then **Open LMS** or **Open Qalam** to try auto-login. Saving does not verify that your login details are correct; the portal does that when you visit.

In a hurry? **Set up later** closes the welcome tab without saving anything. Click Chrome's puzzle icon, choose **NustFlow**, then **Quick setup & help** whenever you're ready. Pin NustFlow for easy access.

Setup opens automatically only on a new install, not on updates, extension reloads, or browser startup. Reopening setup with existing credentials leaves your settings untouched and offers **Open settings** instead.

### Managing Credentials

- **Update Credentials**: Click the extension icon, enter new credentials, and click "Save"
- **Clear Credentials**: Click the extension icon and click the "Clear" button

## 🔒 Security & Privacy

- ✅ All credentials are stored locally in your browser
- ✅ Login details are sent only to NUST when signing you in
- ✅ No data collection or tracking
- ✅ Password is masked in the popup interface
- ✅ Uses Chrome's local storage API with AES-GCM password encryption

Local encryption does not protect against someone with access to your browser profile or device: the encryption key is stored alongside the encrypted passwords.

## 🛠️ Troubleshooting

**Auto-login not working?**
- Make sure you've saved your credentials in the extension popup
- Check that you're on the correct URL: `https://lms.nust.edu.pk/`
- Try refreshing the page
- Verify your credentials are correct

**After updating the unpacked extension:**

1. Open `chrome://extensions` and click the reload button on the NustFlow card.
2. Confirm the version is **1.0.7**.
3. Open a fresh tab and visit LMS or `https://qalam.nust.edu.pk/web/login`. Both login flows now start when their native forms are ready.

## Development tests

With Node.js and Chrome installed, run `npm install` once, then `npm test`.
The tests load the actual unpacked extension in temporary Chrome profiles, save encrypted dummy credentials through the popup, and intercept all website requests locally. They cover LMS and Qalam direct/search-link navigation, delayed resources/tokens, responsive layouts, page restoration, login errors, and Qalam shared/separate credentials.
Onboarding tests additionally cover first-install behavior, update/reload suppression, skip/resume, shared/separate password encryption, validation, save failures, existing-settings preservation, and small-screen layouts.

`npm run test:live` additionally opens the public LMS and real Google search results. It checks the generated login request but intercepts it before transmission; it does not authenticate an account. Google may require a CAPTCHA, in which case this smoke test stops.

`npm run test:qalam:live` checks Qalam's public login page at desktop and mobile widths, also intercepting dummy submissions locally without authenticating an account. This test stops if Cloudflare requires browser verification.

---

**Made with ❤️ for NUST students**
