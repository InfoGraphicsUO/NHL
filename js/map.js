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
        's': 'path/to/s.png',
    };

    console.log(
        icons
    )


        
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
                    'icon-image': 
                            ['case',
                                ['==', ['get', 'Acknowledged'], '1'], 'a', 
                                ['==', ['get', 'Multiculturalism'], '1'], 'm', 
                                ['==', ['get', 'Erasure'], '1'], 'e', 
                                ['==', ['get', 'Valorization'], '1'], 'v', 
                                'b' //default
                            ],
                    'icon-size': [
                        'interpolate',
                            ['linear'],
                            ['zoom'],
                                3,
                                0.3, 10, .3
                    ],
                        'icon-allow-overlap': true
            }
        });
        map.addLayer({
            id: 'selected',
            type: 'symbol',
            source: 'landmark-point-data',
            layout: {
                'icon-image': 's', // The 's' icon
                'icon-size': 0.5,   // Make it slightly bigger!
                'icon-allow-overlap': true
            },
            filter: ['==', ['id'], ''] // Filter out everything by default
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