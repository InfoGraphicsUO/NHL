const ALL_POINTS_FILTER = ['==', ['literal', true], true];
const EMPTY_FILTER = ['==', ['id'], -1];
const LANDMARK_SOURCE_URL = 'data/NHL IGL Database - NHLDB.geojson';

// zoom symbology for monument points
const ICON_SIZE_STOPS = [ // [zoom level, icon size]
    [3, 0.1], 
    [5, 0.28], 
    [8, 0.4], 
    [12, 0.56], 
    [15, 0.75]
];

// selected scale for monument points
const SELECTED_SCALE = 1.35;

// exact-coordinate duplicates are shifted north so they can be hovered/clicked separately
const DUPLICATE_COORDINATE_LAT_OFFSET = 0.00009;

// layers for monument points without symbology
const NOSYMBOLOGY_LAYERS = [
    'nosymbologylandmark-shadow',
    'nosymbologylandmark-outline',
    'nosymbologylandmark-halo',
    'nosymbologylandmark',
    'nosymbologylandmark-selected'
];

const SYMBOLOGY_LAYERS = ['landmarks-shadow', 'landmarks-outline', 'landmarks-halo', 'landmarks', 'landmarks-selected'];

// maps the modes of representation to the corresponding icon
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
    // returns the icon size for the given zoom level
    return [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...ICON_SIZE_STOPS.flatMap(([zoom, size]) => [zoom, size * scale])
    ];
}

function shadowIconLayout() {
    // this defines the layout of the shadow icon (the shadow is a separate layer)
    return {
        'icon-image': 'active-shadow',
        'icon-allow-overlap': true,
        'icon-size': iconSizeZoom(),
    };
}

function getCoordinates(feature) {
    const coordinates = feature.geometry?.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
        return [Number(coordinates[0]), Number(coordinates[1])];
    }

    const lon = Number(feature.properties?.LON);
    const lat = Number(feature.properties?.LAT);
    return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function coordinateKey(coordinates) {
    // split the coordinates into a string
    return coordinates.map(value => String(value)).join(',');
}

function offsetDuplicateCoordinateFeatures(geojson) {
    // some monuments have identical coordinates
    // we create an offset for duplicate coordinates so they can be hovered/clicked separately
    const coordinateGroups = new Map();
    geojson.features.forEach(feature => {
        const coordinates = getCoordinates(feature);
        if (!coordinates) {
            return;
        }

        const key = coordinateKey(coordinates);
        if (!coordinateGroups.has(key)) {
            coordinateGroups.set(key, []);
        }
        coordinateGroups.get(key).push(feature);
    });

    coordinateGroups.forEach(group => {
        group.forEach((feature, index) => {
            if (index === 0 || !feature.geometry?.coordinates) {
                return;
            }

            feature.geometry.coordinates = [
                feature.geometry.coordinates[0],
                feature.geometry.coordinates[1] + (index * DUPLICATE_COORDINATE_LAT_OFFSET)
            ];
        });
    });

    return geojson;
}

async function loadLandmarkSourceData() {
    // grab the landmark source data from the url
    const response = await fetch(LANDMARK_SOURCE_URL);
    if (!response.ok) {
        throw new Error(`Could not load landmark source: ${LANDMARK_SOURCE_URL}`);
    }

    const geojson = offsetDuplicateCoordinateFeatures(await response.json());
    geojson.features.forEach((feature, index) => {
        feature.id = index;
    });

    return geojson;
}

function selectedIdFilter(selectedId) {
    return ['==', ['id'], selectedId ?? -1];
}

function setSelectedPointFilters(map) {
    // sets the filters for the selected point
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
    // sets the visibility for the given layers
    layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visibility);
        }
    });
}

function setActivePointFilters(map, filterExpr) {
    // sets the active point filters
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
    // toggles the color of the mode symbology
    const isEnabled = document.getElementById("modeSymbologySwitch").checked;
    const map = window._nhlMapInstance;
    const filterContent = document.getElementById('filter-content');

    window.modeSymbologyEnabled = isEnabled;

    if (animateColors && filterContent) {
        const transitionDuration = getComputedStyle(document.documentElement)
            .getPropertyValue('--filter-color-transition-duration')
            .trim();
        const parsedTransitionMs = transitionDuration.endsWith('ms')
            ? parseFloat(transitionDuration)
            : parseFloat(transitionDuration) * 1000;
        const transitionMs = Number.isFinite(parsedTransitionMs) ? parsedTransitionMs : 200;

        filterContent.classList.add('symbology-colors-changing');
        // force the transition class to apply before changing the checkbox color variables
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
    // we filter out all basemap labels that aren't in the US
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

function addMapLayers(map) {
    map.on('load', async () => {
        filterBasemapLabelsToUS(map);
        const landmarkSourceData = await loadLandmarkSourceData();
        map._landmarkSourceData = landmarkSourceData;

        map.addSource('landmark-point-data', {
            type: 'geojson',
            data: landmarkSourceData
        });
    
        // define icons
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

        // inactive monument points shown with generic icon
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

        // selection halo for inactive monument points
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

        // enlarged generic icon for selected inactive monument points
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

        // selection outline for inactive monument points
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

        // drop shadow for active monument points without symbology
        map.addLayer({
            id: 'nosymbologylandmark-shadow',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: shadowIconLayout(),
            filter: EMPTY_FILTER
        });

        // active monument points without symbology icons
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

        // selection halo for active monument points without symbology
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

        // enlarged icon for selected active monument points without symbology
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

        // selection outline for active monument points without symbology
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

        // drop shadow for active monument points with symbology
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

        // active monument points with symbology icons
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

        // selection halo for active monument points with symbology
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

        // enlarged icon for selected active monument points with symbology
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

        // selection outline for active monument points with symbology
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

        setActivePointFilters(map, ALL_POINTS_FILTER);
        togglemodeSymbology();
    
    });

    // track the current selected feature/site
    map._selectedFeatureId = null;

    const landmarkLayers = [
        'backgroundlandmark',
        'backgroundlandmark-selected',
        'nosymbologylandmark',
        'nosymbologylandmark-selected',
        'landmarks',
        'landmarks-selected'
    ];

    const hoverInfoBox = createHoverInfoBox({ offsetY: -12 });
    let hoverMoveListenerActive = false;
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
            return;
        }

        const props = feature.properties || {};
        hoverInfoBox.show({
            header: props.Historic_Name,
            infoText: "Form year: " + (props["Form Year"] || 'Unknown')
        });
        activeHoverFeatureId = feature.id;
    };

    const renderedLandmarkFeatureAtPoint = (point) => {
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

    const showLandmarkHover = (e) => {
        map.getCanvas().style.cursor = 'pointer';
        updateLandmarkHoverContent(getEventFeature(e));

        const position = getPointerPosition(e);
        hoverInfoBox.setPosition(position.clientX, position.clientY);
        startHoverMoveListener();
    };

    const hideLandmarkHover = (e) => {
        if (renderedLandmarkFeatureAtPoint(e.point)) {
            return;
        }

        map.getCanvas().style.cursor = '';
        hoverInfoBox.hide();
        activeHoverFeatureId = null;
        stopHoverMoveListener();
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
