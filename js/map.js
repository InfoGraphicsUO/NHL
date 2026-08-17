// set false to hide the development zoom display
const SHOW_DEV_ZOOM_DISPLAY = false;

// default map viewport
const NHL_MAP_HOME = {
    center: [-132.09808, 41.09622],
    zoom: 2.5
};

function initDevZoomDisplay(map) {
    // show the live zoom value only during development
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
    // mapbox control that restores the default viewport
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

const SATELLITE_LAYER_ID = 'basemap-satellite';
const DEFAULT_STYLE_URL = 'mapbox://styles/infographics/cmlhb3rze006q01sn2k2k5qki';

class SatelliteControl {
    // mapbox control that toggles the satellite basemap under markers
    onAdd(map) {
        this._map = map;
        this._enabled = false;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-satellite';

        this._button = document.createElement('button');
        this._button.type = 'button';
        this._button.setAttribute('aria-pressed', 'false');
        this._syncButton();
        this._button.addEventListener('click', () => {
            this._setEnabled(!this._enabled);
        });

        this._container.appendChild(this._button);
        return this._container;
    }

    _syncButton() {
        const action = this._enabled ? 'Switch to default basemap' : 'Switch to satellite basemap';
        this._button.title = action;
        this._button.setAttribute('aria-label', action);
        this._button.setAttribute('aria-pressed', this._enabled ? 'true' : 'false');
        this._button.classList.toggle('is-active', this._enabled);
        this._button.innerHTML = this._enabled
            ? '<i class="fa-solid fa-map" aria-hidden="true"></i><span>Default Map</span>'
            : '<i class="fa-regular fa-earth-americas" aria-hidden="true"></i><span>Satellite</span>';
    }

    _setEnabled(enabled) {
        this._pendingEnabled = enabled;
        this._enabled = enabled;
        this._syncButton();

        const tryApply = () => {
            const map = this._map;
            if (!map.getLayer(SATELLITE_LAYER_ID)) {
                // layer is created after landmark data loads
                map.once('idle', tryApply);
                return;
            }

            map.setLayoutProperty(
                SATELLITE_LAYER_ID,
                'visibility',
                this._pendingEnabled ? 'visible' : 'none'
            );
        };

        tryApply();
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
    }
}

function mapInits() {
    // create the shared map instance and attach its base controls
    mapboxgl.accessToken = 'pk.eyJ1IjoiaW5mb2dyYXBoaWNzIiwiYSI6ImNqaTR0eHhnODBjeTUzdmx0N3U2dWU5NW8ifQ.fVbTCmIrqILIzv5QGtVJ2Q';

    const map = new mapboxgl.Map({
        style: DEFAULT_STYLE_URL,
        container: 'map',
        center: NHL_MAP_HOME.center,
        zoom: NHL_MAP_HOME.zoom,
        attributionControl: false,
    });

    // shared by filters and map controls outside this module
    window._nhlMapInstance = map;

    initDevZoomDisplay(map);
    addMapLayers(map);

    map.addControl(new SatelliteControl(), 'top-left');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new HomeControl(), 'top-left');
    map.addControl(new mapboxgl.AttributionControl({
        customAttribution: '<a href="https://infographics.uoregon.edu">UO InfoGraphics Lab</a>'
    }));
}
