const WIKIFAVES_CONFIG = {
    colors: {
        starColor: '#FDD835'  // Yellow color
    },
    storage: {
        syncKeys: ['syncedFavorites'],  // Keys that should be synced
        version: '1.0'  // Used for migrations
    }
};

if (typeof module !== 'undefined') {
    module.exports = WIKIFAVES_CONFIG;
}