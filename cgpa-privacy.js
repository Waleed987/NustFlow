// CGPA Privacy Script
// Hides CGPA on Qalam dashboard based on user preference

console.log('NUST CGPA Privacy: Script loaded');

// Run immediately
updateCgpaVisibility();

// Listen for storage changes (when user toggles in popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.showCgpa) {
        console.log('NUST CGPA Privacy: Toggle changed to', changes.showCgpa.newValue);
        updateCgpaVisibility();
    }
});

// Watch for page changes
const observer = new MutationObserver(() => {
    updateCgpaVisibility();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Also check after delays for dynamic content
setTimeout(updateCgpaVisibility, 500);
setTimeout(updateCgpaVisibility, 1000);
setTimeout(updateCgpaVisibility, 2000);

function updateCgpaVisibility() {
    chrome.storage.local.get('showCgpa', (result) => {
        const showCgpa = result.showCgpa !== false; // Default to showing

        console.log('NUST CGPA Privacy: showCgpa =', showCgpa);

        if (!showCgpa) {
            hideCgpa();
        } else {
            showCgpaElements();
        }
    });
}

function hideCgpa() {
    // Target the specific div that contains "Academic Standing:" and "CGPA:"
    const headingDivs = document.querySelectorAll('.divuser_heading_content');

    headingDivs.forEach(div => {
        const text = div.textContent || '';
        if (text.includes('CGPA:') || text.includes('Academic Standing:')) {
            div.style.filter = 'blur(10px)';
            div.style.userSelect = 'none';
            div.style.pointerEvents = 'none';
            div.setAttribute('data-cgpa-hidden', 'true');
            console.log('NUST CGPA Privacy: Hidden element with class divuser_heading_content');
        }
    });

    // Fallback: search for any element containing "CGPA:"
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        const text = div.textContent || '';
        // Only blur if it's a small element containing CGPA (to avoid blurring entire page)
        if (text.includes('CGPA:') && text.length < 150 && !div.hasAttribute('data-cgpa-hidden')) {
            div.style.filter = 'blur(10px)';
            div.style.userSelect = 'none';
            div.style.pointerEvents = 'none';
            div.setAttribute('data-cgpa-hidden', 'true');
            console.log('NUST CGPA Privacy: Hidden element containing CGPA');
        }
    });

    console.log('NUST CGPA Privacy: CGPA hidden');
}

function showCgpaElements() {
    // Remove blur from all hidden elements
    const hiddenElements = document.querySelectorAll('[data-cgpa-hidden="true"]');

    hiddenElements.forEach(element => {
        element.style.filter = '';
        element.style.userSelect = '';
        element.style.pointerEvents = '';
        element.removeAttribute('data-cgpa-hidden');
    });

    if (hiddenElements.length > 0) {
        console.log('NUST CGPA Privacy: CGPA visible, unblurred', hiddenElements.length, 'elements');
    }
}
