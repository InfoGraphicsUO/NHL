$(document).ready(function() {
    mapInits();
    setTimeout(setupUI, 500);
});

function getSelectedSupremacyForms() {
    return Array.from(document.querySelectorAll('.supremacy-filter:checked')).map(cb => cb.value);
}

function getSelectedModes() {
    return Array.from(document.querySelectorAll('.mode-filter:checked')).map(cb => cb.value);
}

function setupUI() {
    console.log('setupUI()');
    const yearSlider = document.getElementById('year-slider');
    const yearValue = document.getElementById('year-value');
    if (!(yearSlider && yearValue)) {
        console.warn('Year slider or value element not found');
        return;
    }
    yearValue.textContent = yearSlider.value;

    const map = window._nhlMapInstance;
    let originalData = null;

    function filterAll() {
        const src = map.getSource('landmark-point-data');
        if (!src) {
            console.warn('GeoJSON source not found');
            return;
        }
        // using raw data for filtering
        if (!originalData) {
            let data = src._data;
            if (typeof data === 'string') {
                // get features from the rendered layer
                const features = map.querySourceFeatures('landmark-point-data');
                if (!features.length) {
                    console.warn('No features found in rendered source');
                    return;
                }
                data = { type: 'FeatureCollection', features: features.map(f => f.toJSON ? f.toJSON() : f) };
            }
            if (data && Array.isArray(data.features)) {
                originalData = data;
            } else {
                console.warn('GeoJSON data is not ready or invalid');
                return;
            }
        }
        // get current filter values
        const year = parseInt(document.getElementById('year-slider').value);
        const supremacy = getSelectedSupremacyForms();
        const modes = getSelectedModes();
        const filtered = {
            ...originalData,
            features: originalData.features.filter(f => {
                const formYear = parseInt(f.properties["Form Year"]);
                // at least one checked supremacy and one checked mode must match
                let supremacyMatch = supremacy.length === 0 ? true : supremacy.some(s => f.properties[s] === "1");
                let modeMatch = modes.length === 0 ? true : modes.some(m => f.properties[m] === "1");
                return (!isNaN(formYear) && formYear <= year) && supremacyMatch && modeMatch;
            })
        };
        src.setData(filtered);
        // console.log('Filtered features count:', filtered.features.length);
    }

    function onSourceReady() {
        yearSlider.addEventListener('input', function() {
            yearValue.textContent = this.value;
            filterAll();
        });
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
}