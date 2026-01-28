function mapInits() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';
    const map = new mapboxgl.Map({
        style: 'mapbox://styles/mapbox/streets-v11',
        container: 'map',
        center: [-95, 39], 
        zoom: 4.2 
    });

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

function addMapLayers() {

}