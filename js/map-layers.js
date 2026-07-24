const ALL_POINTS_FILTER = ['==', ['literal', true], true];
const EMPTY_FILTER = ['==', ['id'], -1];

// icon sizes at each map zoom stop
const ICON_SIZE_STOPS = [
    [3, 0.1], 
    [5, 0.28], 
    [8, 0.4], 
    [12, 0.56], 
    [15, 0.75]
];

// selected markers are 35 percent larger than regular markers
const SELECTED_SCALE = 1.35;

// active point layers when mode symbology is disabled
const NOSYMBOLOGY_LAYERS = [
    'nosymbologylandmark-shadow',
    'nosymbologylandmark-outline',
    'nosymbologylandmark-halo',
    'nosymbologylandmark',
    'nosymbologylandmark-selected'
];

// active point layers when mode symbology is enabled
const SYMBOLOGY_LAYERS = ['landmarks-shadow', 'landmarks-outline', 'landmarks-halo', 'landmarks', 'landmarks-selected'];

// every marker layer that can start or continue a hover interaction
const LANDMARK_HOVER_LAYERS = [
    'backgroundlandmark',
    'backgroundlandmark-selected',
    'nosymbologylandmark',
    'nosymbologylandmark-selected',
    'landmarks',
    'landmarks-selected'
];

// csv representation flags use string 1 and most specific cases come first
const LANDMARK_ICON_IMAGE = [
    'case',
    ['all', ['==', ['get', 'Acknowledged'], '1'], ['==', ['get', 'Erasure'], '1'], ['==', ['get', 'Valorization'], '1']], 'eva',
    ['all', ['==', ['get', 'Acknowledged'], '1'], ['==', ['get', 'Multiculturalism'], '1'], ['==', ['get', 'Valorization'], '1']], 'mva',
    ['all', ['==', ['get', 'Acknowledged'], '1'], ['==', ['get', 'Erasure'], '1']], 'ae',
    ['all', ['==', ['get', 'Acknowledged'], '1'], ['==', ['get', 'Multiculturalism'], '1']], 'am',
    ['all', ['==', ['get', 'Acknowledged'], '1'], ['==', ['get', 'Valorization'], '1']], 'av',
    ['all', ['==', ['get', 'Erasure'], '1'], ['==', ['get', 'Multiculturalism'], '1']], 'me',
    ['all', ['==', ['get', 'Valorization'], '1'], ['==', ['get', 'Multiculturalism'], '1']], 'mv',
    ['all', ['==', ['get', 'Valorization'], '1'], ['==', ['get', 'Erasure'], '1']], 've',
    ['==', ['get', 'Acknowledged'], '1'], 'a',
    ['==', ['get', 'Multiculturalism'], '1'], 'm',
    ['==', ['get', 'Erasure'], '1'], 'e',
    ['==', ['get', 'Valorization'], '1'], 'v',
    ['all',
        ["!=", ["coalesce", ["get", "Acknowledged"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Multiculturalism"], '0'], '1'],
        ["!=", ["get", "Valorization"], '1'],
        ["!=", ["coalesce", ["get", "Erasure"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Colonization"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Nation_Building"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Settler_Colonization"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Slavery"], '0'], '1'],
        ["!=", ["coalesce", ["get", "State_Formation"], '0'], '1'],
        ["!=", ["coalesce", ["get", "Racial_Capitalism"], '0'], '1'],
    ], 'b',
    'b',
];

function iconSizeZoom(scale = 1) {
    // build the mapbox zoom expression and apply an optional scale
    return [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...ICON_SIZE_STOPS.flatMap(([zoom, size]) => [zoom, size * scale])
    ];
}

function shadowIconLayout() {
    // shadow stays in its own layer below each active marker
    return {
        'icon-image': 'active-shadow',
        'icon-allow-overlap': true,
        'icon-size': iconSizeZoom(),
    };
}

function selectedIdFilter(selectedId) {
    return ['==', ['id'], selectedId ?? -1];
}

function setSelectedPointFilters(map) {
    // selected markers use different layers for active and filtered-out points
    const activeFilter = map._activePointFilter || EMPTY_FILTER;
    const idFilter = selectedIdFilter(map._selectedFeatureId);
    const activeSelected = ['all', activeFilter, idFilter];
    const inactiveSelected = ['all', ['!', activeFilter], idFilter];

    [
        ['nosymbologylandmark-outline', activeSelected],
        ['nosymbologylandmark-halo', activeSelected],
        ['nosymbologylandmark-selected', activeSelected],
        ['landmarks-outline', activeSelected],
        ['landmarks-halo', activeSelected],
        ['landmarks-selected', activeSelected],
        ['backgroundlandmark-outline', inactiveSelected],
        ['backgroundlandmark-halo', inactiveSelected],
        ['backgroundlandmark-selected', inactiveSelected],
    ].forEach(([layerId, filter]) => {
        if (map.getLayer(layerId)) {
            map.setFilter(layerId, filter);
        }
    });
}

function setLayerVisibility(map, layerIds, visibility) {
    // update only layers that are available after map load
    layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visibility);
        }
    });
}

function setActivePointFilters(map, filterExpr) {
    // keep active and background layers in sync with the current filter
    const activeFilter = filterExpr || EMPTY_FILTER;
    map._activePointFilter = activeFilter;

    ['nosymbologylandmark-shadow', 'nosymbologylandmark', 'landmarks-shadow', 'landmarks'].forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setFilter(layerId, activeFilter);
        }
    });
    ['backgroundlandmark'].forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setFilter(layerId, ['!', activeFilter]);
        }
    });
    setSelectedPointFilters(map);
}

function togglemodeSymbology(animateColors = false) {
    // switch between generic and mode-specific marker families
    const isEnabled = document.getElementById("modeSymbologySwitch").checked;
    const map = window._nhlMapInstance;
    const filterContent = document.getElementById('filter-content');

    // shared UI state used by controls outside the map module
    window.modeSymbologyEnabled = isEnabled;

    if (animateColors && filterContent) {
        const transitionMs = getCssDurationMs('--filter-color-transition-duration', 200);

        filterContent.classList.add('symbology-colors-changing');
        // force layout before changing checkbox color variables
        filterContent.offsetWidth;
        window.clearTimeout(filterContent._symbologyColorTimer);
        filterContent._symbologyColorTimer = window.setTimeout(() => {
            filterContent.classList.remove('symbology-colors-changing');
        }, transitionMs + 50);
    }

    document.querySelectorAll('.mode-filter').forEach(checkbox => {
        const checkboxColor = isEnabled ? 'var(--mode-symbol-color)' : 'var(--modal-filter-gold)';
        const isLowContrastMode = checkbox.value === 'Erasure' || checkbox.value === 'None';
        const checkboxCheckColor = isEnabled && isLowContrastMode ? '#333' : 'white';
        checkbox.style.setProperty('--checkbox-color', checkboxColor);
        checkbox.style.setProperty('--checkbox-border-color', checkboxColor);
        checkbox.style.setProperty('--checkbox-check-color', checkboxCheckColor);
    });

    if (!map) {
        return;
    }

    setLayerVisibility(map, SYMBOLOGY_LAYERS, isEnabled ? 'visible' : 'none');
    setLayerVisibility(map, NOSYMBOLOGY_LAYERS, isEnabled ? 'none' : 'visible');
}

function filterBasemapLabelsToUS(map) {
    // retain united states labels while preserving each existing layer filter
    const usIsoFilter = [
        "any",
        ["==", ["get", "iso_3166_1"], "US"],
        ["==", ["get", "iso_3166_1_alpha_3"], "USA"],
        ["==", ["slice", ["coalesce", ["get", "iso_3166_2"], ""], 0, 2], "US"]
    ];

    map.getStyle().layers.forEach(layer => {
        if (layer.type !== 'symbol' || !layer.id.endsWith('-label') || layer.id === 'country-label') {
            return;
        }

        const existingFilter = map.getFilter(layer.id);
        map.setFilter(layer.id, existingFilter
            ? ["all", existingFilter, usIsoFilter]
            : usIsoFilter
        );
    });
}

function addMapIcon(map, id, url) {
    // load image assets before layers reference their ids
    const image = new Image();
    image.onload = () => {
        if (!map.hasImage(id)) {
            map.addImage(id, image);
        }
    };
    image.onerror = () => {
        console.warn(`Could not load map icon: ${url}`);
    };
    image.src = url;
}

function setupLandmarkHover(map, landmarkLayers) {
    // show one hover card while the pointer remains on any marker layer
    const hoverInfoBox = createHoverInfoBox({ offsetY: -12 });
    const mapCanvas = map.getCanvas();
    let hoverMoveListenerActive = false;
    let hoverBoundaryListenerActive = false;
    let activeHoverFeatureId = null;

    const getEventFeature = (e) => e.feature || e.features?.[0] || null;

    const getPointerPosition = (e) => {
        if (e.originalEvent) {
            return {
                clientX: e.originalEvent.clientX,
                clientY: e.originalEvent.clientY
            };
        }

        const point = e.point;
        const mapBounds = map.getContainer().getBoundingClientRect();
        return {
            clientX: mapBounds.left + point.x,
            clientY: mapBounds.top + point.y
        };
    };

    const updateLandmarkHoverContent = (feature) => {
        if (!feature || feature.id === activeHoverFeatureId) {
            // avoid rebuilding the card when moving within the same marker
            return;
        }

        const props = feature.properties || {};
        // use source properties because every marker layer shares the same data
        hoverInfoBox.show({
            header: props.Historic_Name,
            infoText: "Form year: " + (props["Form Year"] || 'Unknown')
        });
        activeHoverFeatureId = feature.id;
    };

    const renderedLandmarkFeatureAtPoint = (point) => {
        // topmost rendered marker wins when layers overlap
        if (!point) {
            return null;
        }

        const features = map.queryRenderedFeatures(point, { layers: landmarkLayers });
        return features[0] || null;
    };

    const onHoverMove = (e) => {
        const position = getPointerPosition(e);

        hoverInfoBox.setPosition(position.clientX, position.clientY);
        updateLandmarkHoverContent(renderedLandmarkFeatureAtPoint(e.point));
    };

    const startHoverMoveListener = () => {
        if (hoverMoveListenerActive) {
            return;
        }

        map.on('mousemove', onHoverMove);
        hoverMoveListenerActive = true;
    };

    const stopHoverMoveListener = () => {
        if (!hoverMoveListenerActive) {
            return;
        }

        map.off('mousemove', onHoverMove);
        hoverMoveListenerActive = false;
    };

    const clearLandmarkHover = () => {
        mapCanvas.style.cursor = '';
        hoverInfoBox.hide();
        activeHoverFeatureId = null;
        stopHoverMoveListener();
        stopHoverBoundaryListener();
    };

    const onDocumentPointerMove = (e) => {
        if (e.target !== mapCanvas) {
            // mapbox does not always emit leave events for overlapping layers
            clearLandmarkHover();
        }
    };

    function startHoverBoundaryListener() {
        if (hoverBoundaryListenerActive) {
            return;
        }

        document.addEventListener('pointermove', onDocumentPointerMove, true);
        hoverBoundaryListenerActive = true;
    }

    function stopHoverBoundaryListener() {
        if (!hoverBoundaryListenerActive) {
            return;
        }

        document.removeEventListener('pointermove', onDocumentPointerMove, true);
        hoverBoundaryListenerActive = false;
    }

    const showLandmarkHover = (e) => {
        mapCanvas.style.cursor = 'pointer';
        updateLandmarkHoverContent(getEventFeature(e));

        const position = getPointerPosition(e);
        hoverInfoBox.setPosition(position.clientX, position.clientY);
        startHoverMoveListener();
        startHoverBoundaryListener();
    };

    const hideLandmarkHover = (e) => {
        if (e?.point && renderedLandmarkFeatureAtPoint(e.point)) {
            return;
        }

        clearLandmarkHover();
    };

    landmarkLayers.forEach(layerId => {
        map.addInteraction(`places-mouseenter-${layerId}`, {
            type: 'mouseenter',
            target: { layerId },
            handler: showLandmarkHover
        });

        map.addInteraction(`places-mouseleave-${layerId}`, {
            type: 'mouseleave',
            target: { layerId },
            handler: hideLandmarkHover
        });
    });
}

function addMapLayers(map) {
    // load source data then build stacked marker layers for state and selection
    map.on('load', async () => {
        filterBasemapLabelsToUS(map);
        const landmarkSourceData = await loadLandmarkSourceData();
        map._landmarkSourceData = landmarkSourceData;

        // source data is loaded once and reused by every marker layer
        map.addSource('landmark-point-data', {
            type: 'geojson',
            data: landmarkSourceData
        });
    
        // source icons are shared by the generic and symbology layer families
        const icons = {
            'a': 'img/A.svg',
            'ae': 'img/AE.svg',
            'am': 'img/AM.svg',
            'av': 'img/AV.svg',
            'b': 'img/B.svg',
            'e': 'img/E.svg',
            'eva': 'img/EVA.svg',
            'm': 'img/M.svg',
            'me': 'img/ME.svg',
            'mv': 'img/MV.svg',
            'mva': 'img/MVA.svg',
            'v': 'img/V.svg',
            've': 'img/VE.svg',
            'bb': 'img/bb.svg',
            'g': 'img/G.svg',
            'active-shadow': 'img/active-shadow.svg',
            'selected-halo': 'img/selected-halo.svg',
            'selected-outline': 'img/selected-outline.svg'
        };

        Object.entries(icons).forEach(([id, url]) => {
            addMapIcon(map, id, url);
        });

        // background layers keep filtered-out points visible and selectable
        map.addLayer({
            id: 'backgroundlandmark',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'g',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(),
            },
            filter: EMPTY_FILTER
        });

        // filtered-out selection layers sit above the background marker
        map.addLayer({
            id: 'backgroundlandmark-halo',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'selected-halo',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'backgroundlandmark-selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'g',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'backgroundlandmark-outline',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'selected-outline',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'nosymbologylandmark-shadow',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: shadowIconLayout(),
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'nosymbologylandmark',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'bb',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'nosymbologylandmark-halo',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'selected-halo',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'nosymbologylandmark-selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'bb',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'nosymbologylandmark-outline',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'selected-outline',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        // symbology layers mirror generic layers but use mode-derived icons
        map.addLayer({
            id: 'landmarks-shadow',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                ...shadowIconLayout(),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'landmarks',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                'icon-image': LANDMARK_ICON_IMAGE,
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'landmarks-halo',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                'icon-image': 'selected-halo',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'landmarks-selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                'icon-image': LANDMARK_ICON_IMAGE,
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        map.addLayer({
            id: 'landmarks-outline',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                'icon-image': 'selected-outline',
                'icon-allow-overlap': true,
                'icon-size': iconSizeZoom(SELECTED_SCALE),
            },
            filter: EMPTY_FILTER
        });

        // start with every feature active before the filter panel initializes
        setActivePointFilters(map, ALL_POINTS_FILTER);
        togglemodeSymbology();
    
    });

    // filters keep this value highlighted across every marker family
    map._selectedFeatureId = null;

    setupLandmarkHover(map, LANDMARK_HOVER_LAYERS);

}
