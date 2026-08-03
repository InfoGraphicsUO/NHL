// published google sheets CSV
const LANDMARK_SOURCE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQCUi6tPKsPeZ046QTAQVbSiSGdeLPUvhjxWqdb2NgSWfG7h9F7cbCKKeUcKf8_MpSg0HnEjkx_qgLO/pub?gid=2001268955&single=true&output=csv';

// later duplicates shift north by their index times this many latitude degrees
const DUPLICATE_COORDINATE_LAT_OFFSET = 0.00009;

// converts object rows to map features while keeping index-aligned raw rows for export
function csvRowsToGeoJSON(rows, sourceRows = []) {
    const features = [];

    rows.forEach((row, rowIndex) => {
        const lat = Number(row.LAT);
        const lon = Number(row.LON);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        const properties = { ...row };
        delete properties.LAT;
        delete properties.LON;

        // normalize the older source header used by some rows
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

        // filter-panel.js exports this raw row while enumerable keys stay valid GeoJSON for Mapbox
        Object.defineProperty(features[features.length - 1], '_sourceRow', {
            value: Array.isArray(sourceRows[rowIndex]) ? sourceRows[rowIndex].slice() : { ...row },
            enumerable: false
        });
    });

    return {
        type: 'FeatureCollection',
        features
    };
}

function getCoordinates(feature) {
    // read geometry first while supporting unconverted source records
    const coordinates = feature.geometry?.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
        return [Number(coordinates[0]), Number(coordinates[1])];
    }

    const lon = Number(feature.properties?.LON);
    const lat = Number(feature.properties?.LAT);
    return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function coordinateKey(coordinates) {
    // stable map key for matching exact longitude latitude pairs
    return coordinates.map(value => String(value)).join(',');
}

function offsetDuplicateCoordinateFeatures(geojson) {
    // keep the first coordinate fixed and stagger later duplicates northward
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
    // mapbox filters and selection use feature ids
    geojson.features.forEach((feature, index) => {
        feature.id = index;
    });
    return geojson;
}

async function loadLandmarkSourceData() {
    // fetch the published sheet and prepare mapbox-ready geojson
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
    // Papa renames duplicate object headers, so array rows retain the spreadsheet schema for export
    const rawParsed = Papa.parse(csvText, {
        skipEmptyLines: true
    });
    const sourceFields = Array.isArray(rawParsed.data[0]) ? rawParsed.data[0] : [];
    const sourceRows = rawParsed.data.slice(1);

    const geojson = csvRowsToGeoJSON(parsed.data, sourceRows);

    // filter-panel.js reads this non-enumerable schema without sending it to Mapbox
    Object.defineProperty(geojson, '_sourceFields', {
        value: sourceFields.slice(),
        enumerable: false
    });

    // ids and offsets must be assigned before mapbox receives the source
    offsetDuplicateCoordinateFeatures(geojson);
    assignFeatureIds(geojson);

    console.log('GeoJSON created successfully from google sheets data');
    return geojson;
}
