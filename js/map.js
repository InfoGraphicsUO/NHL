function mapInits() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';
    const map = new mapboxgl.Map({
        style: 'mapbox://styles/mapbox/streets-v11',
        container: 'map',
        center: [-95, 39], 
        zoom: 4.2 
    });

    addMapLayers(map)
    addTimeSlider()
}

function addTimeSlider() {
    // Time slider setup
    const yearSlider = document.getElementById('year-slider');
    const yearValue = document.getElementById('year-value');
    if (yearSlider && yearValue) {
        yearValue.textContent = yearSlider.value;
        yearSlider.addEventListener('input', function() {
            yearValue.textContent = this.value;
            // TODO: Filter map markers by Form Year here
        });
    }
}

// Get selected forms of white supremacy
function getSelectedSupremacyForms() {
    return Array.from(document.querySelectorAll('.supremacy-filter:checked')).map(cb => cb.value);
}

// Listen for changes to supremacy filters
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.supremacy-filter').forEach(cb => {
        cb.addEventListener('change', function() {
            // TODO: Filter map markers by selected forms of white supremacy
        });
    });
});
// Get selected representation modes
function getSelectedModes() {
    return Array.from(document.querySelectorAll('.mode-filter:checked')).map(cb => cb.value);
}

// Listen for changes to mode filters
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.mode-filter').forEach(cb => {
        cb.addEventListener('change', function() {
            // TODO: Filter map markers by selected modes
        });
    });
});

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
                'circle-color': 'DarkGoldenRod',
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    5, 4,   // >= Zoom 5, 1px radius
                    10, 7   // >= Zoom 10, 5px radius
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
            }
        });
    
    });

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
            const name = e.feature.properties.Historic_Name;

            // Populate the popup with location, content, and add to map
            popup.setLngLat(coordinates).setHTML(name).addTo(map);
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