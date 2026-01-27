# 🔧 Debugging Guide for NUST Auto-Login

The extension has been updated with better debugging. Follow these steps to troubleshoot:

## Step 1: Reload the Extension

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find **NUST Auto-Login**
3. Click the **reload icon** (circular arrow) to reload the extension with the new code

## Step 2: Open Browser Console

1. Navigate to https://lms.nust.edu.pk/portal/
2. Press **F12** to open Developer Tools
3. Click on the **Console** tab
4. Look for messages starting with "NUST Auto-Login:"

## Step 3: Check the Console Messages

You should see messages like:
```
NUST Auto-Login: Content script loaded
NUST Auto-Login: Initializing auto-login
NUST Auto-Login: Found elements: {username: true, password: true, button: true}
NUST Auto-Login: Credentials found in storage
NUST Auto-Login: Filling credentials
NUST Auto-Login: Clicking login button
```

## Common Issues & Solutions

### Issue 1: "No credentials saved"
**Solution:** 
- Click the extension icon
- Enter your username and password
- Click "Save Credentials"
- Refresh the login page

### Issue 2: "Could not find login form fields"
**Solution:**
- Take a screenshot of the console messages
- The page structure might be different than expected
- Share the console output so I can update the selectors

### Issue 3: Fields fill but button doesn't click
**Solution:**
- Check if you see "Login button not found" in console
- The button selector might need adjustment
- You can manually click the button after auto-fill

### Issue 4: Extension not loading
**Solution:**
- Make sure you reloaded the extension after the update
- Check for errors in the Extensions page
- Try removing and re-adding the extension

## Quick Test

1. **Reload extension** at `chrome://extensions/`
2. **Open console** (F12) on the login page
3. **Refresh** the login page
4. **Check console** for "NUST Auto-Login" messages
5. **Screenshot** the console and share if there are issues

---

**The updated extension now has detailed logging to help us debug any issues!**
