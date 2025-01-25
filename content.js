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
        
        const result = await chrome.storage.sync.get('favorites');
        const favorites = result.favorites || {};
        return !!favorites[pageTitle];
    } catch (error) {
        console.error('Failed to check favorite status:', error);
        return false;
    }
}

// Add favorite button to the page
async function addFavoriteButton() {
    const url = window.location.href;
    const pageTitle = getPageTitleFromUrl(url);
    if (!pageTitle) return; // Don't add button if we can't parse the page title
    
    const isFavorited = await checkFavoriteStatus();
    
    // Create button
    const button = document.createElement('button');
    button.id = 'wikifaves-button';
    button.innerHTML = isFavorited ? '★ Favorited' : '☆ Add to Favorites';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 8px 16px;
        background-color: transparent;
        border: 2px solid #ffeb3b;
        border-radius: 4px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 0 5px black;
    `;

    // Add click handler
    button.addEventListener('click', async () => {
        try {
            const canonicalUrl = `https://en.wikipedia.org/wiki/${pageTitle}`;
            const displayTitle = document.getElementById('firstHeading')?.textContent?.replace(/\[edit\]/g, '') || pageTitle;
            const result = await chrome.storage.sync.get('favorites');
            const favorites = result.favorites || {};

            if (favorites[pageTitle]) {
                delete favorites[pageTitle];
                button.innerHTML = '☆ Add to Favorites';
                button.style.backgroundColor = 'transparent';
            } else {
                favorites[pageTitle] = {
                    url: canonicalUrl,
                    displayTitle,
                    dateAdded: new Date().toISOString()
                };
                button.innerHTML = '★ Favorited';
                button.style.backgroundColor = 'transparent';
            }

            await chrome.storage.sync.set({ favorites });
        } catch (error) {
            console.error('Failed to update favorites:', error);
        }

        await chrome.storage.sync.set({ favorites });
    });

    document.body.appendChild(button);
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFavoriteButton);
} else {
    addFavoriteButton();
} 