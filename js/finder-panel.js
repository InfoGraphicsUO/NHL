(function() {
    // temporary demo roster until researched spotlight records are connected
    const INITIAL_FEATURED_SPOTLIGHTS = [
        'Featured Spotlight 1',
        'Featured Spotlight 2',
        'Featured Spotlight 3',
    ];

    function setupFinderPanel() {
        if (window._nhlFinderPanelController) {
            return window._nhlFinderPanelController;
        }

        const list = document.getElementById('featured-spotlight-list');
        let featuredSpotlights = INITIAL_FEATURED_SPOTLIGHTS.slice();

        function renderFeaturedSpotlights() {
            if (!list) return;

            const fragment = document.createDocumentFragment();
            featuredSpotlights.forEach(title => {
                const item = document.createElement('li');
                item.className = 'featured-spotlight-item';
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'featured-spotlight-card';
                card.disabled = true;
                card.textContent = title;
                item.appendChild(card);
                fragment.appendChild(item);
            });
            list.replaceChildren(fragment);
        }

        const controller = {
            getFeaturedSpotlights: () => featuredSpotlights.slice(),
            setFeaturedSpotlights(titles) {
                featuredSpotlights = Array.isArray(titles)
                    ? titles.filter(Boolean).map(String).slice(0, 3)
                    : [];
                renderFeaturedSpotlights();
            }
        };

        window._nhlFinderPanelController = controller;
        renderFeaturedSpotlights();
        return controller;
    }

    window.setupFinderPanel = setupFinderPanel;
})();
