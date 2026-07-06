
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
const YEAR_SLIDER_MIN = 1950;
const YEAR_SLIDER_MAX = 2026;

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
    const yearSlider = document.getElementById('year-slider');
    const yearReset = document.getElementById('year-reset');

    if (!yearSlider) {
        console.warn('Year slider element not found');
        return;
    }

    // initialize noUiSlider
    noUiSlider.create(yearSlider, {
        start: [YEAR_SLIDER_MIN, YEAR_SLIDER_MAX],
        step: 1,
        range: {
            min: YEAR_SLIDER_MIN,
            max: YEAR_SLIDER_MAX
        },
        connect: true,
        tooltips: true,
        behaviour: 'drag',
        format: {
            to: value => Math.round(value),
            from: value => Number(value)
        }
    });

    const map = window._nhlMapInstance;

    function filterAll() {
        const src = map.getSource('landmark-point-data');
        if (!src) {
            console.warn('GeoJSON source not found');
            return;
        }

        // get current filter values
        const range = yearSlider.noUiSlider.get();
        const minYear = parseInt(range[0]);
        const maxYear = parseInt(range[1]);
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
            setActivePointFilters(map, filterExpr);
        } else {
            map.setFilter('landmarks', filterExpr);
            if (map.getLayer('nosymbologylandmark')) {
                map.setFilter('nosymbologylandmark', filterExpr);
            }
        }
    }

    function onSourceReady() {
        yearSlider.noUiSlider.on('update', function(values, handle) {
            filterAll();
        });

        if (yearReset) {
            yearReset.addEventListener('click', function() {
                yearSlider.noUiSlider.set([YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]);
            });
        }

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
    const filterToggle = document.getElementById('filter-toggle');
    const filterContent = document.getElementById('filter-content');
    const sidePanel = document.getElementById('side-panel');
    const spTitle = document.getElementById('side-panel-title');
    const spClose = document.getElementById('side-panel-close');

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

    const handleLandmarkClick = (e) => {
        const feature = e.features[0];
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

            spDesc.innerHTML = `
                <div><strong>Reference ID:</strong> ${refId}</div>
                <div><strong>Nomination Form:</strong> ${webPdfLink ? `<a href="${webPdfLink}" target="_blank" rel="noopener">View Nomination Form</a>` : 'No Web PDF available.'}</div>
                <div><strong>Year Designated:</strong> ${nhlYear}</div>
                <div><strong>Modes of Representation:</strong> ${modesText}</div>
                <div><strong>Area of Significance:</strong> ${areaOfSignificance}</div>
            `;
        }
    };
    map.on('click', 'backgroundlandmark', handleLandmarkClick);
    map.on('click', 'backgroundlandmark-selected', handleLandmarkClick);
    map.on('click', 'nosymbologylandmark', handleLandmarkClick);
    map.on('click', 'nosymbologylandmark-selected', handleLandmarkClick);
    map.on('click', 'landmarks', handleLandmarkClick);
    map.on('click', 'landmarks-selected', handleLandmarkClick);
}

function updateSidePanelVisibility() {
    // prevents empty side panel on refresh
    const sidePanel = document.getElementById('side-panel');
    const mapInstance = window._nhlMapInstance;
    if (sidePanel) {
        if (mapInstance && mapInstance._selectedFeatureId != null) {
            sidePanel.style.display = 'flex';
        } else {
            sidePanel.style.display = 'none';
        }
    }
}
