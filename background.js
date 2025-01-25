// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'wikifaves-toggle',
        title: 'Add to WikiFaves',
        contexts: ['page'],
        documentUrlPatterns: ['https://*.wikipedia.org/*']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'wikifaves-toggle') {
        chrome.tabs.sendMessage(tab.id, { action: 'toggleFavorite' });
    }
});

// Update context menu based on favorite status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateContextMenu') {
        chrome.contextMenus.update('wikifaves-toggle', {
            title: message.isFavorited ? 'Remove from WikiFaves' : 'Add to WikiFaves'
        });
    }
});