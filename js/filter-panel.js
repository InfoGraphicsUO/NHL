(function() {
    'use strict';

    const MODE_FIELDS = ['Acknowledged', 'Multiculturalism', 'Valorization', 'Erasure'];
    const SUPREMACY_FIELDS = [
        'Colonization',
        'Nation_Building',
        'Settler_Colonization',
        'Slavery',
        'State_Formation',
        'Racial_Capitalism'
    ];
    const SEARCH_FIELDS = [
        'Historic_Name',
        'ReferenceID',
        'Other_Name_s_',
        'Multiple_Name',
        'City',
        'County',
        'State'
    ];
    const SELECT_FIELDS = {
        state: { property: 'State', ids: ['place-state', 'state-filter', 'filter-state'] },
        office: { property: 'NHL Office', ids: ['nhl-office', 'nhl-office-filter', 'filter-nhl-office'] },
        nationalPark: { property: 'National_Park', ids: ['national-park', 'national-park-filter', 'filter-national-park'] },
        federalAgency: { property: 'Federal_Agency', ids: ['federal-agency', 'federal-agency-filter', 'filter-federal-agency'] },
        primaryForm: { property: 'Primary Form', ids: ['primary-form', 'primary-form-filter', 'filter-primary-form'] },
        requestType: { property: 'Request_Type', ids: ['request-type', 'request-type-filter', 'filter-request-type'] }
    };
    const COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

    function byId(...ids) {
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) return element;
        }
        return null;
    }

    function fieldControl(key, aliases = []) {
        return document.querySelector(`[data-filter-field="${key}"]`) || byId(...aliases);
    }

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function validWebPdf(value) {
        try {
            const url = new URL(String(value || '').trim());
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function exactValue(value) {
        const normalized = String(value || '').trim();
        return normalized === 'Any' ? '' : normalized;
    }

    function displayValue(value) {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = value;
        return decoder.value;
    }

    function selectedCheckboxValues(selector, defaults) {
        const boxes = Array.from(document.querySelectorAll(selector));
        return boxes.length ? boxes.filter(box => box.checked).map(box => box.value) : defaults.slice();
    }

    function groupMatches(props, selected, fields) {
        if (selected.length === fields.length + 1 && selected.includes('None')) return true;
        if (selected.length === 0) return false;
        const hasCategory = fields.some(field => props[field] === '1');
        return selected.some(field => field === 'None' ? !hasCategory : props[field] === '1');
    }

    function featureMatchesAppliedFilters(feature, state) {
        const props = feature?.properties || {};
        const query = state.search.trim().toLowerCase();
        if (query && !SEARCH_FIELDS.some(field => String(props[field] || '').toLowerCase().includes(query))) return false;
        if (!groupMatches(props, state.modes, MODE_FIELDS)) return false;
        if (!groupMatches(props, state.supremacy, SUPREMACY_FIELDS)) return false;

        for (const [key, config] of Object.entries(SELECT_FIELDS)) {
            if (state[key] && String(props[config.property] || '').trim() !== state[key]) return false;
        }
        if (state.city && !String(props.City || '').toLowerCase().includes(state.city.toLowerCase())) return false;
        if (state.county && !String(props.County || '').toLowerCase().includes(state.county.toLowerCase())) return false;
        if (state.hideRestricted && props.Restricted === '1') return false;
        if (state.hasWebPdf && !validWebPdf(props['Web PDF'])) return false;

        for (const [key, field] of Object.entries(YEAR_FIELD_OPTIONS)) {
            const [minimum, maximum] = state.years[key];
            if (minimum === field.min && maximum === field.max) continue;
            if (field.excludeMultiple && props[field.property] === 'Multiple') return false;
            const year = Number(props[field.property]);
            if (!Number.isFinite(year) || year < minimum || year > maximum) return false;
        }
        return true;
    }

    function sortFeatures(features) {
        return features.slice().sort((a, b) => {
            const nameOrder = COLLATOR.compare(a.properties?.Historic_Name || '', b.properties?.Historic_Name || '');
            return nameOrder || COLLATOR.compare(a.properties?.ReferenceID || '', b.properties?.ReferenceID || '');
        });
    }

    function setupFilterPanel(options = {}) {
        if (window._nhlFilterPanelController) return window._nhlFilterPanelController;
        const map = options.map;
        if (!map) throw new Error('setupFilterPanel requires a map instance.');

        const features = () => map._landmarkSourceData?.features || [];
        const search = byId('monument-search');
        const filterPanel = byId('filter-panel');
        const city = fieldControl('city', ['place-city', 'city-filter', 'filter-city']);
        const county = fieldControl('county', ['place-county', 'county-filter', 'filter-county']);
        const restricted = fieldControl('restricted', ['restricted-sites-filter', 'restricted-sites', 'restricted-filter', 'filter-restricted']);
        const webPdf = fieldControl('hasWebPdf', ['has-web-pdf', 'web-pdf-filter', 'filter-web-pdf']);
        const applyButton = byId('apply-filters');
        const autoUpdateResults = byId('auto-update-results');
        const clearButton = byId('clear-filters');
        const activeCount = byId('active-filter-count');
        const footerCount = byId('filter-result-count');
        const shell = byId('side-panel');
        const resultsView = byId('results-view');
        const detailView = byId('detail-view');
        const resultsList = byId('results-list');
        const resultsCount = byId('results-count');
        const compactToggle = byId('compact-results-toggle');
        const closeButton = byId('results-panel-close');
        const detailBack = byId('detail-back');
        const modeSymbology = byId('modeSymbologySwitch');
        const tabButtons = Array.from(document.querySelectorAll('[id^="filter-tab-"]'));
        const tabContent = byId('filter-content');
        const listeners = [];
        let tabHeightFrame = 0;
        let prefersReducedMotion = false;
        try {
            prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (_) {}

        function listen(target, type, handler) {
            if (!target) return;
            target.addEventListener(type, handler);
            listeners.push(() => target.removeEventListener(type, handler));
        }

        function clearTabContentHeight() {
            if (!tabContent) return;
            tabContent.style.height = '';
            tabContent.classList.remove('is-animating-height');
        }

        function animateTabContentHeight(fromHeight, toHeight) {
            if (!tabContent || prefersReducedMotion || fromHeight === toHeight) {
                clearTabContentHeight();
                return;
            }
            if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
            tabContent.classList.add('is-animating-height');
            tabContent.style.height = `${fromHeight}px`;
            // Force layout so the browser registers the starting height before easing.
            void tabContent.offsetHeight;
            tabHeightFrame = requestAnimationFrame(() => {
                tabContent.style.height = `${toHeight}px`;
                tabHeightFrame = 0;
            });
        }

        function isAutoUpdateEnabled() {
            return Boolean(autoUpdateResults?.checked);
        }

        function syncApplyButtonState() {
            if (!applyButton) return;
            applyButton.disabled = isAutoUpdateEnabled();
        }

        function onDraftChange() {
            updateDraftIndicators();
            if (isAutoUpdateEnabled()) applyFilters();
        }

        const sliders = typeof setupFilterYearSliders === 'function'
            ? setupFilterYearSliders({ onDraftChange })
            : { getRanges: () => ({ formYear: [1950, 2026], nhlYear: [1937, 2026] }), reset() {} };

        function populateSelects() {
            Object.entries(SELECT_FIELDS).forEach(([key, config]) => {
                const select = fieldControl(key, config.ids);
                if (!select || select.tagName !== 'SELECT') return;
                const currentValue = exactValue(select.value);
                const values = Array.from(new Set(features()
                    .map(feature => String(feature.properties?.[config.property] || '').trim())
                    .filter(Boolean)))
                    .sort(COLLATOR.compare);
                select.replaceChildren();
                const any = document.createElement('option');
                any.value = '';
                any.textContent = 'Any';
                select.appendChild(any);
                values.forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = displayValue(value);
                    select.appendChild(option);
                });
                select.value = values.includes(currentValue) ? currentValue : '';
            });
        }

        function getRestrictedHidden() {
            const checked = document.querySelector('[name="restricted-sites"]:checked, [name="restricted-filter"]:checked');
            const value = checked?.value ?? restricted?.value;
            if (restricted?.type === 'checkbox') return restricted.checked;
            return String(value || '').toLowerCase() === 'hide';
        }

        function readDraft() {
            const state = {
                search: search?.value.trim() || '',
                modes: selectedCheckboxValues('.mode-filter', [...MODE_FIELDS, 'None']),
                supremacy: selectedCheckboxValues('.supremacy-filter', [...SUPREMACY_FIELDS, 'None']),
                city: city?.value.trim() || '',
                county: county?.value.trim() || '',
                hideRestricted: getRestrictedHidden(),
                hasWebPdf: Boolean(webPdf?.checked),
                years: sliders.getRanges()
            };
            Object.entries(SELECT_FIELDS).forEach(([key, config]) => {
                state[key] = exactValue(fieldControl(key, config.ids)?.value);
            });
            return state;
        }

        function countActiveByTab(state) {
            const counts = {
                modes: state.modes.length !== MODE_FIELDS.length + 1 ? 1 : 0,
                supremacy: state.supremacy.length !== SUPREMACY_FIELDS.length + 1 ? 1 : 0,
                place: 0,
                time: 0,
                documentation: 0
            };
            ['state', 'office', 'nationalPark', 'federalAgency', 'city', 'county']
                .forEach(key => { if (state[key]) counts.place++; });
            if (state.hideRestricted) counts.place++;
            Object.entries(YEAR_FIELD_OPTIONS).forEach(([key, field]) => {
                const range = state.years[key];
                if (range[0] !== field.min || range[1] !== field.max) counts.time++;
            });
            ['primaryForm', 'requestType'].forEach(key => { if (state[key]) counts.documentation++; });
            if (state.hasWebPdf) counts.documentation++;
            return counts;
        }

        function countActive(state) {
            const byTab = countActiveByTab(state);
            return (state.search ? 1 : 0)
                + byTab.modes
                + byTab.supremacy
                + byTab.place
                + byTab.time
                + byTab.documentation;
        }

        function setCountBadge(badge, count) {
            if (!badge) return;
            badge.textContent = String(count);
            badge.classList.toggle('count-badge--zero', count === 0);
        }

        function updateDraftIndicators() {
            const state = readDraft();
            const byTab = countActiveByTab(state);
            setCountBadge(
                activeCount,
                (state.search ? 1 : 0)
                + byTab.modes
                + byTab.supremacy
                + byTab.place
                + byTab.time
                + byTab.documentation
            );
            Object.entries(byTab).forEach(([tab, count]) => {
                setCountBadge(byId(`filter-tab-${tab}-count`), count);
            });
        }

        function setResultsCount(count) {
            if (footerCount) footerCount.textContent = `${count} ${count === 1 ? 'result' : 'results'}`;
            if (resultsCount) resultsCount.textContent = String(count);
        }

        function formatLocation(props) {
            const place = [props.City, props.State].map(value => String(value || '').trim()).filter(Boolean);
            return place.join(', ') || 'Location unavailable';
        }

        let appliedState = null;
        let appliedResults = [];

        function renderResults() {
            if (!resultsList) return;
            resultsList.replaceChildren();
            if (appliedResults.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'results-empty';
                empty.textContent = 'No monuments match these filters.';
                resultsList.appendChild(empty);
                return;
            }
            const fragment = document.createDocumentFragment();
            appliedResults.forEach(feature => {
                const props = feature.properties || {};
                const card = document.createElement('article');
                card.className = 'result-card results-card';
                const text = document.createElement('div');
                text.className = 'result-card-text result-card-main';
                const headingLine = document.createElement('div');
                headingLine.className = 'result-card-heading result-card-title';
                const name = document.createElement('span');
                name.className = 'result-name';
                name.textContent = props.Historic_Name || 'Unknown Site';
                headingLine.appendChild(name);
                if (props.ReferenceID) {
                    const reference = document.createElement('span');
                    reference.className = 'result-reference-id';
                    reference.textContent = ` (${props.ReferenceID})`;
                    headingLine.appendChild(reference);
                }
                const location = document.createElement('div');
                location.className = 'result-location';
                location.textContent = formatLocation(props);
                text.append(headingLine, location);
                const details = document.createElement('button');
                details.type = 'button';
                details.className = 'result-view-details result-details-button';
                details.textContent = 'View details';
                details.addEventListener('click', () => {
                    controller.showDetail(feature);
                    if (typeof options.onSelectLandmark === 'function') options.onSelectLandmark(feature);
                });
                card.append(text, details);
                fragment.appendChild(card);
            });
            resultsList.appendChild(fragment);
        }

        function activeIdExpression(matches) {
            const all = features();
            if (matches.length === all.length) return typeof ALL_POINTS_FILTER !== 'undefined' ? ALL_POINTS_FILTER : ['==', ['literal', true], true];
            if (matches.length === 0) return typeof EMPTY_FILTER !== 'undefined' ? EMPTY_FILTER : ['==', ['id'], -1];
            return ['in', ['id'], ['literal', matches.map(feature => feature.id)]];
        }

        function applyFilters({ openResults = true, clearSelection = true } = {}) {
            appliedState = readDraft();
            appliedResults = sortFeatures(features().filter(feature => featureMatchesAppliedFilters(feature, appliedState)));
            if (clearSelection && typeof options.onClearSelection === 'function') options.onClearSelection();
            if (typeof setActivePointFilters === 'function') setActivePointFilters(map, activeIdExpression(appliedResults));
            setResultsCount(appliedResults.length);
            renderResults();
            if (openResults) controller.showResultsPanel();
            if (typeof options.onApply === 'function') {
                options.onApply({ state: cloneState(appliedState), results: appliedResults.slice() });
            }
            return appliedResults.slice();
        }

        function clearDraft() {
            if (search) search.value = '';
            document.querySelectorAll('.mode-filter, .supremacy-filter').forEach(box => { box.checked = true; });
            Object.entries(SELECT_FIELDS).forEach(([key, config]) => {
                const select = fieldControl(key, config.ids);
                if (select) select.value = '';
            });
            if (city) city.value = '';
            if (county) county.value = '';
            if (webPdf?.type === 'checkbox') webPdf.checked = false;
            document.querySelectorAll('[name="restricted-sites"], [name="restricted-filter"]').forEach(control => {
                control.checked = String(control.value).toLowerCase() === 'show';
            });
            if (restricted?.type === 'checkbox') restricted.checked = false;
            else if (restricted) restricted.value = restricted.querySelector?.('option[value="show"]') ? 'show' : '';
            sliders.reset();
            onDraftChange();
        }

        function activateTab(tab, { animate = true } = {}) {
            if (!tab) return;

            const fromHeight = animate && tabContent ? tabContent.getBoundingClientRect().height : 0;

            tabButtons.forEach(button => {
                const selected = button === tab;
                button.setAttribute('aria-selected', String(selected));
                button.tabIndex = selected ? 0 : -1;
                button.classList.toggle('is-active', selected);
                const panelId = button.getAttribute('aria-controls') || button.id.replace(/^filter-tab-/, '') + '-filter-panel';
                const panel = document.getElementById(panelId);
                if (panel) panel.hidden = !selected;
            });

            if (!animate || !tabContent) return;
            
            // drop any in-progress height so the natural size can be measured without easing
            if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
            tabContent.classList.remove('is-animating-height');
            tabContent.style.height = '';
            const toHeight = tabContent.getBoundingClientRect().height;
            animateTabContentHeight(fromHeight, toHeight);
        }

        tabButtons.forEach((tab, index) => {
            listen(tab, 'click', () => activateTab(tab));
            listen(tab, 'keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                let targetIndex;
                if (event.key === 'Home') targetIndex = 0;
                else if (event.key === 'End') targetIndex = tabButtons.length - 1;
                else targetIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
                activateTab(tabButtons[targetIndex]);
                tabButtons[targetIndex].focus();
            });
        });

        const controller = {
            applyFilters,
            clearDraft,
            showResultsPanel() {
                if (shell) shell.classList.add('is-open', 'showing-results');
                if (resultsView) resultsView.hidden = false;
                if (detailView) detailView.hidden = true;
                if (resultsView) resultsView.setAttribute('aria-hidden', 'false');
                if (detailView) detailView.setAttribute('aria-hidden', 'true');
            },
            hideResultsPanel() {
                if (shell) shell.classList.remove('is-open', 'showing-results');
                if (resultsView) resultsView.hidden = true;
            },
            showDetail() {
                if (shell) shell.classList.add('is-open');
                if (shell) shell.classList.remove('showing-results');
                if (resultsView) resultsView.hidden = true;
                if (detailView) detailView.hidden = false;
                if (resultsView) resultsView.setAttribute('aria-hidden', 'true');
                if (detailView) detailView.setAttribute('aria-hidden', 'false');
            },
            getAppliedResults: () => appliedResults.slice(),
            getAppliedState: () => appliedState ? cloneState(appliedState) : null,
            refreshResults() {
                appliedResults = sortFeatures(features().filter(feature => featureMatchesAppliedFilters(feature, appliedState || readDraft())));
                setResultsCount(appliedResults.length);
                renderResults();
                return appliedResults.slice();
            },
            destroy() {
                if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
                clearTabContentHeight();
                listeners.splice(0).forEach(remove => remove());
                if (window._nhlFilterPanelController === controller) window._nhlFilterPanelController = null;
            }
        };
        controller.showResults = controller.showResultsPanel;
        controller.restoreResults = controller.showResultsPanel;
        controller.closeResults = controller.hideResultsPanel;

        populateSelects();
        activateTab(tabButtons.find(tab => tab.getAttribute('aria-selected') === 'true') || tabButtons[0], { animate: false });
        updateDraftIndicators();
        listen(tabContent, 'transitionend', event => {
            if (event.target !== tabContent || event.propertyName !== 'height') return;
            clearTabContentHeight();
        });
        listen(applyButton, 'click', applyFilters);
        listen(clearButton, 'click', clearDraft);
        listen(closeButton, 'click', () => controller.hideResultsPanel());
        listen(compactToggle, 'change', () => {
            resultsView?.classList.toggle('is-compact', compactToggle.checked);
            shell?.classList.toggle('results-compact', compactToggle.checked);
        });
        listen(modeSymbology, 'change', () => {
            if (typeof togglemodeSymbology === 'function') togglemodeSymbology(true);
        });
        listen(detailBack, 'click', () => {
            if (typeof options.onClearSelection === 'function') options.onClearSelection();
            controller.showResultsPanel();
        });
        listen(autoUpdateResults, 'change', () => {
            syncApplyButtonState();
            if (isAutoUpdateEnabled()) applyFilters();
        });
        document.querySelectorAll('#filter-panel input, #filter-panel select').forEach(control => {
            if (control === autoUpdateResults || control === modeSymbology) return;
            listen(control, control.type === 'text' || control.type === 'search' ? 'input' : 'change', onDraftChange);
        });
        document.querySelectorAll('.mode-filter, .supremacy-filter').forEach(checkbox => {
            const label = checkbox.closest('label');
            listen(label || checkbox, 'contextmenu', event => {
                event.preventDefault();
                const selector = checkbox.classList.contains('mode-filter') ? '.mode-filter' : '.supremacy-filter';
                const group = Array.from(document.querySelectorAll(selector));
                const isSolo = group.every(item => item === checkbox ? item.checked : !item.checked);
                group.forEach(item => { item.checked = isSolo || item === checkbox; });
                onDraftChange();
            });
        });
        listen(filterPanel, 'keydown', event => {
            if (event.key !== 'Enter' || event.isComposing || event.repeat) return;
            if (event.target.closest('button, select, [role="tab"]')) return;
            if (isAutoUpdateEnabled()) return;
            event.preventDefault();
            applyFilters();
        });
        // Initialize the map and count only after the source has populated.
        window._nhlFilterPanelController = controller;
        syncApplyButtonState();
        applyFilters({ openResults: false, clearSelection: false });
        controller.hideResultsPanel();
        return controller;
    }

    window.featureMatchesAppliedFilters = featureMatchesAppliedFilters;
    window.setupFilterPanel = setupFilterPanel;
})();
