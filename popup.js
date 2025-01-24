// Display favorites list
async function displayFavorites() {
    const result = await chrome.storage.sync.get('favorites');
    const favorites = result.favorites || {};
    const listElement = document.getElementById('favorites-list');
    
    listElement.innerHTML = '';
    
    if (Object.keys(favorites).length === 0) {
        listElement.innerHTML = '<p>No favorites yet!</p>';
        return;
    }

    Object.entries(favorites)
        .sort((a, b) => new Date(b[1].dateAdded) - new Date(a[1].dateAdded))
        .forEach(([pageTitle, data]) => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            
            const link = document.createElement('a');
            link.href = data.url;
            link.textContent = data.displayTitle;
            link.target = '_blank';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = async () => {
                delete favorites[pageTitle];
                await chrome.storage.sync.set({ favorites });
                displayFavorites();
            };
            
            item.appendChild(link);
            item.appendChild(removeBtn);
            listElement.appendChild(item);
        });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', displayFavorites); 
