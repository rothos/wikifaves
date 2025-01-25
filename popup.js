// Dark mode handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggle(newTheme);
}

function updateThemeToggle(theme) {
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
        toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        });
    });
}

// Sorting functions
function sortByAlpha(a, b) {
    return a[1].displayTitle.localeCompare(b[1].displayTitle);
}

function sortByMostVisited(a, b) {
    const aVisits = a[1].visitCount || 0;
    const bVisits = b[1].visitCount || 0;
    return bVisits - aVisits;
}

function sortByDateAdded(a, b) {
    return new Date(b[1].dateAdded) - new Date(a[1].dateAdded);
}

function sortByFirstVisited(a, b) {
    return new Date(a[1].firstVisit) - new Date(b[1].firstVisit);
}

function sortByRecentlyVisited(a, b) {
    return new Date(b[1].lastVisit) - new Date(a[1].lastVisit);
}

// Notify content script of changes
async function notifyContentScript(action, data) {
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: action,
                data: data
            });
        }
    } catch (error) {
        console.error('Failed to notify content script:', error);
    }
}

// Move item to trash
async function moveToTrash(itemKey, sourceType) {
    try {
        const result = await chrome.storage.local.get(['favorites', 'history', 'trash']);
        const trash = result.trash || {};
        const source = result[sourceType] || {};
        
        if (source[itemKey]) {
            trash[itemKey] = {
                ...source[itemKey],
                sourceType,
                trashDate: new Date().toISOString()
            };
            delete source[itemKey];
            
            await chrome.storage.local.set({ 
                [sourceType]: source,
                trash: trash
            });

            if (sourceType === 'favorites') {
                // Update synced favorites
                await chrome.storage.sync.set({ favorites: source });
                
                await notifyContentScript('unfavorited', { pageTitle: itemKey });
            }
            
            displayList('favorites');
            displayList('history');
            displayList('trash');
        }
    } catch (error) {
        console.error('Failed to move item to trash:', error);
    }
}

async function deleteFromTrash(itemKey) {
    try {
        const result = await chrome.storage.local.get('trash');
        const trash = result.trash || {};
        delete trash[itemKey];
        await chrome.storage.local.set({ trash });
        displayList('trash');
    } catch (error) {
        console.error('Failed to delete item from trash:', error);
    }
}

// Restore from trash
async function restoreFromTrash(itemKey) {
    try {
        const result = await chrome.storage.local.get(['favorites', 'history', 'trash']);
        const trash = result.trash || {};
        
        if (trash[itemKey]) {
            const sourceType = trash[itemKey].sourceType;
            const source = result[sourceType] || {};
            
            const itemData = { ...trash[itemKey] };
            delete itemData.sourceType;
            delete itemData.trashDate;

            // Check if the item already exists in the source
            if (source[itemKey]) {
                // Update existing entry for favorites
                if (sourceType === 'favorites') {
                    source[itemKey].dateAdded = new Date(Math.min(new Date(source[itemKey].dateAdded), new Date(itemData.dateAdded))).toISOString();
                }
                // Update existing entry for history
                else if (sourceType === 'history') {
                    source[itemKey].visitCount = (source[itemKey].visitCount || 0) + (itemData.visitCount || 0);
                    source[itemKey].visits = [...(source[itemKey].visits || []), ...(itemData.visits || [])];
                    source[itemKey].firstVisit = new Date(Math.min(new Date(source[itemKey].firstVisit), new Date(itemData.firstVisit))).toISOString();
                    source[itemKey].lastVisit = new Date(Math.max(new Date(source[itemKey].lastVisit), new Date(itemData.lastVisit))).toISOString();
                }
            } else {
                // If it doesn't exist, simply add it
                source[itemKey] = itemData;
            }

            delete trash[itemKey];
            
            await chrome.storage.local.set({
                [sourceType]: source,
                trash: trash
            });

            if (sourceType === 'favorites') {
                // Update synced favorites
                await chrome.storage.sync.set({ favorites: source });
                
                await notifyContentScript('favorited', { pageTitle: itemKey });
            }
            
            displayList('favorites');
            displayList('history');
            displayList('trash');
        }
    } catch (error) {
        console.error('Failed to restore item from trash:', error);
    }
}

// Common display function for lists
async function displayList(type, customSort = null) {
    try {
        const result = await chrome.storage.local.get(type);
        const items = result[type] || {};
        const listElement = document.getElementById(`${type}-list`);
        const sortMethod = type !== 'trash' ? document.getElementById(`${type}-sort`).value : 'default';
        
        listElement.innerHTML = '';
        
        if (Object.keys(items).length === 0) {
            listElement.innerHTML = `<p class="empty-message">No ${type} yet!</p>`;
            return;
        }

        let entries = Object.entries(items);
        
        // Apply sorting
        entries = sortEntries(entries, type, customSort, sortMethod);

        entries.forEach(([pageTitle, data]) => {
            const item = createItemElement(pageTitle, data, type);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error(`Failed to load ${type}:`, error);
        document.getElementById(`${type}-list`).innerHTML = `<p>Error loading ${type}</p>`;
    }
}

function createItemElement(pageTitle, data, type) {
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';
    const linkWrapper = document.createElement('a');
    linkWrapper.href = data.url;
    linkWrapper.target = '_blank';
    linkWrapper.className = 'link-wrapper';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = data.displayTitle;
    titleSpan.className = 'title';
    
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = getMetaContent(data, type);
    
    contentContainer.appendChild(titleSpan);
    contentContainer.appendChild(meta);
    linkWrapper.appendChild(contentContainer);
    item.appendChild(linkWrapper);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    if (type === 'favorites' || type === 'history') {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            moveToTrash(pageTitle, type);
        };
        buttonContainer.appendChild(removeBtn);
    } else {
        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-btn';
        restoreBtn.innerHTML = '&#x21BA;';
        restoreBtn.onclick = () => restoreFromTrash(pageTitle);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = async () => {
            await deleteFromTrash(pageTitle);
        };
        
        buttonContainer.appendChild(restoreBtn);
        buttonContainer.appendChild(removeBtn);
    }

    item.appendChild(buttonContainer);
    
    return item;
}

function getMetaContent(data, type) {
    switch (type) {
        case 'favorites':
            return `Added: ${new Date(data.dateAdded).toLocaleDateString()}${data.visitCount ? ` • Visits: ${data.visitCount}` : ''}`;
        case 'history':
            return `Visits: ${data.visitCount} &middot; First visit: ${new Date(data.firstVisit).toLocaleDateString()} &middot; Last visit: ${new Date(data.lastVisit).toLocaleDateString()}`;
        case 'trash':
            return `<span class="trash-meta">From ${data.sourceType}</span> &middot; Deleted: ${new Date(data.trashDate).toLocaleDateString()}`;
        default:
            return '';
    }
}

function sortEntries(entries, type, customSort, sortMethod) {
    if (customSort) {
        return entries.sort(customSort);
    } else if (type !== 'trash') {
        switch (sortMethod) {
            case 'alpha':
                return entries.sort(sortByAlpha);
            case 'mostVisited':
                return entries.sort(sortByMostVisited);
            case 'recentlyVisited':
                return entries.sort(sortByRecentlyVisited);
            case 'firstVisited':
                return entries.sort(sortByFirstVisited);
            case 'dateAdded':
                return entries.sort(sortByDateAdded);
            default:
                return entries;
        }
    } else {
        // Default trash sorting by trash date
        return entries.sort((a, b) => new Date(b[1].trashDate) - new Date(a[1].trashDate));
    }
}

// Wrapper functions to maintain existing API
async function displayFavorites() {
    await displayList('favorites');
}

async function displayHistory() {
    await displayList('history');
}

async function displayTrash() {
    await displayList('trash');
}

// Export data
async function exportData() {
    try {
        const result = await chrome.storage.local.get(['favorites', 'history', 'trash']);
        const data = {
            favorites: result.favorites || {},
            history: result.history || {},
            trash: result.trash || {},
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wikifaves.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export data:', error);
        alert('Failed to export data: ' + error.message);
    }
}

// Import data
async function importData(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const result = await chrome.storage.local.get(['favorites', 'history', 'trash']);
            const favorites = { ...result.favorites };
            const history = { ...result.history };
            const trash = { ...result.trash };

            // Update favorites
            for (const [key, value] of Object.entries(data.favorites || {})) {
                if (favorites[key]) {
                    favorites[key].dateAdded = new Date(Math.min(new Date(favorites[key].dateAdded), new Date(value.dateAdded))).toISOString();
                } else {
                    favorites[key] = value;
                }
            }

            // Update history
            for (const [key, value] of Object.entries(data.history || {})) {
                if (history[key]) {
                    history[key].visitCount = (history[key].visitCount || 0) + (value.visitCount || 0);
                    history[key].visits = [...(history[key].visits || []), ...(value.visits || [])];
                    history[key].firstVisit = new Date(Math.min(new Date(history[key].firstVisit), new Date(value.firstVisit))).toISOString();
                    history[key].lastVisit = new Date(Math.max(new Date(history[key].lastVisit), new Date(value.lastVisit))).toISOString();
                } else {
                    history[key] = value;
                }
            }

            // Update trash
            for (const [key, value] of Object.entries(data.trash || {})) {
                trash[key] = value;
            }

            await chrome.storage.local.set({ favorites, history, trash });
            displayList('favorites');
            displayList('history');
            displayList('trash');
            alert('Data imported successfully!');
        } catch (error) {
            console.error('Failed to import data:', error);
            alert('Failed to import data: ' + error.message);
        }
    };
    reader.readAsText(file);
}

async function debug() {
    const result = await chrome.storage.local.get('favorites');
    console.log(result);
}

// Save sort settings
function saveSortSettings() {
    const favoritesSort = document.getElementById('favorites-sort').value;
    const historySort = document.getElementById('history-sort').value;
    localStorage.setItem('favorites-sort', favoritesSort);
    localStorage.setItem('history-sort', historySort);
}

// Load sort settings
function loadSortSettings() {
    const favoritesSort = localStorage.getItem('favorites-sort') || 'dateAdded';
    const historySort = localStorage.getItem('history-sort') || 'recentlyVisited';
    
    document.getElementById('favorites-sort').value = favoritesSort;
    document.getElementById('history-sort').value = historySort;
}

// Delete all data functionality
function setupDeleteAllData() {
    const deleteBtn = document.getElementById('delete-all-btn');
    const confirmation = document.getElementById('delete-confirmation');
    const input = document.getElementById('delete-confirmation-input');
    const confirmBtn = document.getElementById('delete-confirm-btn');

    deleteBtn.addEventListener('click', () => {
        confirmation.classList.add('visible');
    });

    input.addEventListener('input', () => {
        confirmBtn.disabled = input.value !== 'wikifaves';
    });

    confirmBtn.addEventListener('click', async () => {
        if (input.value === 'wikifaves') {
            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();
            
            // Reset UI
            displayList('favorites');
            displayList('history');
            displayList('trash');
            
            // Hide confirmation
            confirmation.classList.remove('visible');
            input.value = '';
            confirmBtn.disabled = true;
        }
    });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadSortSettings();
    displayList('favorites');
    displayList('history');
    displayList('trash');
    setupDeleteAllData();
    
    // Initialize theme
    initTheme();
    document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
    
    // Setup sort change handlers
    document.getElementById('favorites-sort').addEventListener('change', () => {
        displayList('favorites');
        saveSortSettings();
    });
    document.getElementById('history-sort').addEventListener('change', () => {
        displayList('history');
        saveSortSettings();
    });
    
    // Setup export button
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // Setup import button
    document.getElementById('import-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = importData;
        input.click();
    });
});
