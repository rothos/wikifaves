const WIKIFAVES_CONFIG = {
    colors: {
        starColor: '#FFD700'  // Gold color for the "favorite" button
    },
    syncKeys: ['favorites'],  // Keys that should be synced
    version: '1.0.0'
};

if (typeof module !== 'undefined') {
    module.exports = WIKIFAVES_CONFIG;
}