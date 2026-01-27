# 🔐 NUST Auto-Login Extension

A browser extension that automatically fills and submits your login credentials for the NUST LMS portal, providing instant login experience.

## ✨ Features

- **Auto-Redirect**: Automatically redirects from index page to portal login (no need to click "Portal" button)
- **Instant Auto-Login**: Automatically fills username and password when you visit the NUST LMS login page
- **Auto-Submit**: Automatically clicks the login button for seamless access
- **Secure Storage**: All credentials are stored locally in your browser using Chrome's secure storage API
- **Privacy First**: No data is sent to external servers - everything stays on your device
- **Easy Management**: Simple popup interface to save, update, or clear your credentials
- **Lightning Fast**: Optimized for speed with minimal delays (~200ms total)

## 🚀 Installation

### For Chrome/Edge/Brave

1. **Download the Extension**
   - The extension files are located in: `C:\Users\pc\Desktop\NustAutoLog`

2. **Open Extension Settings**
   - **Chrome**: Navigate to `chrome://extensions/`
   - **Edge**: Navigate to `edge://extensions/`
   - **Brave**: Navigate to `brave://extensions/`

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `NustAutoLog` folder (`C:\Users\pc\Desktop\NustAutoLog`)
   - The extension icon should appear in your browser toolbar

## 📖 How to Use

### First Time Setup

1. **Save Your Credentials**
   - Click the extension icon in your browser toolbar
   - Enter your NUST LMS username and password
   - Click "Save Credentials"
   - You'll see a success message

2. **Test Auto-Login**
   - Navigate to https://lms.nust.edu.pk/portal/
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

## 📁 Extension Structure

```
NustAutoLog/
├── manifest.json       # Extension configuration
├── popup.html         # Popup interface
├── popup.css          # Popup styling
├── popup.js           # Popup logic
├── content.js         # Auto-login script
├── redirect.js        # Auto-redirect script
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## 🛠️ Troubleshooting

**Auto-login not working?**
- Make sure you've saved your credentials in the extension popup
- Check that you're on the correct URL: `https://lms.nust.edu.pk/portal/`
- Try refreshing the page
- Verify your credentials are correct

**Extension not loading?**
- Make sure Developer Mode is enabled
- Check that all files are in the `NustAutoLog` folder
- Try removing and re-adding the extension

## 📝 Notes

- This extension only works on `lms.nust.edu.pk` domain
- Credentials are tied to your browser profile
- If you clear browser data, you'll need to re-enter credentials

## 🎨 Customization

You can customize the extension icons by replacing the PNG files in the `icons/` folder with your own designs (sizes: 16x16, 48x48, 128x128 pixels).

---

**Made with ❤️ for NUST students**
