(function() {
    'use strict';

    // fields searched by the free text filter
    const SEARCH_FIELDS = [
        'Historic_Name',
        'ReferenceID',
        'Other_Name_s_',
        'Multiple_Name',
        'City',
        'County',
        'State'
    ];
    // nomination keeps the misspelling used by the published spreadsheet header
    const SIGNIFICANCE_FIELDS = {
        metadata: 'Areas_of_Significance_Metadata',
        nomination: 'Areas_of_Signifance_Nomination_Forms'
    };
    const SELECT_FIELDS = {};
    // field metadata shared by multi select menus and filter matching
    const MULTI_SELECT_FIELDS = {
        state: {
            property: 'State',
            rootId: 'state-filter',
            toggleId: 'state-filter-toggle',
            menuId: 'state-filter-menu',
            checkboxClass: 'state-filter',
            displayName: stateDisplayName
        },
        office: {
            property: 'NHL Office',
            rootId: 'nhl-office-filter',
            toggleId: 'nhl-office-filter-toggle',
            menuId: 'nhl-office-filter-menu',
            checkboxClass: 'office-filter',
            displayName: displayValue
        },
        nationalPark: {
            property: 'National_Park',
            rootId: 'national-park-filter',
            toggleId: 'national-park-filter-toggle',
            menuId: 'national-park-filter-menu',
            checkboxClass: 'national-park-filter',
            displayName: displayValue
        },
        federalAgency: {
            property: 'Federal_Agency',
            rootId: 'federal-agency-filter',
            toggleId: 'federal-agency-filter-toggle',
            menuId: 'federal-agency-filter-menu',
            checkboxClass: 'federal-agency-filter',
            displayName: agencyDisplayName
        },
        primaryForm: {
            property: 'Primary Form',
            rootId: 'primary-form-filter',
            toggleId: 'primary-form-filter-toggle',
            menuId: 'primary-form-filter-menu',
            checkboxClass: 'primary-form-filter',
            displayName: displayValue
        },
        requestType: {
            property: 'Request_Type',
            rootId: 'request-type-filter',
            toggleId: 'request-type-filter-toggle',
            menuId: 'request-type-filter-menu',
            checkboxClass: 'request-type-filter',
            displayName: displayValue
        }
    };
    // normalizes all caps agency names without changing mixed case names
    function agencyDisplayName(value) {
        const decoded = displayValue(value);
        if (!decoded) return '';
        return /^[A-Z0-9][A-Z0-9\s./'&;,()-]*$/.test(decoded) ? toTitleCase(decoded) : decoded;
    }

    function selectedCheckboxFilterValues(selector) {
        return Array.from(document.querySelectorAll(selector))
            .filter(box => box.checked)
            .map(box => String(box.value || '').trim())
            .filter(Boolean);
    }

    function hasSelectFilter(value) {
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }

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

    // accepts only web urls so malformed values do not count as documentation
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

    function selectedCheckboxValues(selector, defaults) {
        const boxes = Array.from(document.querySelectorAll(selector));
        return boxes.length ? boxes.filter(box => box.checked).map(box => box.value) : defaults.slice();
    }

    // matches selected category flags with none representing no category flags
    function groupMatches(props, selected, fields) {
        if (selected.length === fields.length + 1 && selected.includes('None')) return true;
        if (selected.length === 0) return false;
        const hasCategory = fields.some(field => props[field] === '1');
        return selected.some(field => field === 'None' ? !hasCategory : props[field] === '1');
    }

    // applies the saved draft state to one source feature
    function featureMatchesAppliedFilters(feature, state) {
        const props = feature?.properties || {};
        const query = state.search.trim().toLowerCase();

        if (query && !SEARCH_FIELDS.some(field => String(props[field] || '').toLowerCase().includes(query))) return false;
        if (!groupMatches(props, state.modes, MODE_FIELDS)) return false;
        if (!groupMatches(props, state.supremacy, SUPREMACY_FIELDS)) return false;

        // exact value selects and multi select menus use separate state shapes
        for (const [key, config] of Object.entries(SELECT_FIELDS)) {
            if (state[key] && String(props[config.property] || '').trim() !== state[key]) return false;
        }
        for (const [key, config] of Object.entries(MULTI_SELECT_FIELDS)) {
            const selected = state[key];
            if (!Array.isArray(selected) || selected.length === 0) continue;
            if (!selected.includes(String(props[config.property] || '').trim())) return false;
        }
        if (state.city && !String(props.City || '').toLowerCase().includes(state.city.toLowerCase())) return false;
        if (state.county && !String(props.County || '').toLowerCase().includes(state.county.toLowerCase())) return false;
        // combined mode matches either source while separated fields are independent requirements
        if (state.significanceSeparated) {
            if (
                state.significanceMetadata &&
                !String(props[SIGNIFICANCE_FIELDS.metadata] || '').toLowerCase().includes(state.significanceMetadata.toLowerCase())
            ) return false;
            if (
                state.significanceNomination &&
                !String(props[SIGNIFICANCE_FIELDS.nomination] || '').toLowerCase().includes(state.significanceNomination.toLowerCase())
            ) return false;
        } else if (state.significance) {
            const significanceQuery = state.significance.toLowerCase();
            const matchesEitherSource = Object.values(SIGNIFICANCE_FIELDS).some(field => (
                String(props[field] || '').toLowerCase().includes(significanceQuery)
            ));
            if (!matchesEitherSource) return false;
        }
        if (state.hideRestricted && props.Restricted === '1') return false;
        if (state.hasWebPdf && !validWebPdf(props['Web PDF'])) return false;

        // active ranges include both bounds and exclude form year multiple values when configured
        for (const [key, field] of Object.entries(YEAR_FIELD_OPTIONS)) {
            const [minimum, maximum] = state.years[key];
            if (minimum === field.min && maximum === field.max) continue;
            if (field.excludeMultiple && props[field.property] === 'Multiple') return false;
            const year = Number(props[field.property]);
            if (!Number.isFinite(year) || year < minimum || year > maximum) return false;
        }
        return true;
    }

    // creates the filter controls and their shared results controller
    function setupFilterPanel(options = {}) {
        if (window._nhlFilterPanelController) return window._nhlFilterPanelController;
        const map = options.map;
        if (!map) throw new Error('setupFilterPanel requires a map instance.');

        // shared source data and filter controls
        const features = () => map._landmarkSourceData?.features || [];
        const search = byId('monument-search');
        const filterPanel = byId('filter-panel');
        const city = fieldControl('city', ['place-city', 'city-filter', 'filter-city']);
        const county = fieldControl('county', ['place-county', 'county-filter', 'filter-county']);
        const restricted = fieldControl('restricted', ['restricted-sites-filter', 'restricted-sites', 'restricted-filter', 'filter-restricted']);
        const webPdf = fieldControl('hasWebPdf', ['has-web-pdf', 'web-pdf-filter', 'filter-web-pdf']);
        const significance = byId('significance-filter');
        const significanceMetadata = byId('significance-metadata-filter');
        const significanceNomination = byId('significance-nomination-filter');
        const significanceSeparated = byId('separate-significance-sources');
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
        const resultsSearch = byId('results-search');
        const resultsSortToggle = byId('results-sort-toggle');
        const resultsSortMenu = byId('results-sort-menu');
        const resultsSortOptions = Array.from(resultsSortMenu?.querySelectorAll('[data-sort-value]') || []);
        const resultsExportRoot = document.querySelector('.results-export');
        const resultsExportToggle = byId('results-export-toggle');
        const resultsExportMenu = byId('results-export-menu');
        const resultsExportOptions = Array.from(resultsExportMenu?.querySelectorAll('[data-export-format]') || []);
        const compactToggle = byId('compact-results-toggle');
        const closeButton = byId('results-panel-close');
        const detailBack = byId('detail-back');
        const modeSymbology = byId('modeSymbologySwitch');
        const tabButtons = Array.from(document.querySelectorAll('[id^="filter-tab-"]'));
        const tabContent = byId('filter-content');
        const listeners = [];
        let resultsQuery = '';
        let selectedSort = 'best-match';

        // tab height animation state
        let tabHeightFrame = 0;
        let prefersReducedMotion = false;
        try {
            prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (_) {}

        // tracks listeners so destroy can remove every panel binding
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

        // eases between tab heights while respecting reduced motion
        function animateTabContentHeight(fromHeight, toHeight) {
            if (!tabContent || prefersReducedMotion || fromHeight === toHeight) {
                clearTabContentHeight();
                return;
            }
            if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
            tabContent.classList.add('is-animating-height');
            tabContent.style.height = `${fromHeight}px`;
            // forces the starting height to render before the transition
            void tabContent.offsetHeight;
            tabHeightFrame = requestAnimationFrame(() => {
                tabContent.style.height = `${toHeight}px`;
                tabHeightFrame = 0;
            });
        }

        function isAutoUpdateEnabled() {
            return Boolean(autoUpdateResults?.checked);
        }

        function hasPendingFilterChanges() {
            if (!appliedState) return true;
            return JSON.stringify(readDraft()) !== JSON.stringify(appliedState);
        }

        function syncApplyButtonState() {
            if (!applyButton) return;
            applyButton.disabled = isAutoUpdateEnabled() || !hasPendingFilterChanges();
        }

        // swaps significance inputs and reuses the tab height transition for the added grid row
        function syncSignificanceMode({ animate = true } = {}) {
            const separate = Boolean(significanceSeparated?.checked);
            const documentationPanel = byId('documentation-filter-panel');
            const shouldAnimate = animate && tabContent && documentationPanel && !documentationPanel.hidden;
            const fromHeight = shouldAnimate ? tabContent.getBoundingClientRect().height : 0;

            if (shouldAnimate) {
                // release any prior inline height before measuring the new natural layout
                if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
                tabHeightFrame = 0;
                tabContent.classList.remove('is-animating-height');
                tabContent.style.height = '';
            }

            document.querySelectorAll('[data-significance-mode="combined"]').forEach(element => {
                element.hidden = separate;
            });
            document.querySelectorAll('[data-significance-mode="separate"]').forEach(element => {
                element.hidden = !separate;
            });

            if (shouldAnimate) {
                const toHeight = tabContent.getBoundingClientRect().height;
                animateTabContentHeight(fromHeight, toHeight);
            }
        }

        // refreshes draft only UI before optionally applying the new filters
        function onDraftChange() {
            updateDraftIndicators();
            Object.keys(MULTI_SELECT_FIELDS).forEach(syncMultiSelectLabel);
            if (isAutoUpdateEnabled()) applyFilters();
            syncApplyButtonState();
        }

        const sliders = typeof setupFilterYearSliders === 'function'
            ? setupFilterYearSliders({ onDraftChange })
            : { getRanges: () => ({ formYear: [1950, 2026], nhlYear: [1937, 2026] }), reset() {} };

        // rebuilds select options from the loaded source data
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
            Object.keys(MULTI_SELECT_FIELDS).forEach(populateMultiSelect);
        }

        function selectedMultiValues(key) {
            const config = MULTI_SELECT_FIELDS[key];
            return config ? selectedCheckboxFilterValues(`.${config.checkboxClass}`) : [];
        }

        // summarizes selected values in the closed menu toggle
        function syncMultiSelectLabel(key) {
            const config = MULTI_SELECT_FIELDS[key];
            if (!config) return;
            const label = document.querySelector(`#${config.rootId} .multi-select-label`);
            if (!label) return;
            const selected = selectedMultiValues(key);
            if (selected.length === 0) {
                label.textContent = 'Any';
            } else if (selected.length === 1) {
                label.textContent = config.displayName(selected[0]);
            } else {
                label.textContent = `${selected.length} selected`;
            }
        }

        function clearMultiSelectMenuPosition(menu) {
            if (!menu) return;
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = '';
            menu.style.width = '';
            menu.style.maxHeight = '';
        }

        // positions the portaled menu above the toggle when space below is tight
        function positionMultiSelectMenu(key) {
            const config = MULTI_SELECT_FIELDS[key];
            const toggle = byId(config?.toggleId);
            const menu = byId(config?.menuId);
            if (!toggle || !menu || menu.hidden) return;

            const rect = toggle.getBoundingClientRect();
            const gap = 4;
            const viewportPadding = 8;
            // menu heights use rem based pixel estimates for the current layout
            const preferredMax = 12 * 16;
            const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
            const spaceAbove = rect.top - gap - viewportPadding;
            const openAbove = spaceBelow < Math.min(preferredMax, 8 * 16) && spaceAbove > spaceBelow;
            const available = Math.max(openAbove ? spaceAbove : spaceBelow, 4.5 * 16);

            menu.style.left = `${Math.round(rect.left)}px`;
            menu.style.width = `${Math.round(rect.width)}px`;
            menu.style.maxHeight = `${Math.min(preferredMax, available)}px`;

            if (openAbove) {
                menu.style.top = 'auto';
                menu.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
            } else {
                menu.style.bottom = 'auto';
                menu.style.top = `${Math.round(rect.bottom + gap)}px`;
            }
        }

        function repositionOpenMultiSelectMenus() {
            Object.keys(MULTI_SELECT_FIELDS).forEach(key => {
                const toggle = byId(MULTI_SELECT_FIELDS[key].toggleId);
                if (toggle?.getAttribute('aria-expanded') === 'true') positionMultiSelectMenu(key);
            });
        }

        function multiSelectCheckboxes(key) {
            const config = MULTI_SELECT_FIELDS[key];
            return config
                ? Array.from(byId(config.menuId)?.querySelectorAll(`.${config.checkboxClass}`) || [])
                : [];
        }

        function focusMultiSelectOption(key, position = 'first') {
            const checkboxes = multiSelectCheckboxes(key);
            const checkbox = position === 'last' ? checkboxes.at(-1) : checkboxes[0];
            checkbox?.focus();
        }

        // moves open menus to body so panel overflow cannot clip them
        function setMultiSelectOpen(key, open, { focusOption = false, focusPosition = 'first' } = {}) {
            const config = MULTI_SELECT_FIELDS[key];
            if (!config) return;
            const root = byId(config.rootId);
            const toggle = byId(config.toggleId);
            const menu = byId(config.menuId);
            if (!root || !toggle || !menu) return;
            root.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            if (!open) {
                menu.hidden = true;
                clearMultiSelectTypeahead(key);
                clearMultiSelectMenuPosition(menu);
                if (menu.dataset.ported === 'true') {
                    root.appendChild(menu);
                    delete menu.dataset.ported;
                }
                return;
            }
            if (menu.parentElement !== document.body) {
                document.body.appendChild(menu);
                menu.dataset.ported = 'true';
            }
            menu.hidden = false;
            positionMultiSelectMenu(key);
            requestAnimationFrame(() => positionMultiSelectMenu(key));
            if (focusOption) focusMultiSelectOption(key, focusPosition);
        }

        function closeAllMultiSelects(exceptKey = null) {
            Object.keys(MULTI_SELECT_FIELDS).forEach(key => {
                if (key === exceptKey) return;
                setMultiSelectOpen(key, false);
            });
        }

        const multiSelectTypeahead = Object.fromEntries(
            Object.keys(MULTI_SELECT_FIELDS).map(key => [key, { query: '', timer: 0 }])
        );

        function clearMultiSelectTypeahead(key) {
            const state = multiSelectTypeahead[key];
            if (!state) return;
            state.query = '';
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = 0;
            }
            const config = MULTI_SELECT_FIELDS[key];
            byId(config.menuId)
                ?.querySelectorAll('.multi-select-option.is-typeahead-match')
                .forEach(option => option.classList.remove('is-typeahead-match'));
        }

        function clearAllMultiSelectTypeahead() {
            Object.keys(MULTI_SELECT_FIELDS).forEach(clearMultiSelectTypeahead);
        }

        // clears a paused typeahead query after 800 milliseconds
        function scheduleMultiSelectTypeaheadReset(key) {
            const state = multiSelectTypeahead[key];
            if (!state) return;
            if (state.timer) clearTimeout(state.timer);
            state.timer = setTimeout(() => {
                state.query = '';
                state.timer = 0;
            }, 800);
        }

        // highlights and focuses the first option matching the typed prefix
        function focusMultiSelectTypeaheadMatch(key, query) {
            const config = MULTI_SELECT_FIELDS[key];
            const menu = byId(config?.menuId);
            if (!menu || !query) return;
            const normalized = query.toLowerCase();
            const options = Array.from(menu.querySelectorAll('.multi-select-option'));
            options.forEach(option => option.classList.remove('is-typeahead-match'));
            const match = options.find(option => {
                const label = option.querySelector('span')?.textContent || '';
                return label.toLowerCase().startsWith(normalized);
            });
            if (!match) return;
            match.classList.add('is-typeahead-match');
            match.querySelector('input')?.focus();
            match.scrollIntoView({ block: 'nearest' });
        }

        function focusAfterMultiSelectToggle(key) {
            const toggle = byId(MULTI_SELECT_FIELDS[key]?.toggleId);
            if (!toggle || !filterPanel) return;
            const focusable = Array.from(filterPanel.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(element => !element.closest('[hidden]'));
            focusable[focusable.indexOf(toggle) + 1]?.focus();
        }

        // keeps keyboard focus within the menu while supporting arrow navigation
        function handleMultiSelectMenuNavigation(key, event) {
            const checkboxes = multiSelectCheckboxes(key);
            if (checkboxes.length === 0) return;
            const currentIndex = checkboxes.indexOf(document.activeElement);

            if (event.key === 'Tab') {
                if (event.shiftKey && currentIndex === 0) {
                    event.preventDefault();
                    setMultiSelectOpen(key, false);
                    byId(MULTI_SELECT_FIELDS[key].toggleId)?.focus();
                } else if (!event.shiftKey && currentIndex === checkboxes.length - 1) {
                    event.preventDefault();
                    setMultiSelectOpen(key, false);
                    focusAfterMultiSelectToggle(key);
                }
                return;
            }

            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            let nextIndex;
            if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = checkboxes.length - 1;
            else if (event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? checkboxes.length - 1 : currentIndex - 1;
            else nextIndex = currentIndex < 0 || currentIndex === checkboxes.length - 1 ? 0 : currentIndex + 1;
            checkboxes[nextIndex].focus();
        }

        function activeMultiSelectKey() {
            return Object.keys(MULTI_SELECT_FIELDS).find(key => {
                const config = MULTI_SELECT_FIELDS[key];
                const root = byId(config.rootId);
                const menu = byId(config.menuId);
                return root?.contains(document.activeElement) || menu?.contains(document.activeElement);
            }) || null;
        }

        // routes printable keys to the multi select currently holding focus
        function handleMultiSelectTypeaheadKeydown(event) {
            const key = activeMultiSelectKey();
            if (!key) return;
            const config = MULTI_SELECT_FIELDS[key];
            const toggle = byId(config.toggleId);
            const typeahead = multiSelectTypeahead[key];
            if (!toggle || !typeahead) return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;

            if (event.key === 'Backspace') {
                if (!typeahead.query) return;
                event.preventDefault();
                typeahead.query = typeahead.query.slice(0, -1);
                if (typeahead.query) {
                    focusMultiSelectTypeaheadMatch(key, typeahead.query);
                    scheduleMultiSelectTypeaheadReset(key);
                } else {
                    clearMultiSelectTypeahead(key);
                }
                return;
            }

            const isSpace = event.key === ' ';
            if (isSpace && event.target?.classList?.contains(config.checkboxClass)) return;
            const isPrintable = event.key.length === 1 && (!isSpace || Boolean(typeahead.query));
            if (!isPrintable) return;

            event.preventDefault();
            if (toggle.getAttribute('aria-expanded') !== 'true') {
                closeAllMultiSelects(key);
                setMultiSelectOpen(key, true);
            }
            typeahead.query += event.key;
            focusMultiSelectTypeaheadMatch(key, typeahead.query);
            scheduleMultiSelectTypeaheadReset(key);
        }

        // rebuilds menu options from source values while keeping current choices
        function populateMultiSelect(key) {
            const config = MULTI_SELECT_FIELDS[key];
            const menu = byId(config?.menuId);
            if (!config || !menu) return;
            const currentValues = new Set(selectedMultiValues(key));
            const values = Array.from(new Set(features()
                .map(feature => String(feature.properties?.[config.property] || '').trim())
                .filter(Boolean)))
                .sort((a, b) => COLLATOR.compare(config.displayName(a), config.displayName(b)));
            menu.replaceChildren();
            values.forEach(value => {
                const option = document.createElement('label');
                option.className = 'multi-select-option';
                option.setAttribute('role', 'option');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = `styled-checkbox ${config.checkboxClass}`;
                checkbox.value = value;
                checkbox.checked = currentValues.has(value);
                option.setAttribute('aria-selected', String(checkbox.checked));
                const text = document.createElement('span');
                text.textContent = config.displayName(value);
                option.append(checkbox, text);
                menu.appendChild(option);
            });
            clearMultiSelectTypeahead(key);
            syncMultiSelectLabel(key);
        }

        function getRestrictedHidden() {
            const checked = document.querySelector('[name="restricted-sites"]:checked, [name="restricted-filter"]:checked');
            const value = checked?.value ?? restricted?.value;
            if (restricted?.type === 'checkbox') return restricted.checked;
            return String(value || '').toLowerCase() === 'hide';
        }

        // reads form controls without changing the applied map and results state
        function readDraft() {
            // shared controls are read first before configured fields are added
            const state = {
                search: search?.value.trim() || '',
                modes: selectedCheckboxValues('.mode-filter', [...MODE_FIELDS, 'None']),
                supremacy: selectedCheckboxValues('.supremacy-filter', [...SUPREMACY_FIELDS, 'None']),
                city: city?.value.trim() || '',
                county: county?.value.trim() || '',
                significance: significance?.value.trim() || '',
                significanceMetadata: significanceMetadata?.value.trim() || '',
                significanceNomination: significanceNomination?.value.trim() || '',
                significanceSeparated: Boolean(significanceSeparated?.checked),
                hideRestricted: getRestrictedHidden(),
                hasWebPdf: Boolean(webPdf?.checked),
                years: sliders.getRanges()
            };

            Object.entries(SELECT_FIELDS).forEach(([key, config]) => {
                state[key] = exactValue(fieldControl(key, config.ids)?.value);
            });

            Object.keys(MULTI_SELECT_FIELDS).forEach(key => {
                state[key] = selectedMultiValues(key);
            });
            return state;
        }

        // checked category options count as active filters; all checked means no filter
        function countCategoryFilters(selected, total) {
            return selected.length === total ? 0 : selected.length;
        }

        // counts active filters by tab for the visible badges
        function countActiveByTab(state) {
            const counts = {
                modes: countCategoryFilters(state.modes, MODE_FIELDS.length + 1),
                supremacy: countCategoryFilters(state.supremacy, SUPREMACY_FIELDS.length + 1),
                place: 0,
                time: 0,
                documentation: 0
            };
            ['state', 'office', 'nationalPark', 'federalAgency', 'city', 'county']
                .forEach(key => { if (hasSelectFilter(state[key])) counts.place++; });
            if (state.hideRestricted) counts.place++;
            Object.entries(YEAR_FIELD_OPTIONS).forEach(([key, field]) => {
                const range = state.years[key];
                if (range[0] !== field.min || range[1] !== field.max) counts.time++;
            });
            ['primaryForm', 'requestType'].forEach(key => { if (hasSelectFilter(state[key])) counts.documentation++; });
            // the mode checkbox changes presentation only, so only populated searches count
            if (state.significanceSeparated) {
                if (state.significanceMetadata) counts.documentation++;
                if (state.significanceNomination) counts.documentation++;
            } else if (state.significance) {
                counts.documentation++;
            }
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

        // syncs the overall and per tab draft filter badges
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

        function setHeaderResultsCount(count) {
            if (resultsCount) resultsCount.textContent = String(count);
        }

        function formatLocation(props) {
            const place = [props.City, props.State].map(value => String(value || '').trim()).filter(Boolean);
            return place.join(', ') || 'Location unavailable';
        }

        function resultGroup(feature) {
            const props = feature.properties || {};
            if (selectedSort === 'state') {
                const label = stateDisplayName(props.State).trim() || 'State/Territory unavailable';
                return { key: label.toLocaleLowerCase(), label, modifier: 'state' };
            }
            if (selectedSort === 'city') {
                const label = String(props.City || '').trim() || 'City unavailable';
                return { key: label.toLocaleLowerCase(), label, modifier: 'city' };
            }
            return null;
        }

        function getVisibleResults() {
            const visible = resultsQuery.trim()
                ? appliedResults.filter(feature => featureMatchesResultsQuery(feature, resultsQuery))
                : appliedResults;
            return sortFeatures(visible, selectedSort, appliedState, resultsQuery);
        }

        function clearSortMenuPosition() {
            if (!resultsSortMenu) return;
            resultsSortMenu.style.top = '';
            resultsSortMenu.style.bottom = '';
            resultsSortMenu.style.left = '';
            resultsSortMenu.style.width = '';
        }

        function positionSortMenu() {
            if (!resultsSortToggle || !resultsSortMenu || resultsSortMenu.hidden) return;

            const rect = resultsSortToggle.getBoundingClientRect();
            const gap = 4;
            resultsSortMenu.style.width = '';
            resultsSortMenu.style.bottom = 'auto';
            const menuWidth = resultsSortMenu.offsetWidth;
            resultsSortMenu.style.left = `${Math.round(rect.right - menuWidth)}px`;
            resultsSortMenu.style.top = `${Math.round(rect.bottom + gap)}px`;
        }

        // moves the menu to body so sticky group headers cannot cover it
        function setSortMenuOpen(open, { focus = false, focusLast = false } = {}) {
            if (!resultsSortToggle || !resultsSortMenu) return;
            const sortRoot = resultsSortToggle.closest('.results-sort');
            resultsSortToggle.setAttribute('aria-expanded', String(open));
            if (!open) {
                resultsSortMenu.hidden = true;
                clearSortMenuPosition();
                if (resultsSortMenu.dataset.ported === 'true') {
                    sortRoot?.appendChild(resultsSortMenu);
                    delete resultsSortMenu.dataset.ported;
                }
                return;
            }
            if (resultsSortMenu.parentElement !== document.body) {
                document.body.appendChild(resultsSortMenu);
                resultsSortMenu.dataset.ported = 'true';
            }
            resultsSortMenu.hidden = false;
            positionSortMenu();
            requestAnimationFrame(() => positionSortMenu());
            if (!focus || resultsSortOptions.length === 0) return;
            const selectedIndex = resultsSortOptions.findIndex(option => option.dataset.sortValue === selectedSort);
            const target = focusLast
                ? resultsSortOptions[resultsSortOptions.length - 1]
                : resultsSortOptions[Math.max(0, selectedIndex)];
            target.focus();
        }

        function selectSort(sortValue, { returnFocus = true } = {}) {
            if (!resultsSortOptions.some(option => option.dataset.sortValue === sortValue)) return;
            selectedSort = sortValue;
            resultsSortOptions.forEach(option => {
                const selected = option.dataset.sortValue === selectedSort;
                option.setAttribute('aria-checked', String(selected));
                option.classList.toggle('is-selected', selected);
            });
            setSortMenuOpen(false);
            renderResults();
            if (returnFocus) resultsSortToggle?.focus();
        }

        // syncs visual and accessible menu state with optional keyboard entry focus
        function setExportMenuOpen(open, { focus = false, focusLast = false } = {}) {
            if (!resultsExportToggle || !resultsExportMenu) return;
            resultsExportToggle.setAttribute('aria-expanded', String(open));
            resultsExportMenu.setAttribute('aria-hidden', String(!open));
            resultsExportRoot?.classList.toggle('is-open', open);
            if (!open || !focus || resultsExportOptions.length === 0) return;
            const target = focusLast
                ? resultsExportOptions[resultsExportOptions.length - 1]
                : resultsExportOptions[0];
            target.focus();
        }

        // prefers the raw spreadsheet schema and falls back for injected or legacy feature data
        function exportSourceColumns(exportFeatures) {
            const sourceFields = map._landmarkSourceData?._sourceFields;
            if (Array.isArray(sourceFields) && sourceFields.length > 0) return sourceFields.slice();

            const columns = new Set(['LAT', 'LON']);
            exportFeatures.forEach(feature => {
                Object.keys(feature.properties || {}).forEach(column => columns.add(column));
            });
            return Array.from(columns);
        }

        // aligns raw cells to source columns and reconstructs legacy rows when metadata is absent
        function exportSourceRow(feature, columns) {
            if (Array.isArray(feature?._sourceRow)) {
                return columns.map((_, index) => feature._sourceRow[index] ?? '');
            }
            if (feature?._sourceRow) return columns.map(column => feature._sourceRow[column] ?? '');
            const coordinates = feature?.geometry?.coordinates || [];
            const fallback = {
                LAT: coordinates[1] ?? '',
                LON: coordinates[0] ?? '',
                ...(feature?.properties || {})
            };
            return columns.map(column => fallback[column] ?? '');
        }

        // downloads the visible result set with original spreadsheet columns and source ordering
        function exportResultsToCsv() {
            if (typeof window.Papa?.unparse !== 'function') {
                console.error('CSV export requires Papa Parse.');
                return;
            }

            // getVisibleResults includes the results search before source IDs restore sheet order
            const exportFeatures = getVisibleResults().sort((a, b) => Number(a.id) - Number(b.id));
            const fields = exportSourceColumns(exportFeatures);
            const csv = window.Papa.unparse({
                fields,
                data: exportFeatures.map(feature => exportSourceRow(feature, fields))
            });
            // the byte order mark keeps non-ASCII spreadsheet text readable in Excel
            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `monumental-denial-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            // delay cleanup until the browser has consumed the synthetic download click
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }

        // adding a format only requires a menu option and a handler here
        const exportHandlers = {
            csv: exportResultsToCsv
        };

        // dispatches extensible formats and returns focus to the menu trigger
        function runExport(format) {
            const handler = exportHandlers[format];
            if (typeof handler !== 'function') return;
            setExportMenuOpen(false);
            handler();
            resultsExportToggle?.focus();
        }

        let appliedState = null;
        let appliedResults = [];

        // renders the currently applied features as selectable result cards
        function renderResults() {
            if (!resultsList) return;
            resultsList.replaceChildren();

            const visibleResults = getVisibleResults();
            setHeaderResultsCount(visibleResults.length);

            if (appliedResults.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'results-empty';
                empty.textContent = 'No monuments match these filters.';
                resultsList.appendChild(empty);
                return;
            }

            if (visibleResults.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'results-empty';
                empty.textContent = 'No results match your search.';
                resultsList.appendChild(empty);
                return;
            }

            const fragment = document.createDocumentFragment();
            const highlightQuery = resultsQuery.trim();
            let previousGroupKey = null;
            visibleResults.forEach(feature => {
                const props = feature.properties || {};

                const group = resultGroup(feature);
                if (group && group.key !== previousGroupKey) {
                    const heading = document.createElement('h3');
                    heading.className = `result-group-header result-group-header--${group.modifier}`;
                    heading.dataset.resultGroup = group.modifier;
                    heading.textContent = group.label;
                    fragment.appendChild(heading);
                    previousGroupKey = group.key;
                }

                // result identity and location
                const card = document.createElement('article');
                card.className = 'result-card results-card';
                const text = document.createElement('div');
                text.className = 'result-card-text result-card-main';
                const headingLine = document.createElement('div');
                headingLine.className = 'result-card-heading result-card-title';
                const name = document.createElement('span');
                name.className = 'result-name';
                appendHighlightedText(name, props.Historic_Name || 'Unknown Site', highlightQuery);
                headingLine.appendChild(name);

                if (props.ReferenceID) {
                    const reference = document.createElement('span');
                    reference.className = 'result-reference-id';
                    reference.appendChild(document.createTextNode(' ('));
                    appendHighlightedText(reference, props.ReferenceID, highlightQuery);
                    reference.appendChild(document.createTextNode(')'));
                    headingLine.appendChild(reference);
                }
                const location = document.createElement('div');
                location.className = 'result-location';
                if (highlightQuery) {
                    appendHighlightedLocation(location, props, highlightQuery);
                } else {
                    location.textContent = formatLocation(props);
                }
                text.append(headingLine, location);

                // selection routes through the controller before map selection
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

        // uses mapbox all and empty sentinels to avoid building an id list for those cases
        function activeIdExpression(matches) {
            const all = features();
            if (matches.length === all.length) return typeof ALL_POINTS_FILTER !== 'undefined' ? ALL_POINTS_FILTER : ['==', ['literal', true], true];
            if (matches.length === 0) return typeof EMPTY_FILTER !== 'undefined' ? EMPTY_FILTER : ['==', ['id'], -1];

            // partial matches use ids so every point layer shares the same filter
            return ['in', ['id'], ['literal', matches.map(feature => feature.id)]];
        }

        // commits the draft state to the map layer and results list
        function applyFilters({ openResults = true, clearSelection = true } = {}) {
            appliedState = readDraft();
            appliedResults = sortFeatures(
                features().filter(feature => featureMatchesAppliedFilters(feature, appliedState)),
                'name'
            );

            if (clearSelection && typeof options.onClearSelection === 'function') options.onClearSelection();
            if (typeof setActivePointFilters === 'function') setActivePointFilters(map, activeIdExpression(appliedResults));

            setResultsCount(appliedResults.length);
            renderResults();

            if (openResults) controller.showResultsPanel();
            if (typeof options.onApply === 'function') {
                options.onApply({ state: cloneState(appliedState), results: appliedResults.slice() });
            }
            syncApplyButtonState();
            return appliedResults.slice();
        }

        // restores every control to its unfiltered state
        function clearDraft() {
            if (search) search.value = '';
            document.querySelectorAll('.mode-filter, .supremacy-filter').forEach(box => { box.checked = true; });

            Object.entries(SELECT_FIELDS).forEach(([key, config]) => {
                const select = fieldControl(key, config.ids);
                if (select) select.value = '';
            });
            Object.values(MULTI_SELECT_FIELDS).forEach(config => {
                document.querySelectorAll(`.${config.checkboxClass}`).forEach(box => { box.checked = false; });
            });

            closeAllMultiSelects();
            Object.keys(MULTI_SELECT_FIELDS).forEach(syncMultiSelectLabel);

            if (city) city.value = '';
            if (county) county.value = '';
            if (significance) significance.value = '';
            if (significanceMetadata) significanceMetadata.value = '';
            if (significanceNomination) significanceNomination.value = '';
            if (significanceSeparated) significanceSeparated.checked = false;
            syncSignificanceMode();
            if (webPdf?.type === 'checkbox') webPdf.checked = false;
            document.querySelectorAll('[name="restricted-sites"], [name="restricted-filter"]').forEach(control => {
                control.checked = String(control.value).toLowerCase() === 'show';
            });
            if (restricted?.type === 'checkbox') restricted.checked = false;
            else if (restricted) restricted.value = restricted.querySelector?.('option[value="show"]') ? 'show' : '';

            sliders.reset();
            onDraftChange();
        }

        // switches visible tab content and updates roving tab focus
        function activateTab(tab, { animate = true } = {}) {
            if (!tab) return;
            closeAllMultiSelects();

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
            // removes the current height so the next natural height can be measured
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

        // results-mode idle chrome: dim after 5s off-panel, wake on hover
        const RESULTS_IDLE_DELAY_MS = 5000;
        const RESULTS_CHROME_RESTORE_MS = 120;
        let resultsIdleTimer = 0;
        let resultsChromeRestoreTimer = 0;

        function clearResultsIdleTimer() {
            if (!resultsIdleTimer) return;
            clearTimeout(resultsIdleTimer);
            resultsIdleTimer = 0;
        }

        function clearResultsChromeInline() {
            if (!shell) return;
            if (resultsChromeRestoreTimer) {
                clearTimeout(resultsChromeRestoreTimer);
                resultsChromeRestoreTimer = 0;
            }
            shell.style.removeProperty('transition');
            shell.style.removeProperty('--results-chrome-opacity');
        }

        // Chromium sticks @property --results-chrome-opacity at 0.5 after a CSS
        // transition to idle; removing the class alone does not restore. Pin the
        // current value with transition:none, reflow, then transition to 1.
        function restoreResultsChromeOpacity() {
            if (!shell) return;
            const raw = getComputedStyle(shell).getPropertyValue('--results-chrome-opacity').trim();
            const from = Number.parseFloat(raw);
            const start = Number.isFinite(from) ? from : 0.5;
            const durationMs = prefersReducedMotion ? 0 : RESULTS_CHROME_RESTORE_MS;

            if (resultsChromeRestoreTimer) {
                clearTimeout(resultsChromeRestoreTimer);
                resultsChromeRestoreTimer = 0;
            }

            shell.style.transition = 'none';
            shell.style.setProperty('--results-chrome-opacity', String(start));
            void shell.offsetWidth;

            if (durationMs <= 0) {
                shell.style.setProperty('--results-chrome-opacity', '1');
                clearResultsChromeInline();
                return;
            }

            shell.style.transition = `--results-chrome-opacity ${durationMs}ms ease`;
            shell.style.setProperty('--results-chrome-opacity', '1');
            resultsChromeRestoreTimer = setTimeout(() => {
                resultsChromeRestoreTimer = 0;
                clearResultsChromeInline();
            }, durationMs + 50);
        }

        function wakeResultsPanel() {
            clearResultsIdleTimer();
            if (!shell) return;
            const wasIdle = shell.classList.contains('is-results-idle');
            shell.classList.remove('is-results-idle');
            if (wasIdle) restoreResultsChromeOpacity();
        }

        function scheduleResultsIdle() {
            clearResultsIdleTimer();
            if (!shell?.classList.contains('is-open') || !shell.classList.contains('showing-results')) return;
            resultsIdleTimer = setTimeout(() => {
                resultsIdleTimer = 0;
                if (!shell.classList.contains('is-open') || !shell.classList.contains('showing-results')) return;
                clearResultsChromeInline();
                shell.classList.add('is-results-idle');
            }, RESULTS_IDLE_DELAY_MS);
        }

        // public panel API used by map and detail interactions
        const controller = {
            applyFilters,
            clearDraft,
            showResultsPanel() {
                if (shell) shell.classList.add('is-open', 'showing-results');
                if (resultsView) resultsView.hidden = false;
                if (detailView) detailView.hidden = true;
                if (resultsView) resultsView.setAttribute('aria-hidden', 'false');
                if (detailView) detailView.setAttribute('aria-hidden', 'true');
                wakeResultsPanel();
                if (shell && !shell.matches(':hover')) scheduleResultsIdle();
            },
            hideResultsPanel() {
                setSortMenuOpen(false);
                setExportMenuOpen(false);
                clearResultsIdleTimer();
                clearResultsChromeInline();
                if (shell) shell.classList.remove('is-open', 'showing-results', 'is-results-idle');
                if (resultsView) resultsView.hidden = true;
            },
            showDetail() {
                setSortMenuOpen(false);
                setExportMenuOpen(false);
                clearResultsIdleTimer();
                clearResultsChromeInline();
                if (shell) shell.classList.add('is-open');
                if (shell) shell.classList.remove('showing-results', 'is-results-idle');
                if (resultsView) resultsView.hidden = true;
                if (detailView) detailView.hidden = false;
                if (resultsView) resultsView.setAttribute('aria-hidden', 'true');
                if (detailView) detailView.setAttribute('aria-hidden', 'false');
            },
            getAppliedResults: () => appliedResults.slice(),
            getAppliedState: () => appliedState ? cloneState(appliedState) : null,
            // reapplies the saved state after the source data changes
            refreshResults() {
                appliedResults = sortFeatures(
                    features().filter(feature => featureMatchesAppliedFilters(feature, appliedState || readDraft())),
                    'name'
                );
                setResultsCount(appliedResults.length);
                renderResults();
                return appliedResults.slice();
            },
            // returns portaled menus and removes all panel side effects
            destroy() {
                if (tabHeightFrame) cancelAnimationFrame(tabHeightFrame);
                clearResultsIdleTimer();
                clearResultsChromeInline();
                clearTabContentHeight();
                setSortMenuOpen(false);
                setExportMenuOpen(false);
                closeAllMultiSelects();
                clearAllMultiSelectTypeahead();
                listeners.splice(0).forEach(remove => remove());
                if (window._nhlFilterPanelController === controller) window._nhlFilterPanelController = null;
            }
        };
        controller.showResults = controller.showResultsPanel;
        controller.restoreResults = controller.showResultsPanel;
        controller.closeResults = controller.hideResultsPanel;

        // build controls before applying the initial unfiltered state
        populateSelects();
        activateTab(tabButtons.find(tab => tab.getAttribute('aria-selected') === 'true') || tabButtons[0], { animate: false });
        updateDraftIndicators();
        syncSignificanceMode({ animate: false });
        listen(tabContent, 'transitionend', event => {
            if (event.target !== tabContent || event.propertyName !== 'height') return;
            clearTabContentHeight();
        });
        listen(applyButton, 'click', applyFilters);
        listen(clearButton, 'click', clearDraft);
        listen(closeButton, 'click', () => controller.hideResultsPanel());
        listen(shell, 'pointerenter', () => wakeResultsPanel());
        listen(shell, 'pointerleave', () => scheduleResultsIdle());
        listen(resultsSearch, 'input', () => {
            resultsQuery = resultsSearch.value || '';
            renderResults();
        });
        listen(resultsSortToggle, 'click', event => {
            event.preventDefault();
            setExportMenuOpen(false);
            const willOpen = resultsSortToggle.getAttribute('aria-expanded') !== 'true';
            setSortMenuOpen(willOpen, { focus: willOpen });
        });
        listen(resultsSortToggle, 'keydown', event => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            setSortMenuOpen(true, { focus: true, focusLast: event.key === 'ArrowUp' });
        });
        listen(resultsSortMenu, 'click', event => {
            const option = event.target.closest('[data-sort-value]');
            if (!option || !resultsSortMenu.contains(option)) return;
            selectSort(option.dataset.sortValue);
        });
        listen(resultsSortMenu, 'keydown', event => {
            const current = event.target.closest('[data-sort-value]');
            if (!current) return;
            const currentIndex = resultsSortOptions.indexOf(current);
            let targetIndex = currentIndex;
            if (event.key === 'ArrowDown') targetIndex = (currentIndex + 1) % resultsSortOptions.length;
            else if (event.key === 'ArrowUp') targetIndex = (currentIndex - 1 + resultsSortOptions.length) % resultsSortOptions.length;
            else if (event.key === 'Home') targetIndex = 0;
            else if (event.key === 'End') targetIndex = resultsSortOptions.length - 1;
            else if (event.key === 'Escape') {
                event.preventDefault();
                setSortMenuOpen(false);
                resultsSortToggle?.focus();
                return;
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectSort(current.dataset.sortValue);
                return;
            } else if (event.key === 'Tab') {
                setSortMenuOpen(false);
                return;
            } else {
                return;
            }
            event.preventDefault();
            resultsSortOptions[targetIndex]?.focus();
        });
        // keep hover, touch, and keyboard behavior on one accessible menu state
        listen(resultsExportRoot, 'pointerenter', () => setExportMenuOpen(true));
        listen(resultsExportRoot, 'pointerleave', () => setExportMenuOpen(false));
        listen(resultsExportRoot, 'focusout', event => {
            if (!resultsExportRoot?.contains(event.relatedTarget)) setExportMenuOpen(false);
        });
        listen(resultsExportToggle, 'click', event => {
            event.preventDefault();
            setSortMenuOpen(false);
            const willOpen = resultsExportToggle.getAttribute('aria-expanded') !== 'true';
            setExportMenuOpen(willOpen);
        });
        listen(resultsExportToggle, 'keydown', event => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            setSortMenuOpen(false);
            setExportMenuOpen(true, { focus: true, focusLast: event.key === 'ArrowUp' });
        });
        listen(resultsExportMenu, 'click', event => {
            const option = event.target.closest('[data-export-format]');
            if (!option || !resultsExportMenu.contains(option)) return;
            runExport(option.dataset.exportFormat);
        });
        listen(resultsExportMenu, 'keydown', event => {
            const current = event.target.closest('[data-export-format]');
            if (!current) return;
            const currentIndex = resultsExportOptions.indexOf(current);
            let targetIndex = currentIndex;
            if (event.key === 'ArrowDown') targetIndex = (currentIndex + 1) % resultsExportOptions.length;
            else if (event.key === 'ArrowUp') targetIndex = (currentIndex - 1 + resultsExportOptions.length) % resultsExportOptions.length;
            else if (event.key === 'Home') targetIndex = 0;
            else if (event.key === 'End') targetIndex = resultsExportOptions.length - 1;
            else if (event.key === 'Escape') {
                event.preventDefault();
                setExportMenuOpen(false);
                resultsExportToggle?.focus();
                return;
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                runExport(current.dataset.exportFormat);
                return;
            } else if (event.key === 'Tab') {
                setExportMenuOpen(false);
                return;
            } else {
                return;
            }
            event.preventDefault();
            resultsExportOptions[targetIndex]?.focus();
        });
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
        listen(significanceSeparated, 'change', syncSignificanceMode);
        document.querySelectorAll('#filter-panel input, #filter-panel select').forEach(control => {
            if (control === autoUpdateResults || control === modeSymbology) return;
            if (Object.values(MULTI_SELECT_FIELDS).some(config => control.classList.contains(config.checkboxClass))) return;
            listen(control, control.type === 'text' || control.type === 'search' ? 'input' : 'change', onDraftChange);
        });
        Object.entries(MULTI_SELECT_FIELDS).forEach(([key, config]) => {
            const toggle = byId(config.toggleId);
            const menu = byId(config.menuId);
            listen(toggle, 'click', event => {
                event.preventDefault();
                const willOpen = toggle?.getAttribute('aria-expanded') !== 'true';
                closeAllMultiSelects(willOpen ? key : null);
                setMultiSelectOpen(key, willOpen, { focusOption: willOpen });
            });
            listen(toggle, 'keydown', event => {
                if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                closeAllMultiSelects(key);
                setMultiSelectOpen(key, true, {
                    focusOption: true,
                    focusPosition: event.key === 'ArrowUp' ? 'last' : 'first'
                });
            });
            listen(menu, 'change', event => {
                if (!event.target?.classList?.contains(config.checkboxClass)) return;
                event.target.closest('[role="option"]')
                    ?.setAttribute('aria-selected', String(event.target.checked));
                onDraftChange();
            });
            listen(menu, 'keydown', event => handleMultiSelectMenuNavigation(key, event));
        });
        function repositionOpenMenus() {
            repositionOpenMultiSelectMenus();
            if (resultsSortToggle?.getAttribute('aria-expanded') === 'true') positionSortMenu();
        }

        listen(document, 'pointerdown', event => {
            if (resultsSortToggle?.getAttribute('aria-expanded') === 'true') {
                const sortRoot = resultsSortToggle.closest('.results-sort');
                if (!sortRoot?.contains(event.target) && !resultsSortMenu?.contains(event.target)) {
                    setSortMenuOpen(false);
                }
            }
            if (resultsExportToggle?.getAttribute('aria-expanded') === 'true' && !resultsExportRoot?.contains(event.target)) {
                setExportMenuOpen(false);
            }
            Object.entries(MULTI_SELECT_FIELDS).forEach(([key, config]) => {
                const toggle = byId(config.toggleId);
                const root = byId(config.rootId);
                const menu = byId(config.menuId);
                if (!root || toggle?.getAttribute('aria-expanded') !== 'true') return;
                if (root.contains(event.target) || menu?.contains(event.target)) return;
                setMultiSelectOpen(key, false);
            });
        });
        listen(window, 'resize', repositionOpenMenus);
        listen(document.querySelector('#filter-panel .filter-panel-body'), 'scroll', repositionOpenMenus);
        listen(resultsList, 'scroll', repositionOpenMenus);
        listen(document, 'keydown', event => {
            if (event.key === 'Escape') {
                if (resultsSortToggle?.getAttribute('aria-expanded') === 'true') {
                    setSortMenuOpen(false);
                    resultsSortToggle.focus();
                    return;
                }
                if (resultsExportToggle?.getAttribute('aria-expanded') === 'true') {
                    setExportMenuOpen(false);
                    resultsExportToggle.focus();
                    return;
                }
                const openKey = Object.keys(MULTI_SELECT_FIELDS).find(key => (
                    byId(MULTI_SELECT_FIELDS[key].toggleId)?.getAttribute('aria-expanded') === 'true'
                ));
                if (!openKey) return;
                setMultiSelectOpen(openKey, false);
                byId(MULTI_SELECT_FIELDS[openKey].toggleId)?.focus();
                return;
            }
            handleMultiSelectTypeaheadKeydown(event);
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
            if (event.target.closest('button, select, [role="tab"], .multi-select, .multi-select-menu')) return;
            if (isAutoUpdateEnabled() || !hasPendingFilterChanges()) return;
            event.preventDefault();
            applyFilters();
        });
        // source data is ready before the initial map filter and result count
        window._nhlFilterPanelController = controller;
        resultsSortOptions.forEach(option => {
            const selected = option.dataset.sortValue === selectedSort;
            option.setAttribute('aria-checked', String(selected));
            option.classList.toggle('is-selected', selected);
        });
        setSortMenuOpen(false);
        setExportMenuOpen(false);
        applyFilters({ openResults: false, clearSelection: false });
        syncApplyButtonState();
        controller.hideResultsPanel();
        return controller;
    }

    window.featureMatchesAppliedFilters = featureMatchesAppliedFilters;
    window.setupFilterPanel = setupFilterPanel;
})();
