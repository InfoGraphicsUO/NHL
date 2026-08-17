(function() {
    const EMPTY_STORY = {
        title: 'Landmark title',
        location: 'City, State',
        excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum...',
        articleLabel: 'Read the full article',
        articleUrl: '#'
    };

    function setupLearnPanel() {
        if (window._nhlLearnPanelController) {
            return window._nhlLearnPanelController;
        }

        const title = document.getElementById('learn-panel-title');
        const location = document.getElementById('learn-story-location');
        const excerpt = document.getElementById('learn-story-excerpt');
        const articleLink = document.getElementById('learn-story-link');

        function showStory(story = EMPTY_STORY) {
            const nextStory = { ...EMPTY_STORY, ...story };
            if (title) title.textContent = nextStory.title;
            if (location) location.lastChild.textContent = ` ${nextStory.location}`;
            if (excerpt) excerpt.textContent = nextStory.excerpt;

            if (!articleLink) return;
            articleLink.href = nextStory.articleUrl || '#';
            articleLink.firstChild.textContent = `${nextStory.articleLabel || 'Read the full article'} `;
        }

        articleLink?.addEventListener('click', (event) => {
            if (articleLink.getAttribute('href') === '#') event.preventDefault();
        });

        const controller = {
            showStory,
            clearStory: () => showStory(EMPTY_STORY)
        };

        window._nhlLearnPanelController = controller;
        controller.clearStory();
        return controller;
    }

    window.setupLearnPanel = setupLearnPanel;
})();
