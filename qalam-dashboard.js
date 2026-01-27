// NUST Qalam Dashboard Content Script
// This script runs on qalam.nust.edu.pk/student/dashboard
// Handles hiding/showing CGPA based on user preference

console.log('NUST Qalam Dashboard: Content script loaded');

// Run immediately when script loads
initCgpaVisibility();

// Also run on DOMContentLoaded as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCgpaVisibility);
}

// Listen for storage changes to update visibility in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.hideCgpa) {
        console.log('NUST Qalam Dashboard: CGPA visibility preference changed');
        applyCgpaVisibility(changes.hideCgpa.newValue);
    }
});

function initCgpaVisibility() {
    console.log('NUST Qalam Dashboard: Initializing CGPA visibility');

    // Get CGPA visibility preference from storage
    chrome.storage.local.get(['hideCgpa'], (result) => {
        const hideCgpa = result.hideCgpa || false;
        console.log('NUST Qalam Dashboard: Hide CGPA preference:', hideCgpa);
        applyCgpaVisibility(hideCgpa);
    });
}

function applyCgpaVisibility(shouldHide) {
    // Find the CGPA element
    const cgpaElements = findCgpaElements();

    if (cgpaElements.length === 0) {
        console.log('NUST Qalam Dashboard: CGPA elements not found, retrying...');
        // Retry after a short delay in case DOM is still loading
        setTimeout(() => {
            const retryElements = findCgpaElements();
            if (retryElements.length > 0) {
                hideCgpaElements(retryElements, shouldHide);
            } else {
                console.log('NUST Qalam Dashboard: CGPA elements not found after retry');
            }
        }, 500);
        return;
    }

    hideCgpaElements(cgpaElements, shouldHide);
}

function findCgpaElements() {
    const elements = [];

    // Find all elements with class 'user_heading_content'
    const headingContents = document.querySelectorAll('.user_heading_content');

    for (const element of headingContents) {
        // Check if this element contains "CGPA:" text
        if (element.textContent.includes('CGPA:')) {
            elements.push(element);
            console.log('NUST Qalam Dashboard: Found CGPA element');
        }
    }

    return elements;
}

function hideCgpaElements(elements, shouldHide) {
    for (const element of elements) {
        if (shouldHide) {
            // Hide the CGPA line by finding and hiding the specific text
            const textNodes = getTextNodes(element);

            for (const node of textNodes) {
                if (node.textContent.includes('CGPA:')) {
                    // Create a style to hide this specific line
                    if (!element.querySelector('.cgpa-hidden-style')) {
                        const style = document.createElement('style');
                        style.className = 'cgpa-hidden-style';
                        style.textContent = `
                            .user_heading_content .cgpa-line { display: none !important; }
                        `;
                        document.head.appendChild(style);
                    }

                    // Wrap the CGPA line in a span for hiding
                    const parent = node.parentElement;
                    if (parent && !parent.classList.contains('cgpa-line')) {
                        // Find the br before CGPA and the content after
                        const cgpaIndex = node.textContent.indexOf('CGPA:');
                        if (cgpaIndex !== -1) {
                            // Add class to parent or create wrapper
                            const wrapper = document.createElement('span');
                            wrapper.className = 'cgpa-line';

                            // Get the CGPA text and the span with value
                            const cgpaText = document.createTextNode(node.textContent.substring(cgpaIndex));
                            const nextSpan = parent.querySelector('span');

                            wrapper.appendChild(cgpaText);
                            if (nextSpan) {
                                wrapper.appendChild(nextSpan.cloneNode(true));
                                nextSpan.remove();
                            }

                            // Replace the text node
                            node.textContent = node.textContent.substring(0, cgpaIndex);
                            parent.appendChild(wrapper);
                        }
                    }

                    console.log('NUST Qalam Dashboard: CGPA hidden');
                }
            }
        } else {
            // Show CGPA by removing the hiding style
            const style = document.querySelector('.cgpa-hidden-style');
            if (style) {
                style.remove();
            }
            console.log('NUST Qalam Dashboard: CGPA shown');
        }
    }
}

function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            textNodes.push(node);
        }
    }

    return textNodes;
}
