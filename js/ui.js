
const NoneCondition = ["all",
    ["!=", ["coalesce", ["get", "Acknowledged"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Multiculturalism"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Valorization"], '0'], '1'], 
    ["!=", ["coalesce", ["get", "Erasure"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Colonization"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Nation_Building"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Settler_Colonization"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Slavery"], '0'], '1'],
    ["!=", ["coalesce", ["get", "State_Formation"], '0'], '1'],
    ["!=", ["coalesce", ["get", "Racial_Capitalism"], '0'], '1']
];

// flyTo on point select only when current zoom is below this level
const FLY_TO_MAX_ZOOM = 7;

$(document).ready(function() {
    mapInits();
    setTimeout(setupUI, 500);
    updateSidePanelVisibility();
});

function getSelectedSupremacyForms() {
    return Array.from(document.querySelectorAll('.supremacy-filter:checked')).map(cb => cb.value);
}

function getSelectedModes() {
    return Array.from(document.querySelectorAll('.mode-filter:checked')).map(cb => cb.value);
}

function updateFilterResultCount(count) {
    const resultCount = document.getElementById('filter-result-count');
    if (!resultCount) return;
    resultCount.textContent = `${count} ${count === 1 ? 'result' : 'results'}`;
}

function featureHasNoneCategories(props) {
    return [
        'Acknowledged', 'Multiculturalism', 'Valorization', 'Erasure',
        'Colonization', 'Nation_Building', 'Settler_Colonization',
        'Slavery', 'State_Formation', 'Racial_Capitalism'
    ].every(field => props[field] !== '1');
}

function featureMatchesGroupFilter(props, selected, noneSelected) {
    if (selected.length === 0) return false;
    if (noneSelected && featureHasNoneCategories(props)) return true;
    return selected.some(value => value !== 'None' && props[value] === '1');
}

function countFilteredFeatures(map, filterOptions) {
    const features = map._landmarkSourceData?.features || [];
    const {
        minYear,
        maxYear,
        yearField,
        supremacy,
        modes,
        states,
        isFullYearRange,
        isNoneSelected,
        isFOWSNoneSelected
    } = filterOptions;

    return features.reduce((count, feature) => {
        const props = feature.properties || {};

        if (!isFullYearRange) {
            const rawYear = props[yearField.property];
            if (yearField.excludeMultiple && rawYear === 'Multiple') return count;
            const year = Number(rawYear);
            if (!Number.isFinite(year) || year < minYear || year > maxYear) return count;
        }

        if (supremacy.length > 0 && !featureMatchesGroupFilter(props, supremacy, isFOWSNoneSelected)) {
            return count;
        }
        if (!featureMatchesGroupFilter(props, modes, isNoneSelected)) {
            return count;
        }
        if (states.length > 0) {
            const state = String(props.State || '').trim();
            if (!states.includes(state)) return count;
        }

        return count + 1;
    }, 0);
}

function formatCityState(props) {
    const city = (props.City || '').trim();
    const state = (props.State || '').trim();
    if (city && state) return `${city}, ${state}`;
    return city || state || '';
}

function hasUsableAddress(address) {
    const value = (address || '').trim();
    return value.length > 0 && !/^address restricted$/i.test(value);
}

function getCssDurationMs(variableName, fallbackMs) {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();
    const parsed = value.endsWith('ms')
        ? parseFloat(value)
        : parseFloat(value) * 1000;

    return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function showCopyFeedback(button) {
    const feedback = button.parentElement.querySelector('.copy-feedback');
    if (!feedback) return;

    feedback.classList.remove('fade-out');
    feedback.classList.add('visible');

    clearTimeout(feedback._hideTimer);
    clearTimeout(feedback._removeTimer);

    feedback._hideTimer = setTimeout(() => {
        feedback.classList.add('fade-out');
    }, 1000);

    feedback._removeTimer = setTimeout(() => {
        feedback.classList.remove('visible', 'fade-out');
    }, 1500);
}

function isValidWebPdfUrl(value) {
    // some strings in web pdf col are just text notes and not urls
    try {
        const url = new URL(String(value).trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function getActiveModesFromProps(props) {
    const modeFilters = Array.from(document.querySelectorAll('.mode-filter'));
    const activeModes = modeFilters 
        .filter(({ value }) => value !== 'None' && props[value] === '1')
        .map(checkbox => ({
            key: checkbox.value,
            label: checkbox.closest('label')?.textContent.trim() || checkbox.value
        }));

    if (activeModes.length) {
        return activeModes;
    }

    const noneFilter = modeFilters.find(({ value }) => value === 'None');
    return [{
        key: 'None',
        label: noneFilter?.closest('label')?.textContent.trim() || 'None'
    }];
}

function renderModePillsHtml(modes) {
    // renders the 'pills' for modes of representation in the side panel
    const pills = modes.map(({ key, label }) =>
        `<span class="mode-pill" data-mode="${key}">${label}</span>`
    ).join('');

    return `<div class="mode-pill-list">${pills}</div>`;
}

function renderHoverInfoIconHtml(label) {
    return `<span class="hover-info-trigger" tabindex="0" role="button" aria-label="More info about ${label}" data-hover-info="Placeholder text"><i class="fa-light fa-circle-info"></i></span>`;
}

function setupHoverInfoIcons(root = document) {
    if (typeof createHoverInfoBox !== 'function') return;

    const infoBox = setupHoverInfoIcons._infoBox || createHoverInfoBox({ offsetY: -8 });
    setupHoverInfoIcons._infoBox = infoBox;

    root.querySelectorAll('.hover-info-trigger').forEach(trigger => {
        if (trigger._hoverInfoInitialized) return; // only initialize once per trigger
        trigger._hoverInfoInitialized = true;

        const showInfo = (event) => {
            infoBox.show({ infoLines: [trigger.dataset.hoverInfo || 'Placeholder text'] }); //display placeholder if no info is provided
            if (event?.clientX && event?.clientY) {
                // position the info box relative to the mouse cursor
                infoBox.setPosition(event.clientX, event.clientY);
            } else {
                // position the info box relative to the trigger
                const rect = trigger.getBoundingClientRect();
                infoBox.setPosition(rect.left + rect.width / 2, rect.top);
            }
        };

        trigger.addEventListener('mouseenter', showInfo);
        trigger.addEventListener('mousemove', event => {
            infoBox.setPosition(event.clientX, event.clientY);
        });
        trigger.addEventListener('mouseleave', () => infoBox.hide());
        trigger.addEventListener('focus', showInfo);
        trigger.addEventListener('blur', () => infoBox.hide());
    });
}

function setupUI() {
    const yearSlider = setupYearSliderPanel();
    if (!yearSlider) {
        return;
    }

    // map instance and ui elements
    const map = window._nhlMapInstance;
    const filterToggle = document.getElementById('filter-toggle');
    const sidePanel = document.getElementById('side-panel');
    const spTitle = document.getElementById('side-panel-title');
    const spLocation = document.getElementById('side-panel-location');
    const spCityState = document.getElementById('side-panel-city-state');
    const locationLine = document.getElementById('location-line');
    const addressExpandBtn = document.getElementById('address-expand-btn');
    const spAddress = document.getElementById('side-panel-address');
    const addressText = spAddress?.querySelector('.address-text');
    const spClose = document.getElementById('side-panel-close');
    setupHoverInfoIcons(document);

    function filterAll() {
        const src = map.getSource('landmark-point-data');
        if (!src) {
            console.warn('GeoJSON source not found');
            return;
        }

        // get current filter values
        const [minYear, maxYear] = getYearSliderRange(yearSlider);
        const yearField = getCurrentYearField();
        const supremacy = getSelectedSupremacyForms();
        const modes = getSelectedModes();
        const states = typeof getSelectedStates === 'function' ? getSelectedStates() : [];
        const isFullYearRange = isFullYearSliderRange(yearSlider);
        // "None" selection
        const isNoneSelected = modes.includes("None");
        const isFOWSNoneSelected = supremacy.includes("None");
        let filterExpr = ["all"];
        if (!isFullYearRange) {
            if (yearField.excludeMultiple) {
                filterExpr.push(["!=", ["get", yearField.property], "Multiple"]);
            }
            // year filter
            filterExpr.push([
                "all",
                [">=", ["to-number", ["get", yearField.property]], minYear],
                ["<=", ["to-number", ["get", yearField.property]], maxYear]
            ]);
        }

        // supremacy filter
        if (supremacy.length > 0) {
            let supremacyExpr = ["any"];
            supremacy.forEach(s => {
                if (s !== "None") {
                    supremacyExpr.push(["==", ["get", s], "1"]);
                }
            });
            if (isFOWSNoneSelected) {
                supremacyExpr.push(NoneCondition);
            }
            filterExpr.push(supremacyExpr);
        }

        // modes filter
        if (modes.length > 0) {
            let modesExpr = ["any"];
            modes.forEach(m => {
                if (m !== "None") {
                    modesExpr.push(["==", ["get", m], "1"]);
                }
            });
            if (isNoneSelected) {
                modesExpr.push(NoneCondition);
            }
            filterExpr.push(modesExpr);
        } else {
            filterExpr.push(["==", ["literal", true], false]);
        }

        // US state filter (multi-select; empty = all states)
        if (states.length > 0) {
            filterExpr.push(["in", ["get", "State"], ["literal", states]]);
        }

        if (typeof setActivePointFilters === 'function') {
            // if the function is defined, use it to set the active point filters
            setActivePointFilters(map, filterExpr);
        } else {
            // if the function is not defined, use the default filter
            map.setFilter('landmarks', filterExpr);
            if (map.getLayer('nosymbologylandmark')) {
                map.setFilter('nosymbologylandmark', filterExpr);
            }
        }

        updateFilterResultCount(countFilteredFeatures(map, {
            minYear,
            maxYear,
            yearField,
            supremacy,
            modes,
            states,
            isFullYearRange,
            isNoneSelected,
            isFOWSNoneSelected
        }));
    }

    let sidePanelSwitchToken = 0;

    function fillSidePanelContent(props) {
        if (spTitle) spTitle.textContent = props.Historic_Name || 'Unknown Site';
        const cityState = formatCityState(props);
        const address = (props.Address || '').trim();
        const canShowAddress = hasUsableAddress(address);

        if (spLocation && spCityState) {
            spLocation.hidden = !cityState;
            spCityState.textContent = cityState;
        }

        if (addressExpandBtn && spAddress && locationLine) {
            addressExpandBtn.hidden = !canShowAddress;
            addressExpandBtn.innerHTML = '<i class="fa-duotone fa-regular fa-angle-down"></i>';
            spAddress.hidden = true;

            locationLine.classList.toggle('location-line-expandable', canShowAddress);
            locationLine.removeAttribute('role');
            locationLine.removeAttribute('tabindex');
            locationLine.removeAttribute('aria-expanded');
            locationLine.removeAttribute('aria-label');
            locationLine.onclick = null;
            locationLine.onkeydown = null;

            if (canShowAddress) {
                locationLine.setAttribute('role', 'button');
                locationLine.setAttribute('tabindex', '0');
                locationLine.setAttribute('aria-expanded', 'false');
                locationLine.setAttribute('aria-label', 'Show address');

                const toggleAddressExpand = () => {
                    const isExpanded = locationLine.getAttribute('aria-expanded') === 'true';
                    const nextExpanded = !isExpanded;
                    locationLine.setAttribute('aria-expanded', String(nextExpanded));
                    locationLine.setAttribute('aria-label', nextExpanded ? 'Hide address' : 'Show address');
                    addressExpandBtn.innerHTML = nextExpanded
                        ? '<i class="fa-duotone fa-regular fa-angle-up"></i>'
                        : '<i class="fa-duotone fa-regular fa-angle-down"></i>';
                    spAddress.hidden = !nextExpanded;
                };

                locationLine.onclick = toggleAddressExpand;
                locationLine.onkeydown = (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleAddressExpand();
                    }
                };
            }
        }

        if (addressText) {
            addressText.textContent = canShowAddress ? address : '';
        }

        const spDesc = document.getElementById('sp-desc');
        if (spDesc) {
            const refId = props.ReferenceID || 'Unknown';
            const webPdfUrl = props['Web PDF'];
            const webPdfLink = isValidWebPdfUrl(webPdfUrl) ? webPdfUrl.trim() : '';
            const nhlYear = props.NHL_Year || 'Unknown';
            const modesHtml = renderModePillsHtml(getActiveModesFromProps(props));
            const areaOfSignificance = props.Areas_of_Signifance_Nomination_Forms || 'None';

            spDesc.innerHTML = `
                <div class="side-panel-field">
                    <div class="side-panel-label">Reference ID</div>
                    <div class="side-panel-value reference-id-row">
                        <span class="reference-id-text">${refId}</span>
                        <span class="copy-ref-id-wrap">
                            <button type="button" class="copy-ref-id-btn" aria-label="Copy Reference ID">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <span class="copy-feedback" aria-hidden="true">Copied to clipboard!</span>
                        </span>
                    </div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Nomination Form ${renderHoverInfoIconHtml('Nomination Form')}</div>
                    <div class="side-panel-value">${webPdfLink ? `<a href="${webPdfLink}" target="_blank" rel="noopener" style="color: var(--filter-gold);">View Nomination Form <i style="font-size: 0.75rem; margin-bottom: 0.01rem;" class="fa-solid fa-arrow-up-right-from-square"></i></a>` : 'No Web PDF available.'}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Year Designated ${renderHoverInfoIconHtml('Year Designated')}</div>
                    <div class="side-panel-value">${nhlYear}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Modes of Representation</div>
                    <div class="side-panel-value">${modesHtml}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Area of Significance ${renderHoverInfoIconHtml('Area of Significance')}</div>
                    <div class="side-panel-value">${areaOfSignificance}</div>
                </div>
            `;
            setupHoverInfoIcons(spDesc);

            const copyBtn = spDesc.querySelector('.copy-ref-id-btn');
            const refText = spDesc.querySelector('.reference-id-text');
            if (copyBtn && refText) {
                copyBtn.addEventListener('click', () => {
                    const id = refText.textContent.trim();
                    if (!id || id === 'Unknown') return;
                    navigator.clipboard.writeText(id).then(() => showCopyFeedback(copyBtn));
                });
            }
        }

        updateSidePanelVisibility();
    }

    function selectLandmark(feature) {
        // select the landmark and update the map and side panel
        const props = feature.properties;
        const coordinates = feature.geometry.coordinates.slice();
        const mapInstance = window._nhlMapInstance;
        const previousId = mapInstance._selectedFeatureId;
        const isContentSwitch = sidePanel?.classList.contains('is-open')
            && previousId != null
            && previousId !== feature.id;

        mapInstance._selectedFeatureId = feature.id;
        if (typeof setSelectedPointFilters === 'function') {
            setSelectedPointFilters(mapInstance);
        }

        if (map.getZoom() < FLY_TO_MAX_ZOOM) {
            map.flyTo({
                center: coordinates,
                zoom: 13
            });
        }

        const switchToken = ++sidePanelSwitchToken;

        if (isContentSwitch) {
            sidePanel.classList.add('is-switching');
            setTimeout(() => {
                if (switchToken !== sidePanelSwitchToken) return;
                fillSidePanelContent(props);
                requestAnimationFrame(() => {
                    if (switchToken !== sidePanelSwitchToken) return;
                    sidePanel.classList.remove('is-switching');
                });
            }, getCssDurationMs('--side-panel-content-fade-duration', 100));
            return;
        }

        sidePanel?.classList.remove('is-switching');
        fillSidePanelContent(props);
    }

    function onSourceReady() {
        setupSearchPanel(map, selectLandmark, filterAll);

        onYearSliderUpdate(yearSlider, function() {
            filterAll();
        });

        // modes of rep switch function
        document.querySelectorAll('.supremacy-filter, .mode-filter').forEach(cb => {
            cb.addEventListener('change', filterAll);
            let label = cb.closest('label');
            if (!label) {
                if (cb.id) {
                    label = document.querySelector('label[for="' + cb.id + '"]');
                }
            }
            const rightClickHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const checkbox = cb;
                const groupClass = checkbox.classList.contains('supremacy-filter') ? 'supremacy-filter' : 'mode-filter';
                const groupBoxes = Array.from(document.querySelectorAll('.' + groupClass));
                const onlyThisChecked = groupBoxes.every(box => (box === checkbox ? box.checked : !box.checked));
                if (onlyThisChecked) {
                    groupBoxes.forEach(box => { box.checked = true; });
                } else {
                    groupBoxes.forEach(box => { box.checked = (box === checkbox); });
                }
                filterAll();
            };
            cb.addEventListener('contextmenu', rightClickHandler);
            if (label) {
                label.addEventListener('contextmenu', function(e) {
                    rightClickHandler(e);
                });
            }
        });
        filterAll();
    }

    if (map.isStyleLoaded() && map.getSource('landmark-point-data')) {
        onSourceReady();
    } else {
        map.on('sourcedata', function check(e) {
            if (e.sourceId === 'landmark-point-data' && map.getSource('landmark-point-data')) {
                map.off('sourcedata', check);
                onSourceReady();
            }
        });
    }

    // filter section collapse toggles
    const filterSections = [];

    const syncFilterToggle = () => {
        // syncs both individual section toggles + the main large toggle
        if (!filterToggle) return;
        const allCollapsed = filterSections.length > 0 && filterSections.every(({ section }) => section.classList.contains('is-collapsed'));
        const expanded = !allCollapsed;
        filterToggle.setAttribute('aria-expanded', String(expanded));
        filterToggle.setAttribute('aria-label', expanded ? 'Collapse filters' : 'Expand filters');
        filterToggle.innerHTML = expanded
            ? '<i class="fa-duotone fa-regular fa-angle-up" aria-hidden="true"></i>'
            : '<i class="fa-duotone fa-regular fa-angle-down" aria-hidden="true"></i>';
    };

    document.querySelectorAll('.filter-section').forEach(section => {
        // for each filter section, add a toggle to collapse/expand the section
        const sectionToggle = section.querySelector('.filter-section-toggle');
        const sectionOptions = section.querySelector('.filter-section-options');
        if (!sectionToggle || !sectionOptions) return;

        let sectionAnimating = false; // prevents multiple animations from happening at once
        const sectionLabel = sectionToggle.getAttribute('aria-label')?.replace(/^Collapse\s+|^Expand\s+/, '') || 'section';

        const setSectionExpanded = (expanded) => {
            if (sectionAnimating || section.classList.contains('is-collapsed') === !expanded) {
                if (!sectionAnimating) syncFilterToggle();
                return;
            }
            sectionAnimating = true;
            const transitionMs = getCssDurationMs('--filter-collapse-duration', 200);
            let completionTimer;

            const onTransitionEnd = (event) => {
                if (event.target !== sectionOptions || event.propertyName !== 'height') return;
                finish();
            };

            const finish = () => {
                window.clearTimeout(completionTimer);
                sectionOptions.removeEventListener('transitionend', onTransitionEnd);
                if (expanded) {
                    sectionOptions.style.height = 'auto';
                }
                sectionAnimating = false;
            };

            sectionOptions.addEventListener('transitionend', onTransitionEnd);
            sectionToggle.setAttribute('aria-expanded', String(expanded));
            sectionToggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${sectionLabel}`);

            if (expanded) {
                // if expanded, remove the collapsed class and set the height to the scroll height
                section.classList.remove('is-collapsed');
                sectionOptions.style.height = '0px';
                sectionOptions.offsetHeight;
                sectionOptions.style.height = `${sectionOptions.scrollHeight}px`;
                sectionToggle.innerHTML = '<i class="fa-duotone fa-regular fa-angle-up" aria-hidden="true"></i>';
            } else {
                // if collapsed, set the height to the scroll height and then set it to 0
                sectionOptions.style.height = `${sectionOptions.scrollHeight}px`;
                sectionOptions.offsetHeight;
                section.classList.add('is-collapsed'); 
                sectionOptions.style.height = '0px'; 
                sectionToggle.innerHTML = '<i class="fa-duotone fa-regular fa-angle-down" aria-hidden="true"></i>'; // update the toggle icon
            }

            syncFilterToggle(); // sync the main large toggle

            if (transitionMs === 0) {
                finish();
            } else {
                completionTimer = window.setTimeout(finish, transitionMs + 50);
            }
        };

        filterSections.push({ section, setSectionExpanded });

        const sectionHeader = section.querySelector('.filter-section-header');
        if (!sectionHeader) return;

        sectionHeader.addEventListener('click', (event) => {
            // keep the info icon from collapsing the section
            if (event.target.closest('.hover-info-trigger')) return;
            setSectionExpanded(section.classList.contains('is-collapsed'));
        });
    });

    if (filterToggle) {
        filterToggle.addEventListener('click', () => {
            const allCollapsed = filterSections.every(({ section }) => section.classList.contains('is-collapsed'));
            filterSections.forEach(({ setSectionExpanded }) => setSectionExpanded(allCollapsed));
        });
    }

    if (spClose && sidePanel) {
        spClose.addEventListener('click', () => {
            const mapInstance = window._nhlMapInstance;
            if (mapInstance && mapInstance._selectedFeatureId !== null) {
                mapInstance._selectedFeatureId = null;
                if (typeof setSelectedPointFilters === 'function') {
                    setSelectedPointFilters(mapInstance);
                }
            }
            updateSidePanelVisibility();
        });
    }

    window.addEventListener('resize', () => {
        updateSidePanelHeaderMargin();
    });

    const handleLandmarkClick = (e) => {
        selectLandmark(e.features[0]);
    };
    map.on('click', 'backgroundlandmark', handleLandmarkClick);
    map.on('click', 'backgroundlandmark-selected', handleLandmarkClick);
    map.on('click', 'nosymbologylandmark', handleLandmarkClick);
    map.on('click', 'nosymbologylandmark-selected', handleLandmarkClick);
    map.on('click', 'landmarks', handleLandmarkClick);
    map.on('click', 'landmarks-selected', handleLandmarkClick);
}

function updateSidePanelHeaderMargin() {
    const title = document.getElementById('side-panel-title');
    const header = title?.closest('.side-panel-header');
    if (!title || !header) return;

    const sidePanel = document.getElementById('side-panel');
    if (!sidePanel || !sidePanel.classList.contains('is-open')) {
        header.classList.remove('multiline');
        return;
    }

    const range = document.createRange();
    range.selectNodeContents(title);
    header.classList.toggle('multiline', range.getClientRects().length > 1);
}

function updateSidePanelVisibility() {
    // prevents empty side panel on refresh
    const sidePanel = document.getElementById('side-panel');
    const mapInstance = window._nhlMapInstance;
    if (sidePanel) {
        if (mapInstance && mapInstance._selectedFeatureId != null) {
            sidePanel.classList.add('is-open');
            requestAnimationFrame(updateSidePanelHeaderMargin);
        } else {
            sidePanel.classList.remove('is-open', 'is-switching');
        }
    }
}
