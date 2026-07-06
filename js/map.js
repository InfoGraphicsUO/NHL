// set to false to remove dev zoom display
const SHOW_DEV_ZOOM_DISPLAY = true;

// map default zoom/center
const NHL_MAP_HOME = {
    center: [-132.09808, 41.09622],
    zoom: 2.5
};

function initDevZoomDisplay(map) {
    if (!SHOW_DEV_ZOOM_DISPLAY) {
        return;
    }

    const display = document.createElement('div');
    display.className = 'dev-zoom-display';
    display.setAttribute('aria-hidden', 'true');
    map.getContainer().appendChild(display);

    const updateZoom = () => {
        display.textContent = `zoom ${map.getZoom().toFixed(2)}`;
    };

    updateZoom();
    map.on('zoom', updateZoom);
    map.on('move', updateZoom);
}

class HomeControl {
    // control to return to the default zoom/center
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-home';
        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'Full extent';
        button.setAttribute('aria-label', 'Full extent');
        button.innerHTML = '<i class="fa-globe fa-regular" aria-hidden="true"></i>';
        button.addEventListener('click', () => {
            map.flyTo({ ...NHL_MAP_HOME, essential: true });
        });
        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
    }
}

function mapInits() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';
    const map = new mapboxgl.Map({
        style: 'mapbox://styles/infographics/cmlhb3rze006q01sn2k2k5qki', // frank!!!!
        container: 'map',
        center: NHL_MAP_HOME.center,
        zoom: NHL_MAP_HOME.zoom
    });

    // global map instance
    window._nhlMapInstance = map;
    initDevZoomDisplay(map);
    addMapLayers(map);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new HomeControl(), 'top-left');
}
