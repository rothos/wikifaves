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

// Display favorites list
async function displayFavorites() {
    try {
        const result = await chrome.storage.sync.get('favorites');
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
            removeBtn.onclick = async () => {
                delete favorites[pageTitle];
                await chrome.storage.sync.set({ favorites });
                displayFavorites();
            };
            
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
        const result = await chrome.storage.sync.get('history');
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
            meta.textContent = `Visits: ${data.visitCount}`;
            meta.textContent += ` &middot; First visit: ${new Date(data.firstVisit).toLocaleDateString()}`;
            meta.textContent += ` &middot; Last visit: ${new Date(data.lastVisit).toLocaleDateString()}`;
            
            const linkContainer = document.createElement('div');
            linkContainer.appendChild(link);
            linkContainer.appendChild(meta);
            
            item.appendChild(linkContainer);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load history:', error);
        document.getElementById('history-list').innerHTML = '<p>Error loading history</p>';
    }
}

// Export data
async function exportData() {
    try {
        const result = await chrome.storage.sync.get(['favorites', 'history']);
        const data = {
            favorites: result.favorites || {},
            history: result.history || {},
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
        alert('Failed to export data');
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    displayFavorites();
    displayHistory();
    
    // Setup sort change handlers
    document.getElementById('favorites-sort').addEventListener('change', displayFavorites);
    document.getElementById('history-sort').addEventListener('change', displayHistory);
    
    // Setup export button
    document.getElementById('export-btn').addEventListener('click', exportData);
});
