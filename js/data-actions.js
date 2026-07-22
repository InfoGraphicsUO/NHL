// google sheets link
const LANDMARK_SOURCE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQCUi6tPKsPeZ046QTAQVbSiSGdeLPUvhjxWqdb2NgSWfG7h9F7cbCKKeUcKf8_MpSg0HnEjkx_qgLO/pub?gid=2001268955&single=true&output=csv';

// exact-coordinate duplicates are shifted north so they can be hovered/clicked separately
const DUPLICATE_COORDINATE_LAT_OFFSET = 0.00009; // kinda arbitrary value that i decided looks best, can be changed

function csvRowsToGeoJSON(rows) {
    // convert sheets CSV rows to a Point FeatureCollection
    // duplicate headers: Papa Parse keeps later values (same as Python DictReader)
    const features = [];

    rows.forEach(row => {
        const lat = Number(row.LAT);
        const lon = Number(row.LON);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        const properties = { ...row };
        delete properties.LAT;
        delete properties.LON;

        // renaming acknowledgement to acknowledged for consistency
        if (
            Object.prototype.hasOwnProperty.call(properties, 'Acknowledgment') &&
            !Object.prototype.hasOwnProperty.call(properties, 'Acknowledged')
        ) {
            properties.Acknowledged = properties.Acknowledgment;
            delete properties.Acknowledgment;
        }

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            properties
        });
    });

    return {
        type: 'FeatureCollection',
        features
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
    // split the coordinates into a string
    return coordinates.map(value => String(value)).join(',');
}

function offsetDuplicateCoordinateFeatures(geojson) {
    // some monuments have identical coordinates
    // we create an offset for duplicate coordinates so they can be hovered/clicked separately
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

function assignFeatureIds(geojson) {
    // Mapbox filters/selection use feature.id
    geojson.features.forEach((feature, index) => {
        feature.id = index;
    });
    return geojson;
}

async function loadLandmarkSourceData() {
    // fetch published google sheets CSV and convert to GeoJSON
    const response = await fetch(LANDMARK_SOURCE_URL);
    if (!response.ok) {
        throw new Error(`Could not load landmark source: ${LANDMARK_SOURCE_URL}`);
    }

    console.log('Google sheets data loaded successfully');

    const csvText = await response.text();
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
    });

    const geojson = csvRowsToGeoJSON(parsed.data);
    offsetDuplicateCoordinateFeatures(geojson);
    assignFeatureIds(geojson);

    console.log('GeoJSON created successfully from google sheets data');
    return geojson;
}
