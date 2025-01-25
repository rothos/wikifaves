// Parse Wikipedia URL to get page title
function getPageTitleFromUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.endsWith('wikipedia.org')) {
            // Handle /wiki/ style URLs
            if (urlObj.pathname.startsWith('/wiki/')) {
                return decodeURIComponent(urlObj.pathname.slice(6));
            }
            // Handle index.php?title= style URLs
            if (urlObj.pathname.includes('index.php')) {
                return urlObj.searchParams.get('title');
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Check if current page is already favorited
async function checkFavoriteStatus() {
    try {
        const url = window.location.href;
        const pageTitle = getPageTitleFromUrl(url);
        if (!pageTitle) return false;
        
        const result = await chrome.storage.local.get('favorites');
        const favorites = result.favorites || {};
        const isFavorited = !!favorites[pageTitle];

        // Update context menu
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            isFavorited
        });

        return isFavorited;
    } catch (error) {
        console.error('Failed to check favorite status:', error);
        return false;
    }
}

// Track page visit in history
async function trackPageVisit() {
    try {
        const url = window.location.href;
        const pageTitle = getPageTitleFromUrl(url);
        if (!pageTitle) return;

        const displayTitle = document.getElementById('firstHeading')?.textContent?.replace(/\[edit\]/g, '') || pageTitle;
        const canonicalUrl = `https://en.wikipedia.org/wiki/${pageTitle}`;
        const visitTime = new Date().toISOString();

        // Get existing history
        const result = await chrome.storage.local.get('history');
        const history = result.history || {};

        // Check if this is a page reload
        const performance = window.performance;
        const navigationEntries = performance.getEntriesByType('navigation');
        const isReload = navigationEntries.length > 0 && navigationEntries[0].type === 'reload';
        
        if (!isReload || !history[pageTitle]) {
            if (!history[pageTitle]) {
                history[pageTitle] = {
                    url: canonicalUrl,
                    displayTitle,
                    visitCount: 1,
                    firstVisit: visitTime,
                    lastVisit: visitTime,
                    visits: [visitTime]
                };
            } else {
                history[pageTitle].visitCount++;
                history[pageTitle].lastVisit = visitTime;
                history[pageTitle].visits.push(visitTime);
                // Keep only last 100 visits to prevent storage limits
                if (history[pageTitle].visits.length > 100) {
                    history[pageTitle].visits = history[pageTitle].visits.slice(-100);
                }
            }

            await chrome.storage.local.set({ history });
        }
    } catch (error) {
        console.error('Failed to track page visit:', error);
    }
}

// Toggle favorite status
async function toggleFavorite() {
    try {
        const url = window.location.href;
        const pageTitle = getPageTitleFromUrl(url);
        if (!pageTitle) return;

        const canonicalUrl = `https://en.wikipedia.org/wiki/${pageTitle}`;
        const displayTitle = document.getElementById('firstHeading')?.textContent?.replace(/\[edit\]/g, '') || pageTitle;
        
        const result = await chrome.storage.local.get('favorites');
        const favorites = result.favorites || {};

        if (favorites[pageTitle]) {
            delete favorites[pageTitle];
            updateFavoriteButton(false);
        } else {
            const dateAdded = new Date().toISOString();
            favorites[pageTitle] = {
                url: canonicalUrl,
                displayTitle,
                dateAdded
            };
            updateFavoriteButton(true);
        }

        await Promise.all([
            chrome.storage.local.set({ favorites }),
            chrome.storage.sync.set({ favorites })
        ]);

        // Update context menu
        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            isFavorited: !!favorites[pageTitle]
        });
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
    }
}

// Add favorite button to the page
async function addFavoriteButton() {
    const url = window.location.href;
    const pageTitle = getPageTitleFromUrl(url);
    if (!pageTitle) return;
    
    const isFavorited = await checkFavoriteStatus();

    // Get body background color
    const getBodyBgColor = () => window.getComputedStyle(document.body).backgroundColor;

    // Get initial body background color
    let bodyBgColor = getBodyBgColor();
    
    // Create button
    const button = document.createElement('button');
    button.id = 'wikifaves-button';
    updateFavoriteButton(isFavorited, button);
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 8px 16px;
        background-color: ${bodyBgColor};
        border: 2px solid ${WIKIFAVES_CONFIG.colors.starColor};
        border-radius: 4px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 0 5px black;
    `;

    // Add click handler
    button.addEventListener('click', toggleFavorite);
    document.body.appendChild(button);
    
    // Update background color every 100ms for 1000ms (10 times)
    let updateCount = 0;
    const updateInterval = setInterval(() => {
        if (updateCount < 10) {
            bodyBgColor = getBodyBgColor();
            button.style.backgroundColor = bodyBgColor;
            updateCount++;
        } else {
            clearInterval(updateInterval);
        }
    }, 100); // Update every 100ms

    // Monitor changes to the body background color
    const observer = new MutationObserver(() => {
        const newBgColor = getBodyBgColor();
        if (newBgColor !== bodyBgColor) {
            bodyBgColor = newBgColor;
            button.style.backgroundColor = bodyBgColor;
        }
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
}

// Update favorite button appearance
function updateFavoriteButton(isFavorited, button = document.getElementById('wikifaves-button')) {
    if (button) {
        button.innerHTML = isFavorited ? '★ Favorited' : '☆ Add to Favorites';
    }
}

// Add message listener for popup updates and context menu
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const pageTitle = getPageTitleFromUrl(window.location.href);
    if (!pageTitle) return;

    if (message.action === 'unfavorited' && message.data.pageTitle === pageTitle) {
        updateFavoriteButton(false);
    } else if (message.action === 'favorited' && message.data.pageTitle === pageTitle) {
        updateFavoriteButton(true);
    } else if (message.action === 'toggleFavorite') {
        toggleFavorite();
    }
});

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        addFavoriteButton();
        trackPageVisit();
    });
} else {
    addFavoriteButton();
    trackPageVisit();
} 