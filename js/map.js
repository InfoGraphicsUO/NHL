function mapInits() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';
    const map = new mapboxgl.Map({
        style: 'mapbox://styles/infographics/cmlhb3rze006q01sn2k2k5qki', // frank!!!!
        container: 'map',
        center: [-132.09808, 41.09622], 
        zoom: 2.5
    });

    console.log(map.getZoom());
    
    // global map instance
    window._nhlMapInstance = map;
    addMapLayers(map)

    // zoom/center logging
    function logMapState() {
        const center = map.getCenter();
        const zoom = map.getZoom();
        console.log(`Map zoom: ${zoom.toFixed(2)}, center: [${center.lng.toFixed(5)}, ${center.lat.toFixed(5)}]`);
    }
    map.on('moveend', logMapState);
    map.on('zoomend', logMapState);
    map.on('dragend', logMapState);
}

function togglemodeSymbology(animateColors = false) {
  const isEnabled = modeSymbologyEnabled = document.getElementById("modeSymbologySwitch").checked;
  const map = window._nhlMapInstance;
  const filterContent = document.getElementById('filter-content');

  if (animateColors && filterContent) {
    const transitionDuration = getComputedStyle(document.documentElement)
      .getPropertyValue('--filter-color-transition-duration')
      .trim();
    const parsedTransitionMs = transitionDuration.endsWith('ms')
      ? parseFloat(transitionDuration)
      : parseFloat(transitionDuration) * 1000;
    const transitionMs = Number.isFinite(parsedTransitionMs) ? parsedTransitionMs : 200;

    filterContent.classList.add('symbology-colors-changing');
    // Force the transition class to apply before changing the checkbox color variables.
    filterContent.offsetWidth;
    window.clearTimeout(filterContent._symbologyColorTimer);
    filterContent._symbologyColorTimer = window.setTimeout(() => {
      filterContent.classList.remove('symbology-colors-changing');
    }, transitionMs + 50);
  }

  document.querySelectorAll('.mode-filter').forEach(checkbox => {
    const checkboxColor = isEnabled ? 'var(--mode-symbol-color)' : 'var(--modal-filter-gold)';
    checkbox.style.setProperty('--checkbox-color', checkboxColor);
  });

  if (!map || !map.getLayer('landmarks') || !map.getLayer('nosymbologylandmark')) {
    return;
  }

  if (isEnabled) {
    map.setLayoutProperty('landmarks', 'visibility', 'visible');
    map.setLayoutProperty('nosymbologylandmark', 'visibility', 'none');
  } else {
    map.setLayoutProperty('landmarks', 'visibility', 'none');
    map.setLayoutProperty('nosymbologylandmark', 'visibility', 'visible');
  }
  };

function filterBasemapLabelsToUS(map) {
    // filter POI and state labels to just the US
    const usIsoFilter = [
        "any",
        ["==", ["get", "iso_3166_1"], "US"],
        ["==", ["get", "iso_3166_1_alpha_3"], "USA"],
        ["==", ["slice", ["coalesce", ["get", "iso_3166_2"], ""], 0, 2], "US"]
    ];
    const labelLayerIds = ["poi-label", "state-label"];

    map.getStyle().layers.forEach(layer => {
        if (!labelLayerIds.includes(layer.id)) {
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
    map.on('load', () => {
        filterBasemapLabelsToUS(map);

        map.addSource('landmark-point-data', {
            type: 'geojson',
            generateId: true,   // required for feature-state-based interactions
            data: 'data/NHL IGL Database - NHLDB.geojson'
        });
    
        // define icons
    const icons = {
        'a':   'img/A.svg',
        'ae':  'img/AE.svg',
        'am':  'img/AM.svg',
        'av':  'img/AV.svg',
        'b':   'img/B.svg',
        'e':   'img/E.svg',
        'eva': 'img/EVA.svg',
        'm':   'img/M.svg',
        'me':  'img/ME.svg',
        'mv':  'img/MV.svg',
        'mva': 'img/MVA.svg',
        'v':   'img/V.svg',
        've':  'img/VE.svg',
        's': 'img/S.svg',
        'bb': 'img/bb.svg',
        'g': 'img/G.svg'
    };

    const iconSize = [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, 0.1,
        15, 0.5
    ];


        
        map.addLayer({
            id: 'nosymbologylandmark',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'bb',
                'icon-allow-overlap': true,
                'icon-size': iconSize,
            },
        });

        Object.entries(icons).forEach(([id, url]) => {
            addMapIcon(map, id, url);
        })

        map.addLayer({
            id: 'landmarks',
            type: 'symbol', 
            source: 'landmark-point-data',
            layout: {
                'visibility': 'none',
                    'icon-image': 
                            ['case',
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
                                'b', //default
                            ],
                        'icon-allow-overlap': true,
                        'icon-size': iconSize,
            }
        });
        map.addLayer({
            id: 'landmarks-selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 's',
                    'icon-size': iconSize,
                'icon-allow-overlap': true
            },
            filter: ['==', ['id'], -1] 
        });

        togglemodeSymbology();
    
    });

    // track the current selected feature/site
    map._selectedFeatureId = null;

    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    const landmarkLayers = ['landmarks', 'nosymbologylandmark'];

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
