// fields searched by the results-panel search box
const RESULTS_SEARCH_FIELDS = [
    'Historic_Name',
    'ReferenceID',
    'City',
    'State'
];

// fields searched by the best match algorithm
const BEST_MATCH_SEARCH_FIELDS = [
    'Historic_Name',
    'Other_Name_s_',
    'Multiple_Name',
    'ReferenceID',
    'City',
    'County',
    'State'
];

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// case-insensitive substring match across name, reference, city, state abbr, and full state name
function featureMatchesResultsQuery(feature, query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return true;
    const props = feature.properties || {};
    if (RESULTS_SEARCH_FIELDS.some(field => String(props[field] || '').toLowerCase().includes(normalized))) {
        return true;
    }
    return stateDisplayName(props.State).toLowerCase().includes(normalized);
}

// wraps every case-insensitive match of query in a highlight mark
function appendHighlightedText(container, text, query) {
    const value = String(text || '');
    const normalized = String(query || '').trim();
    if (!normalized || !value) {
        container.appendChild(document.createTextNode(value));
        return;
    }

    const pattern = new RegExp(escapeRegExp(normalized), 'gi');
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(value)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
        }
        const mark = document.createElement('mark');
        mark.className = 'result-search-highlight';
        mark.textContent = match[0];
        container.appendChild(mark);
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) pattern.lastIndex += 1;
    }
    if (lastIndex < value.length) {
        container.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
}

// builds "City, ST" with live search highlights; full state-name matches highlight the abbreviation
function appendHighlightedLocation(container, props, query) {
    const city = String(props.City || '').trim();
    const state = String(props.State || '').trim();
    if (!city && !state) {
        container.appendChild(document.createTextNode('Location unavailable'));
        return;
    }

    const normalized = String(query || '').trim().toLowerCase();
    if (city) appendHighlightedText(container, city, query);
    if (city && state) container.appendChild(document.createTextNode(', '));
    if (!state) return;

    const abbrMatches = normalized && state.toLowerCase().includes(normalized);
    const nameMatches = normalized && stateDisplayName(state).toLowerCase().includes(normalized);
    if (abbrMatches) {
        appendHighlightedText(container, state, query);
    } else if (nameMatches) {
        const mark = document.createElement('mark');
        mark.className = 'result-search-highlight';
        mark.textContent = state;
        container.appendChild(mark);
    } else {
        container.appendChild(document.createTextNode(state));
    }
}

function featureTieBreak(a, b) {
    return comparePresentText(a.properties?.Historic_Name, b.properties?.Historic_Name)
        || compareReferenceIds(a.properties?.ReferenceID, b.properties?.ReferenceID)
        || COLLATOR.compare(String(a.id ?? ''), String(b.id ?? ''));
}

function textMatchScore(feature, query, fields) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return { strength: 0, priority: 0 };
    const props = feature.properties || {};
    let bestStrength = 0;
    let bestPriority = 0;
    fields.forEach((field, index) => {
        const values = [String(props[field] || '').trim().toLowerCase()];
        if (field === 'State') values.push(stateDisplayName(props.State).toLowerCase());
        values.forEach(value => {
            if (!value.includes(needle)) return;
            const strength = value === needle ? 3 : value.startsWith(needle) ? 2 : 1;
            // earlier fields have higher priority, with primary name always first
            const priority = fields.length - index;
            if (strength > bestStrength || (strength === bestStrength && priority > bestPriority)) {
                bestStrength = strength;
                bestPriority = priority;
            }
        });
    });
    return { strength: bestStrength, priority: bestPriority };
}

function selectedGroupMatchCount(props, selected, fields) {
    if (!Array.isArray(selected) || selected.length === fields.length + 1) return 0;
    const hasCategory = fields.some(field => props[field] === '1');
    return selected.reduce((count, field) => (
        count + (field === 'None' ? Number(!hasCategory) : Number(props[field] === '1'))
    ), 0);
}

function bestMatchScore(feature, appliedState, resultsQuery) {
    const appliedText = textMatchScore(feature, appliedState?.search, BEST_MATCH_SEARCH_FIELDS);
    const resultsText = textMatchScore(feature, resultsQuery, RESULTS_SEARCH_FIELDS);
    const cityText = textMatchScore(feature, appliedState?.city, ['City']);
    const countyText = textMatchScore(feature, appliedState?.county, ['County']);
    const props = feature.properties || {};
    return {
        strength: appliedText.strength + resultsText.strength + cityText.strength + countyText.strength,
        priority: appliedText.priority + resultsText.priority + cityText.priority + countyText.priority,
        categories: selectedGroupMatchCount(props, appliedState?.modes, MODE_FIELDS)
            + selectedGroupMatchCount(props, appliedState?.supremacy, SUPREMACY_FIELDS)
    };
}

// sorts a copy so rendering can change order without mutating the controller's applied result set
function sortFeatures(features, sortValue = 'best-match', appliedState = null, resultsQuery = '') {
    return features.slice().sort((a, b) => {
        const left = a.properties || {};
        const right = b.properties || {};
        if (sortValue === 'name') {
            return comparePresentText(left.Historic_Name, right.Historic_Name)
                || comparePresentText(stateDisplayName(left.State), stateDisplayName(right.State))
                || comparePresentText(left.City, right.City)
                || compareReferenceIds(left.ReferenceID, right.ReferenceID)
                || COLLATOR.compare(String(a.id ?? ''), String(b.id ?? ''));
        }
        if (sortValue === 'state') {
            return comparePresentText(stateDisplayName(left.State), stateDisplayName(right.State))
                || comparePresentText(left.City, right.City)
                || featureTieBreak(a, b);
        }
        if (sortValue === 'city') {
            return comparePresentText(left.City, right.City)
                || comparePresentText(stateDisplayName(left.State), stateDisplayName(right.State))
                || featureTieBreak(a, b);
        }
        if (sortValue === 'id') {
            return compareReferenceIds(left.ReferenceID, right.ReferenceID)
                || featureTieBreak(a, b);
        }

        const leftScore = bestMatchScore(a, appliedState, resultsQuery);
        const rightScore = bestMatchScore(b, appliedState, resultsQuery);
        return rightScore.strength - leftScore.strength
            || rightScore.priority - leftScore.priority
            || rightScore.categories - leftScore.categories
            || featureTieBreak(a, b);
    });
}
