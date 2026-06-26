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

function togglemodeSymbology() {
  const isEnabled = modeSymbologyEnabled = document.getElementById("modeSymbologySwitch").checked;
  const map = window._nhlMapInstance
    const colorMap = {
    'Acknowledged': '#aec7e8',
    'Multiculturalism': '#ffdab3',
    'Valorization': '#98df8a',
    'Erasure': '#f7b6b2',
    'None': '#be92c4',
    };

  document.querySelectorAll('.mode-filter').forEach(checkbox => {
        checkbox.style.accentColor = isEnabled
      ? colorMap[checkbox.value]
      : '#b8860b';
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

function addMapLayers(map) {
    map.on('load', () => {
        map.addSource('landmark-point-data', {
            type: 'geojson',
            generateId: true,   // required for feature-state-based interactions
            data: 'data/NHL IGL Database - NHLDB.geojson'
        });
    
        // define icons
    const icons = {
        'a':   'img/A.png',
        'ae':  'img/AE.png',
        'am':  'img/AM.png',
        'av':  'img/AV.png',
        'b':   'img/B.png',
        'e':   'img/E.png',
        'eva': 'img/EVA.png',
        'm':   'img/M.png',
        'me':  'img/ME.png',
        'mv':  'img/MV.png',
        'mva': 'img/MVA.png',
        'v':   'img/V.png',
        've':  'img/VE.png',
        's': 'img/S.png',
        'bb': 'img/bb.png',
        'g': 'img/G.png'
    };

map.addLayer({
            id: 'backgroundlandmark',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'g',
                'icon-allow-overlap': true,
                'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    5, 0.5,
                    15, 2
                ]
  },
});
        
        map.addLayer({
            id: 'nosymbologylandmark',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 'bb',
                'icon-allow-overlap': true,
                'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    5, 0.5,
                    15, 2
                ]
            },
        });

        Object.entries(icons).forEach(([id, url]) => {
            map.loadImage(url, (error, image) => {
            if (error) throw error;
            map.addImage(id, image); // id used in icon-image
            });
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
                        'icon-size': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            5, 0.5,
                            15, 2
                        ]
            }
        });
        map.addLayer({
            id: 'landmarks-selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 's',
                    'icon-size': [
                        'interpolate',
                            ['linear'],
                            ['zoom'],
                            5, 0.5,
                            15, 2
                ],  
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

    map.addInteraction('places-mouseenter-interaction', {
        type: 'mouseenter',
        target: { layerId: 'backgroundlandmark' },
        handler: (e) => {
            map.getCanvas().style.cursor = 'pointer';

            // coordinates from the point
            const coordinates = e.feature.geometry.coordinates.slice();
            const props = e.feature.properties;
            const name = props.Historic_Name;
            const formYear = props["Form Year"] || 'Unknown';

            // popup html
            const html = `<div style="min-width:180px"><strong>${name}</strong><br><span>Form year: ${formYear}</span></div>`;
            // Populate the popup 
            popup.setLngLat(coordinates).setHTML(html).addTo(map);
        }
    });

    map.addInteraction('places-mouseleave-interaction', {
        type: 'mouseleave',
        target: { layerId: 'backgroundlandmark' },
        handler: () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        }
    });

}
