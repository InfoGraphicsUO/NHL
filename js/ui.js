
// only recenter selected points when the map is still at a broad view
const FLY_TO_MAX_ZOOM = 7;

$(document).ready(function() {
    mapInits();
    setTimeout(setupUI, 500);
    updateSidePanelVisibility();
});

// builds the compact location line shown in landmark details
function formatCityState(props) {
    const city = (props.City || '').trim();
    const state = (props.State || '').trim();
    if (city && state) return `${city}, ${state}`;
    return city || state || '';
}

// hides placeholder addresses that are not useful to visitors
function hasUsableAddress(address) {
    const value = (address || '').trim();
    return value.length > 0 && !/^address restricted$/i.test(value);
}

// reads a css duration and converts seconds to milliseconds for settimeout
function getCssDurationMs(variableName, fallbackMs) {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();
    const parsed = value.endsWith('ms')
        ? parseFloat(value)
        : parseFloat(value) * 1000;

    return Number.isFinite(parsed) ? parsed : fallbackMs;
}

// briefly shows the copied confirmation beside a reference id
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

// accepts only usable external links from the web pdf column
function isValidWebPdfUrl(value) {
    // some web pdf values are notes instead of urls
    try {
        const url = new URL(String(value).trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// finds the representation modes enabled on a landmark
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

// returns the representation pills used in the detail panel
function renderModePillsHtml(modes) {
    const pills = modes.map(({ key, label }) =>
        `<span class="mode-pill" data-mode="${key}">${label}</span>`
    ).join('');

    return `<div class="mode-pill-list">${pills}</div>`;
}

function renderHoverInfoIconHtml(label) {
    return `<span class="hover-info-trigger" tabindex="0" role="button" aria-label="More info about ${label}" data-hover-info="Placeholder text"><i class="fa-light fa-circle-info"></i></span>`;
}

// wires mouse and keyboard events to one shared hover tooltip
function setupHoverInfoIcons(root = document) {
    if (typeof createHoverInfoBox !== 'function') return;

    const infoBox = setupHoverInfoIcons._infoBox || createHoverInfoBox({ offsetY: -8 });
    setupHoverInfoIcons._infoBox = infoBox;

    root.querySelectorAll('.hover-info-trigger').forEach(trigger => {
        // avoid duplicate listeners when a detail panel rerenders
        if (trigger._hoverInfoInitialized) return;
        trigger._hoverInfoInitialized = true;

        const showInfo = (event) => {
            infoBox.show({ infoLines: [trigger.dataset.hoverInfo || 'Placeholder text'] });

            if (event?.clientX && event?.clientY) {
                // pointer events keep the tooltip beside the cursor
                infoBox.setPosition(event.clientX, event.clientY);
            } else {
                // keyboard focus anchors the tooltip to its trigger
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

// connects map selection events to the shared results and detail panel
function setupUI() {
    const map = window._nhlMapInstance;
    if (!map) {
        console.warn('Map instance not found');
        return;
    }
    // cache the shared shell elements used during selection changes
    const sidePanel = document.getElementById('side-panel');
    const resultsView = document.getElementById('results-view');
    const detailView = document.getElementById('detail-view');
    const detailBack = document.getElementById('detail-back');
    const spTitle = document.getElementById('side-panel-title');
    const spLocation = document.getElementById('side-panel-location');
    const spCityState = document.getElementById('side-panel-city-state');
    const locationLine = document.getElementById('location-line');
    const addressExpandBtn = document.getElementById('address-expand-btn');
    const spAddress = document.getElementById('side-panel-address');
    const addressText = spAddress?.querySelector('.address-text');
    const spClose = document.getElementById('side-panel-close');
    setupHoverInfoIcons(document);

    let sidePanelSwitchToken = 0;

    // fills landmark metadata and resets address disclosure state
    function fillSidePanelContent(props) {
        if (spTitle) spTitle.textContent = props.Historic_Name || 'Unknown Site';
        const cityState = formatCityState(props);
        const address = (props.Address || '').trim();
        const canShowAddress = hasUsableAddress(address);

        if (spLocation && spCityState) {
            spLocation.hidden = !cityState;
            spCityState.textContent = cityState;
        }

        // only make the location row interactive for real addresses
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

        // rebuild details so each selection uses current landmark properties
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

    // selects one map feature and opens its detail view
    function selectLandmark(feature) {
        if (!feature?.properties || !feature?.geometry?.coordinates) return;

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

        // the filter controller owns the shared results and detail shell
        const filterController = window._nhlFilterPanelController || window._filterPanelController;
        if (typeof filterController?.showDetail === 'function') {
            filterController.showDetail(feature);
        } else {
            if (resultsView) resultsView.hidden = true;
            if (detailView) detailView.hidden = false;
            sidePanel?.classList.add('is-open');
        }

        // preserve a close view while helping users orient from a wide view
        if (map.getZoom() < FLY_TO_MAX_ZOOM) {
            map.flyTo({
                center: coordinates,
                zoom: 13
            });
        }

        const switchToken = ++sidePanelSwitchToken;

        // wait for the outgoing content fade before replacing it
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

    // clears map selection and returns the shared shell to results
    function clearLandmarkSelection({ restoreResults = true } = {}) {
        sidePanelSwitchToken += 1;
        map._selectedFeatureId = null;
        if (typeof setSelectedPointFilters === 'function') {
            setSelectedPointFilters(map);
        }

        sidePanel?.classList.remove('is-switching');
        if (detailView) detailView.hidden = true;
        if (restoreResults && resultsView) resultsView.hidden = false;
        if (restoreResults) sidePanel?.classList.add('is-open');
        updateSidePanelVisibility();
    }

    // starts filtering only after the map source is available
    function onSourceReady() {
        if (typeof window.setupFilterPanel !== 'function') {
            console.warn('Filter panel controller not found');
            return;
        }

        // filtering owns draft and applied state while ui owns landmark selection
        window._filterPanelController = window.setupFilterPanel({
            map,
            onSelectLandmark: selectLandmark,
            onClearSelection: clearLandmarkSelection
        });
    }

    // source data can arrive after the map style has already loaded
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

    // keep legacy markup functional while the shared detail back button rolls out
    if (spClose && spClose !== detailBack && !detailBack) {
        spClose.addEventListener('click', () => clearLandmarkSelection());
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

// flags titles that wrap so the detail header can adjust its spacing
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

// keeps the side panel aligned with selected feature and results state
function updateSidePanelVisibility() {
    const sidePanel = document.getElementById('side-panel');
    const resultsView = document.getElementById('results-view');
    const detailView = document.getElementById('detail-view');
    const mapInstance = window._nhlMapInstance;
    if (!sidePanel) return;

    if (mapInstance && mapInstance._selectedFeatureId != null) {
        sidePanel.classList.add('is-open');
        if (resultsView) resultsView.hidden = true;
        if (detailView) detailView.hidden = false;
        requestAnimationFrame(updateSidePanelHeaderMargin);
        return;
    }

    sidePanel.classList.remove('is-switching');
    if (detailView) detailView.hidden = true;

    // the filter controller owns panel visibility when the shared results shell exists
    if (!resultsView) {
        sidePanel.classList.remove('is-open');
    }
}
