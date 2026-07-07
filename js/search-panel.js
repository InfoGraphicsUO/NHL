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
        const isReferenceIdSearch = /\d/.test(searchInput?.value || ''); // check if the search is for a reference ID

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
            const name = document.createElement('span');
            name.textContent = feature.properties?.Historic_Name || 'Unknown Site';
            button.appendChild(name);

            const referenceId = feature.properties?.ReferenceID;
            if (isReferenceIdSearch && referenceId) {
                // if user is searching by ID, display reference ID in parenthesis
                const reference = document.createElement('span');
                reference.className = 'search-result-reference-id';
                reference.textContent = ` (${referenceId})`;
                button.appendChild(reference);
            }

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
        const hasNumber = /\d/.test(query);
        return features.filter(feature => featureMatchesSearchQuery(feature, query)).sort((a, b) => {
            if (!hasNumber) return 0;

            const aReferenceId = (a.properties?.ReferenceID || '').toString().toLowerCase();
            const bReferenceId = (b.properties?.ReferenceID || '').toString().toLowerCase();
            const aStartsWithQuery = aReferenceId.startsWith(query);
            const bStartsWithQuery = bReferenceId.startsWith(query);

            if (aStartsWithQuery === bStartsWithQuery) return 0;
            return aStartsWithQuery ? -1 : 1;
        });
    }

    function featureMatchesSearchQuery(feature, query) {
        const props = feature.properties || {};
        const searchableValues = [
            props.Historic_Name,
            props.ReferenceID,
            props.Other_Name_s_,
            props.Multiple_Name,
            props.City,
            props.County,
            props.State,
        ];

        return searchableValues.some(value =>
            String(value || '').toLowerCase().includes(query)
        );
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
