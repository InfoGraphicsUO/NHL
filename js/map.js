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

const DEFAULT_STYLE_URL = 'mapbox://styles/infographics/cmlhb3rze006q01sn2k2k5qki';

// non-place labels (roads, pois, transit, airports, parks) in the default style
const DEFAULT_STYLE_HIDDEN_LABELS = [
    'road-label-simple',
    'natural-line-label',
    'natural-point-label',
    'poi-label',
    'transit-label',
    'airport-label'
];

// styles owned by other mapbox accounts need that account's token to load
const MAPBOX_ACCOUNT_TOKENS = {
    steiner: 'pk.eyJ1Ijoic3RlaW5lciIsImEiOiIyT1NsejNjIn0.RTh9EHOG2cpFVPYMfC8wPQ'
};

function useAccountToken(url) {
    // swap in the owning account's token for its styles, sprites and fonts
    const match = url.match(/^https:\/\/api\.mapbox\.com\/(?:styles|fonts)\/v1\/([^/]+)\//);
    const token = match && MAPBOX_ACCOUNT_TOKENS[match[1]];
    if (!token) return { url };

    const next = new URL(url);
    next.searchParams.set('access_token', token);
    return { url: next.toString() };
}

// basemap choices shown in the map's style selector
const BASEMAP_STYLES = [
    {
        id: 'nhl',
        label: 'Default',
        url: DEFAULT_STYLE_URL,
        // match the monumental denial style, which only labels places and water
        hiddenLayers: DEFAULT_STYLE_HIDDEN_LABELS
    },
    { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
    { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
    { id: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
    { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
    { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-v9' },
    { id: 'satellite-streets', label: 'Satellite Streets', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
    {
        id: 'monumental-denial',
        label: 'Monumental Denial',
        url: 'mapbox://styles/steiner/cmw1fqauq006y01stf0be3uje',
        // the style has its own unfiltered landmark layers, which would sit under ours
        hiddenLayers: ['nhl-landmarks', 'nhl-landmark-squares'],
        // the style imports all of mapbox standard under its own layers, which draws standard's
        // labels, icons and road shields over erik's; his layers already make a full basemap
        stripImports: true
    }
];

const styleJsonCache = new Map();

function mapboxStyleApiUrl(url) {
    // turn a mapbox://styles/owner/id url into the styles api url, with the owner's token
    const path = url.replace(/^mapbox:\/\/styles\//, '');
    const apiUrl = `https://api.mapbox.com/styles/v1/${path}?access_token=${mapboxgl.accessToken}`;
    return useAccountToken(apiUrl).url;
}

function loadStyle(style) {
    // a style url, or for styles with stripImports, its json without the imported styles
    if (!style.stripImports) return Promise.resolve(style.url);
    if (!styleJsonCache.has(style.url)) {
        const request = fetch(mapboxStyleApiUrl(style.url))
            .then(response => {
                if (!response.ok) throw new Error(`style request failed: ${response.status}`);
                return response.json();
            })
            .then(json => {
                delete json.imports;
                return json;
            })
            .catch(error => {
                styleJsonCache.delete(style.url);
                throw error;
            });
        styleJsonCache.set(style.url, request);
    }
    // setStyle keeps a reference to the json, so hand it a copy each time
    return styleJsonCache.get(style.url).then(json => structuredClone(json));
}

class BasemapControl {
    // mapbox control that swaps the basemap style and keeps the landmark layers on top
    onAdd(map) {
        this._map = map;
        this._styleId = BASEMAP_STYLES[0].id;
        this._switchToken = 0;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group mapboxgl-ctrl-basemap';

        const label = document.createElement('label');
        label.title = 'Basemap';
        label.innerHTML = '<i class="fa-regular fa-layer-group" aria-hidden="true"></i>';

        this._select = document.createElement('select');
        this._select.setAttribute('aria-label', 'Basemap');
        BASEMAP_STYLES.forEach(style => this._select.add(new Option(style.label, style.id)));
        this._select.addEventListener('change', () => this.setStyleId(this._select.value));

        // the landmark layers have to exist before a swap can carry them over
        this._select.disabled = true;
        const enableWhenReady = () => {
            if (map.getLayer('landmarks')) this._select.disabled = false;
            else map.once('idle', enableWhenReady);
        };
        map.once('idle', enableWhenReady);

        label.appendChild(this._select);
        this._container.appendChild(label);

        // classic styles set their own projection, so keep the one the app started with
        map.once('style.load', () => {
            this._projection = map.getProjection()?.name;
            setLayerVisibility(map, BASEMAP_STYLES[0].hiddenLayers || [], 'none');
        });
        return this._container;
    }

    getStyleId() {
        return this._styleId;
    }

    setStyleId(styleId) {
        const style = BASEMAP_STYLES.find(item => item.id === styleId);
        if (!style || style.id === this._styleId) return;

        const map = this._map;
        this._styleId = style.id;
        this._select.value = style.id;

        // custom sources and layers are dropped by setStyle, so carry the current ones over;
        // a switch made while another is still loading reuses the layers saved by the first
        if (!this._pendingLayers) {
            this._pendingLayers = getLandmarkLayers(map);
        }

        const token = ++this._switchToken;
        map.once('style.load', () => {
            if (token !== this._switchToken) return;
            if (this._projection) map.setProjection(this._projection);
            setLayerVisibility(map, style.hiddenLayers || [], 'none');
            restoreLandmarkLayers(map, this._pendingLayers);
            this._pendingLayers = null;
        });
        loadStyle(style)
            .then(styleSource => {
                if (token === this._switchToken) map.setStyle(styleSource, { diff: false });
            })
            .catch(error => {
                // fall back to the hosted style, imports and all, rather than no basemap
                console.error(error);
                if (token === this._switchToken) map.setStyle(style.url, { diff: false });
            });
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
        transformRequest: useAccountToken,
    });

    // shared by filters and map controls outside this module
    window._nhlMapInstance = map;

    initDevZoomDisplay(map);
    addMapLayers(map);

    const basemapControl = new BasemapControl();
    window._nhlBasemapControl = basemapControl;
    map.addControl(basemapControl, 'top-left');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new HomeControl(), 'top-left');
    map.addControl(new mapboxgl.AttributionControl({
        customAttribution: '<a href="https://infographics.uoregon.edu">UO InfoGraphics Lab</a>'
    }));
}
