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
                const syncResult = await chrome.storage.sync.get('syncedFavorites');
                const syncedFavorites = syncResult.syncedFavorites || {};
                delete syncedFavorites[itemKey];
                await chrome.storage.sync.set({ syncedFavorites });
                
                await notifyContentScript('unfavorited', { pageTitle: itemKey });
            }
            
            displayFavorites();
            displayHistory();
            displayTrash();
        }
    } catch (error) {
        console.error('Failed to move item to trash:', error);
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
            
            source[itemKey] = itemData;
            delete trash[itemKey];
            
            await chrome.storage.local.set({
                [sourceType]: source,
                trash: trash
            });

            if (sourceType === 'favorites') {
                // Update synced favorites
                const syncResult = await chrome.storage.sync.get('syncedFavorites');
                const syncedFavorites = syncResult.syncedFavorites || {};
                syncedFavorites[itemKey] = {
                    dateAdded: itemData.dateAdded
                };
                await chrome.storage.sync.set({ syncedFavorites });
                
                await notifyContentScript('favorited', { pageTitle: itemKey });
            }
            
            displayFavorites();
            displayHistory();
            displayTrash();
        }
    } catch (error) {
        console.error('Failed to restore item from trash:', error);
    }
}

// Display favorites list
async function displayFavorites() {
    try {
        const result = await chrome.storage.local.get('favorites');
        const favorites = result.favorites || {};
        const listElement = document.getElementById('favorites-list');
        const sortMethod = document.getElementById('favorites-sort').value;
        
        listElement.innerHTML = '';
        
        if (Object.keys(favorites).length === 0) {
            listElement.innerHTML = '<p>No favorites yet!</p>';
            return;
        }

        let entries = Object.entries(favorites);
        
        // Apply sorting
        switch (sortMethod) {
            case 'alpha':
                entries.sort(sortByAlpha);
                break;
            case 'mostVisited':
                entries.sort(sortByMostVisited);
                break;
            case 'recentlyVisited':
                entries.sort(sortByRecentlyVisited);
                break;
            case 'dateAdded':
            default:
                entries.sort(sortByDateAdded);
        }

        entries.forEach(([pageTitle, data]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const link = document.createElement('a');
            link.href = data.url;
            link.textContent = data.displayTitle;
            link.target = '_blank';
            
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent = `Added: ${new Date(data.dateAdded).toLocaleDateString()}`;
            if (data.visitCount) {
                meta.textContent += ` • Visits: ${data.visitCount}`;
            }
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => moveToTrash(pageTitle, 'favorites');
            
            const linkContainer = document.createElement('div');
            linkContainer.appendChild(link);
            linkContainer.appendChild(meta);
            
            item.appendChild(linkContainer);
            item.appendChild(removeBtn);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load favorites:', error);
        document.getElementById('favorites-list').innerHTML = '<p>Error loading favorites</p>';
    }
}

// Display history list
async function displayHistory() {
    try {
        const result = await chrome.storage.local.get('history');
        const history = result.history || {};
        const listElement = document.getElementById('history-list');
        const sortMethod = document.getElementById('history-sort').value;
        
        listElement.innerHTML = '';
        
        if (Object.keys(history).length === 0) {
            listElement.innerHTML = '<p>No history yet!</p>';
            return;
        }

        let entries = Object.entries(history);
        
        // Apply sorting
        switch (sortMethod) {
            case 'alpha':
                entries.sort(sortByAlpha);
                break;
            case 'mostVisited':
                entries.sort(sortByMostVisited);
                break;
            case 'firstVisited':
                entries.sort(sortByFirstVisited);
                break;
            case 'recentlyVisited':
            default:
                entries.sort(sortByRecentlyVisited);
        }

        entries.forEach(([pageTitle, data]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const link = document.createElement('a');
            link.href = data.url;
            link.textContent = data.displayTitle;
            link.target = '_blank';
            
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.innerHTML = `Visits: ${data.visitCount}`;
            meta.innerHTML += ` &middot; First visit: ${new Date(data.firstVisit).toLocaleDateString()}`;
            meta.innerHTML += ` &middot; Last visit: ${new Date(data.lastVisit).toLocaleDateString()}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => moveToTrash(pageTitle, 'history');
            
            const linkContainer = document.createElement('div');
            linkContainer.appendChild(link);
            linkContainer.appendChild(meta);
            
            item.appendChild(linkContainer);
            item.appendChild(removeBtn);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load history:', error);
        document.getElementById('history-list').innerHTML = '<p>Error loading history</p>';
    }
}

// Display trash list
async function displayTrash() {
    try {
        const result = await chrome.storage.local.get('trash');
        const trash = result.trash || {};
        const listElement = document.getElementById('trash-list');
        
        listElement.innerHTML = '';
        
        if (Object.keys(trash).length === 0) {
            listElement.innerHTML = '<p style="color: #888;">Trash is empty</p>';
            return;
        }

        let entries = Object.entries(trash);
        entries.sort((a, b) => new Date(b[1].trashDate) - new Date(a[1].trashDate));

        entries.forEach(([pageTitle, data]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const link = document.createElement('a');
            link.href = data.url;
            link.textContent = data.displayTitle;
            link.target = '_blank';
            
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.innerHTML = `<span class="trash-meta">From ${data.sourceType}</span> &middot; Deleted: ${new Date(data.trashDate).toLocaleDateString()}`;
            
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'restore-btn';
            restoreBtn.innerHTML = '&#x21BA;';
            restoreBtn.onclick = () => restoreFromTrash(pageTitle);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = async () => {
                delete trash[pageTitle];
                await chrome.storage.local.set({ trash });
                displayTrash();
            };
            
            const linkContainer = document.createElement('div');
            linkContainer.appendChild(link);
            linkContainer.appendChild(meta);
            
            const buttonContainer = document.createElement('div');
            buttonContainer.appendChild(restoreBtn);
            buttonContainer.appendChild(removeBtn);
            
            item.appendChild(linkContainer);
            item.appendChild(buttonContainer);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load trash:', error);
        document.getElementById('trash-list').innerHTML = '<p>Error loading trash</p>';
    }
}

// Export data
async function exportData() {
    try {
        const result = await chrome.storage.local.get(['favorites', 'history']);
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

async function debug() {
    const result = await chrome.storage.local.get('favorites');
    console.log(result);
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    displayFavorites();
    displayHistory();
    displayTrash();
    
    // Initialize theme
    initTheme();
    document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
    
    // Setup sort change handlers
    document.getElementById('favorites-sort').addEventListener('change', displayFavorites);
    document.getElementById('history-sort').addEventListener('change', displayHistory);
    
    // Setup export button
    document.getElementById('export-btn').addEventListener('click', exportData);
});
