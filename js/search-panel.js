function setupSearchPanel(map, selectLandmark) {
    const searchInput = document.getElementById('monument-search');
    const searchResults = document.getElementById('search-results');
    const searchSubmit = document.getElementById('search-submit');

    let currentSearchMatches = [];
    let activeSearchIndex = 0;

    function clearSearchResults() {
        if (!searchResults) return;
        searchResults.innerHTML = '';
        searchResults.hidden = true;
        currentSearchMatches = [];
        activeSearchIndex = 0;
    }

    function setActiveSearchIndex(index) {
        // set active search index and update the search results
        activeSearchIndex = index;
        if (!searchResults) return;

        const rows = searchResults.querySelectorAll('.search-result-row');
        rows.forEach((row, i) => {
            row.classList.toggle('search-result-row-active', i === activeSearchIndex);
        });

        const activeRow = rows[activeSearchIndex];
        if (activeRow) {
            activeRow.scrollIntoView({ block: 'nearest' });
        }
    }

    function renderSearchResults(matches) {
        if (!searchResults) return;

        searchResults.innerHTML = '';
        searchResults.hidden = false;
        currentSearchMatches = matches;
        activeSearchIndex = 0;

        if (matches.length === 0) {
            // message when no results are found
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'search-empty';
            emptyMessage.textContent = 'No results found';
            searchResults.appendChild(emptyMessage);
            return;
        }

        matches.forEach((feature, index) => {
            // for each match, create a button
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-result-row';
            button.textContent = feature.properties?.Historic_Name || 'Unknown Site';
            button.addEventListener('mouseenter', () => {
                setActiveSearchIndex(index);
            });
            button.addEventListener('click', () => {
                selectLandmark(feature);
                clearSearchResults();
            });
            searchResults.appendChild(button);
        });

        setActiveSearchIndex(0);
    }

    function getSearchMatches() {
        // get the search matches from the landmark source data
        if (!searchInput) return [];

        const query = searchInput.value.trim().toLowerCase();
        if (!query) return [];

        const features = map._landmarkSourceData?.features || [];
        return features.filter(feature => {
            const name = feature.properties?.Historic_Name || '';
            return name.toLowerCase().includes(query);
        });
    }

    function submitSearch() {
        // when search is submitted with enter or button click, select the landmark
        if (currentSearchMatches.length === 0) return;

        const feature = currentSearchMatches[activeSearchIndex] ?? currentSearchMatches[0];
        selectLandmark(feature);
        clearSearchResults();
    }

    function updateSearchResults() {
        // update the search results when the search input is focused or inputted
        if (!searchInput || !searchResults) return;

        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            clearSearchResults();
            return;
        }

        renderSearchResults(getSearchMatches());
    }

    if (!searchInput || !searchResults || searchInput._landmarkSearchInitialized) {
        return;
    }

    searchInput._landmarkSearchInitialized = true;
    clearSearchResults();
    searchInput.addEventListener('focus', updateSearchResults);
    searchInput.addEventListener('input', updateSearchResults);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { // use enter to submit the search
            e.preventDefault();
            submitSearch();
            return;
        }

        if (e.key === 'Tab' && currentSearchMatches.length > 0 && !searchResults.hidden) {
            // use tab to navigate through the search results
            e.preventDefault();
            const nextIndex = e.shiftKey
                ? (activeSearchIndex - 1 + currentSearchMatches.length) % currentSearchMatches.length
                : (activeSearchIndex + 1) % currentSearchMatches.length;
            setActiveSearchIndex(nextIndex);
        }
    });
    searchResults.addEventListener('mouseleave', () => {
        if (currentSearchMatches.length > 0) {
            setActiveSearchIndex(0);
        }
    });
    if (searchSubmit) {
        searchSubmit.addEventListener('click', submitSearch);
    }
    updateSearchResults();
}
