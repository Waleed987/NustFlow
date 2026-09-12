# 🔐 NUST Auto-Login Extension

A browser extension that automatically fills and submits your login Details for the NUST LMS portal, providing instant login experience.

## ✨ Features

- **Auto-Redirect**: Automatically redirects legacy LMS URLs to the current LMS homepage
- **Early LMS Login**: Uses the native login form as soon as its fields and security token are ready, without waiting for the popup or page images
- **Archive LMS Support**: Also supports `https://archivelms.nust.edu.pk/portal/`
- **Instant Auto-Login**: Automatically fills username and password when you visit the NUST LMS login page
- **Auto-Submit**: Automatically clicks the login button for seamless access
- **Secure Storage**: All credentials are stored locally in your browser using Chrome's secure storage API
- **Privacy First**: No data is sent to external servers - everything stays on your device
- **Easy Management**: Simple popup interface to save, update, or clear your credentials
- **Lightning Fast**: Optimized for speed with minimal delays.

## 📖 How to Use

### First Time Setup

1. **Save Your Credentials**
   - Click the extension icon in your browser toolbar
   - Enter your NUST LMS username and password
   - Click "Save Credentials"
   - You'll see a success message

2. **Test Auto-Login**
   - Navigate to https://lms.nust.edu.pk/
   - Your credentials will be automatically filled
   - The login button will be automatically clicked
   - You'll be logged in instantly!

### Managing Credentials

- **Update Credentials**: Click the extension icon, enter new credentials, and click "Save Credentials"
- **Clear Credentials**: Click the extension icon and click the "Clear" button

## 🔒 Security & Privacy

- ✅ All credentials are stored locally in your browser
- ✅ No external servers or databases involved
- ✅ No data collection or tracking
- ✅ Password is masked in the popup interface
- ✅ Uses Chrome's secure storage API

## 🛠️ Troubleshooting

**Auto-login not working?**
- Make sure you've saved your credentials in the extension popup
- Check that you're on the correct URL: `https://lms.nust.edu.pk/`
- Try refreshing the page
- Verify your credentials are correct

**After updating the unpacked extension:**

1. Open `chrome://extensions` and click the reload button on the NustFlow card.
2. Confirm the version is **1.0.5**.
3. Open a fresh tab, search Google for NUST LMS, and click the LMS result. Login no longer needs to open the popup first.

## Development tests

With Node.js and Chrome installed, run `npm install` once, then `npm test`.
The tests load the actual unpacked extension in a temporary Chrome profile, save encrypted dummy credentials through the popup, and intercept all website requests locally. They cover direct and search-link navigation, delayed resources/tokens, responsive layouts, page restoration, and login errors.

`npm run test:live` additionally opens the public LMS and real Google search results. It checks the generated login request but intercepts it before transmission; it does not authenticate an account. Google may require a CAPTCHA, in which case this smoke test stops.

---

**Made with ❤️ for NUST students**
