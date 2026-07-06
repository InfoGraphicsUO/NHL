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
    return coordinates.map(value => String(value)).join(',');
}

function offsetDuplicateCoordinateFeatures(geojson) {
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
    const response = await fetch(LANDMARK_SOURCE_URL);
    if (!response.ok) {
        throw new Error(`Could not load landmark source: ${LANDMARK_SOURCE_URL}`);
    }

    return offsetDuplicateCoordinateFeatures(await response.json());
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
        checkbox.style.setProperty('--checkbox-color', checkboxColor);
        checkbox.style.setProperty('--checkbox-border-color', checkboxColor);
    });

    if (!map) {
        return;
    }

    setLayerVisibility(map, SYMBOLOGY_LAYERS, isEnabled ? 'visible' : 'none');
    setLayerVisibility(map, NOSYMBOLOGY_LAYERS, isEnabled ? 'none' : 'visible');
}

function filterBasemapLabelsToUS(map) {
    // Outside the US, only country names should appear; keep all label types within the US.
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

        map.addSource('landmark-point-data', {
            type: 'geojson',
            generateId: true,
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

        setActivePointFilters(map, ALL_POINTS_FILTER);
        togglemodeSymbology();
    
    });

    // track the current selected feature/site
    map._selectedFeatureId = null;

    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    const landmarkLayers = [
        'backgroundlandmark',
        'backgroundlandmark-selected',
        'nosymbologylandmark',
        'nosymbologylandmark-selected',
        'landmarks',
        'landmarks-selected'
    ];

    const showLandmarkPopup = (e) => {
        map.getCanvas().style.cursor = 'pointer';

        const coordinates = e.feature.geometry.coordinates.slice();
        const props = e.feature.properties;
        const name = props.Historic_Name;
        const formYear = props["Form Year"] || 'Unknown';
        const html = `<div style="min-width:180px"><strong>${name}</strong><br><span>Form year: ${formYear}</span></div>`;
        popup.setLngLat(coordinates).setHTML(html).addTo(map);
    };

    const hideLandmarkPopup = () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    };

    landmarkLayers.forEach(layerId => {
        map.addInteraction(`places-mouseenter-${layerId}`, {
            type: 'mouseenter',
            target: { layerId },
            handler: showLandmarkPopup
        });

        map.addInteraction(`places-mouseleave-${layerId}`, {
            type: 'mouseleave',
            target: { layerId },
            handler: hideLandmarkPopup
        });
    });

}
