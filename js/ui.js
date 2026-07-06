
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

function showCopyFeedback(button) {
    const feedback = button.parentElement.querySelector('.copy-ref-id-feedback');
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

function setupUI() {
    const yearSlider = setupYearSliderPanel();
    if (!yearSlider) {
        return;
    }

    // map instance and ui elements
    const map = window._nhlMapInstance;
    const filterToggle = document.getElementById('filter-toggle');
    const filterContent = document.getElementById('filter-content');
    const sidePanel = document.getElementById('side-panel');
    const spTitle = document.getElementById('side-panel-title');
    const spClose = document.getElementById('side-panel-close');

    function filterAll() {
        const src = map.getSource('landmark-point-data');
        if (!src) {
            console.warn('GeoJSON source not found');
            return;
        }

        // get current filter values
        const [minYear, maxYear] = getYearSliderRange(yearSlider);
        const supremacy = getSelectedSupremacyForms();
        const modes = getSelectedModes();
        const isFullYearRange = minYear === YEAR_SLIDER_MIN && maxYear === YEAR_SLIDER_MAX;
        // "None" selection
        const isNoneSelected = modes.includes("None");
        const isFOWSNoneSelected = supremacy.includes("None");
        let filterExpr = ["all"];
        if (!isFullYearRange) {
            filterExpr.push(["!=", ["get", "Form Year"], "Multiple"]);
            // year filter
            filterExpr.push([
                "all",
                [">=", ["to-number", ["get", "Form Year"]], minYear],
                ["<=", ["to-number", ["get", "Form Year"]], maxYear]
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
    }

    function selectLandmark(feature) {
        // select the landmark and update the map and side panel
        const props = feature.properties;
        const coordinates = feature.geometry.coordinates.slice();

        const mapInstance = window._nhlMapInstance;
        mapInstance._selectedFeatureId = feature.id;
        if (typeof setSelectedPointFilters === 'function') {
            setSelectedPointFilters(mapInstance);
        }

        map.flyTo({
            center: coordinates,
            zoom: 13
        });

        if (spTitle) spTitle.textContent = props.Historic_Name || 'Unknown Site';
        updateSidePanelVisibility();
        // web pdf link in sidepanel
        const spDesc = document.getElementById('sp-desc');
        if (spDesc) {
            const refId = props.ReferenceID || 'Unknown';
            const webPdfUrl = props['Web PDF'];
            const webPdfLink = isValidWebPdfUrl(webPdfUrl) ? webPdfUrl.trim() : '';
            const nhlYear = props.NHL_Year || 'Unknown';
            const modesText = [
                props.Acknowledged === '1' ? 'Acknowledged' : '',
                props.Multiculturalism === '1' ? 'Multiculturalism' : '',
                props.Valorization === '1' ? 'Valorization' : '',
                props.Erasure === '1' ? 'Erasure' : ''
            ].filter(Boolean).join(', ') || 'None';
            const areaOfSignificance = props.Areas_of_Signifance_Nomination_Forms || 'None';

            // create the side panel description
            spDesc.innerHTML = `
                <div class="side-panel-field">
                    <div class="side-panel-label">Reference ID</div>
                    <div class="side-panel-value reference-id-row">
                        <span class="reference-id-text">${refId}</span>
                        <span class="copy-ref-id-wrap">
                            <button type="button" class="copy-ref-id-btn" aria-label="Copy Reference ID">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <span class="copy-ref-id-feedback" aria-hidden="true">Copied to clipboard!</span>
                        </span>
                    </div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Nomination Form</div>
                    <div class="side-panel-value">${webPdfLink ? `<a href="${webPdfLink}" target="_blank" rel="noopener" style="color: var(--filter-gold);">View Nomination Form <i style="font-size: 0.75rem; margin-bottom: 0.01rem;" class="fa-solid fa-arrow-up-right-from-square"></i></a>` : 'No Web PDF available.'}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Year Designated</div>
                    <div class="side-panel-value">${nhlYear}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Modes of Representation</div>
                    <div class="side-panel-value">${modesText}</div>
                </div>
                <div class="side-panel-field">
                    <div class="side-panel-label">Area of Significance</div>
                    <div class="side-panel-value">${areaOfSignificance}</div>
                </div>
            `;

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
    }

    function onSourceReady() {
        setupSearchPanel(map, selectLandmark);

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

    //sidebar and filter toggle
    if (filterToggle && filterContent) {
        filterToggle.addEventListener('click', function() {
            const isHidden = filterContent.style.display === 'none';
            filterContent.style.display = isHidden ? 'block' : 'none';
            filterToggle.innerHTML = isHidden ? '<i class="fa-duotone fa-regular fa-angle-up"></i>' : '<i class="fa-duotone fa-regular fa-angle-down"></i>';
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

    window.addEventListener('resize', updateSidePanelHeaderMargin);

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
    if (!sidePanel || sidePanel.style.display === 'none') {
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
            sidePanel.style.display = 'flex';
            requestAnimationFrame(updateSidePanelHeaderMargin);
        } else {
            sidePanel.style.display = 'none';
        }
    }
}
