// internal demo tool: banner controls for flying to a landmark on a countdown
const RECORDING_COUNTDOWN_SECONDS = 5;

function setupRecordingControls(map, selection) {
    const root = document.documentElement;
    const toggle = document.getElementById('recording-toggle');
    const form = document.getElementById('recording-form');
    const landmarkSelect = document.getElementById('recording-landmark');
    const zoomInput = document.getElementById('recording-zoom');
    const peakZoomInput = document.getElementById('recording-peak-zoom');
    const speedInput = document.getElementById('recording-speed');
    const startButton = document.getElementById('recording-start');
    const resetButton = document.getElementById('recording-reset');
    const status = document.getElementById('recording-status');
    const panelBoxes = Array.from(document.querySelectorAll('.recording-panel-toggle'));
    const resultsBox = panelBoxes.find(box => box.value === 'results');
    const backgroundSitesBox = document.getElementById('recording-background-sites');
    const plainMarkersBox = document.getElementById('recording-plain-markers');
    const sidePanel = document.getElementById('side-panel');
    const features = map._landmarkSourceData.features;

    let countdownTimer = 0;
    // moveend also fires when a flight is interrupted, so stale flights are ignored by id
    let flightId = 0;

    features
        .filter(feature => feature.properties.Historic_Name)
        .map(feature => {
            const name = displayValue(feature.properties.Historic_Name);
            const place = formatCityState(feature.properties);
            return { id: feature.id, label: place ? `${name} (${displayValue(place)})` : name };
        })
        .sort((a, b) => comparePresentText(a.label, b.label))
        .forEach(({ id, label }) => landmarkSelect.add(new Option(label, id)));

    function stopCountdown() {
        clearInterval(countdownTimer);
        countdownTimer = 0;
        startButton.textContent = 'Start';
        startButton.formNoValidate = false;
    }

    function cancelRun(message = '') {
        stopCountdown();
        flightId += 1;
        status.textContent = message;
    }

    // panel settings only apply while the controls are showing in Explore
    function syncControls() {
        const open = toggle.checked && window._nhlViewSwitcher?.getView() === 'explore';
        form.hidden = !open;
        panelBoxes.forEach(box => {
            root.classList.toggle(`recording-hide-${box.value}`, open && !box.checked);
        });

        // grey filtered-out points hide so playing the year filter shows sites appearing
        setLayerVisibility(map, BACKGROUND_LAYERS, open && !backgroundSitesBox.checked ? 'none' : 'visible');
        setPlainMarkers(map, open && plainMarkersBox.checked);

        // a checked box should always mean a visible panel
        if (open && resultsBox.checked && !sidePanel.classList.contains('is-open')) {
            window._nhlFilterPanelController?.showResultsPanel();
        }
    }

    function flyToLandmark(feature, zoom, peakZoom, speed) {
        map.stop();
        const id = ++flightId;
        status.textContent = 'Flying...';
        map.once('moveend', () => {
            if (id !== flightId) return;
            selection.select(feature, { recenter: false });
            status.textContent = 'Arrived';
        });
        map.flyTo({
            center: feature.geometry.coordinates,
            zoom,
            // zoom out to this level mid-flight so the whole country shows between landmarks
            minZoom: peakZoom,
            speed,
            essential: true
        });
    }

    function startCountdown() {
        // read now because the form is only validated on submit
        const feature = features.find(item => String(item.id) === landmarkSelect.value);
        const zoom = zoomInput.valueAsNumber;
        const peakZoom = peakZoomInput.valueAsNumber;
        const speed = speedInput.valueAsNumber;
        let remaining = RECORDING_COUNTDOWN_SECONDS;
        status.textContent = `Flying in ${remaining}...`;
        startButton.textContent = 'Cancel';
        // cancelling must work even if a field was edited to something invalid
        startButton.formNoValidate = true;
        countdownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) {
                status.textContent = `Flying in ${remaining}...`;
                return;
            }
            stopCountdown();
            flyToLandmark(feature, zoom, peakZoom, speed);
        }, 1000);
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (countdownTimer) {
            cancelRun('Cancelled');
            return;
        }
        cancelRun();
        map.stop();
        startCountdown();
    });

    resetButton.addEventListener('click', () => {
        cancelRun();
        map.stop();
        selection.clear();
        window._nhlFilterPanelController?.showResultsPanel();
        map.jumpTo({ ...NHL_MAP_HOME, bearing: 0, pitch: 0 });
    });

    toggle.addEventListener('change', () => {
        if (!toggle.checked) cancelRun();
        syncControls();
    });
    panelBoxes.forEach(box => box.addEventListener('change', syncControls));
    backgroundSitesBox.addEventListener('change', syncControls);
    plainMarkersBox.addEventListener('change', syncControls);

    // closing the panel with its own button is the same as unchecking it
    document.getElementById('results-panel-close').addEventListener('click', () => {
        resultsBox.checked = false;
        syncControls();
    });

    window.addEventListener('nhl:viewchange', () => {
        cancelRun();
        syncControls();
    });

    toggle.disabled = false;
}
