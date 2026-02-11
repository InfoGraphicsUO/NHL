function mapInits() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';
    const map = new mapboxgl.Map({
        style: 'mapbox://styles/infographics/cmlhb3rze006q01sn2k2k5qki', // frank!!!!
        container: 'map',
        center: [-132.09808, 41.09622], 
        zoom: 2.5
    });

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



function addMapLayers(map) {
    map.on('load', () => {
        map.addSource('landmark-point-data', {
            type: 'geojson',
            generateId: true,   // required for feature-state-based interactions
            data: '/data/NHL IGL Database - NHLDB.geojson' 
        });

        map.addLayer({
            id: 'landmarks',
            type: 'circle', 
            source: 'landmark-point-data',
            paint: {
                    'circle-color': [
                        'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            'DarkGreen',
                            ['case',
                                ['==', ['get', 'Acknowledged'], '1'], '#61a5ff', 
                                ['==', ['get', 'Multiculturalism'], '1'], '#ffb260', 
                                ['==', ['get', 'Erasure'], '1'], '#ff6f68', 
                                ['==', ['get', 'Valorization'], '1'], '#80b475', 
                                '#e0ce96' //default
                            ]
                        ],
                    'circle-radius': [
                        'interpolate',
                            ['linear'],
                            ['zoom'],
                            5, [
                                'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    7,
                                    4
                            ],
                            10, [
                                'case',
                                    ['boolean', ['feature-state', 'selected'], false],
                                    10,
                                    7
                            ]
                    ],
                    'circle-stroke-width': [
                        'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            3,
                            1
                    ],
                    'circle-stroke-color': [
                        'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            'white',
                            '#ffffff'
                    ]
            }
        });
    
    });
    // track the current selected feature/site
    map._selectedFeatureId = null;

    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    map.addInteraction('places-mouseenter-interaction', {
        type: 'mouseenter',
        target: { layerId: 'landmarks' },
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
        target: { layerId: 'landmarks' },
        handler: () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        }
    });

}