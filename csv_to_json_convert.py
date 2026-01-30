import os
import csv
import json

csv_dir = './data'

for filename in os.listdir(csv_dir):
    if filename.lower().endswith('.csv'):
        csv_path = os.path.join(csv_dir, filename)
        geojson_filename = os.path.splitext(filename)[0] + '.geojson'
        geojson_path = os.path.join(csv_dir, geojson_filename)

        features = []
        with open(csv_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    lat = float(row.pop('LAT'))
                    lon = float(row.pop('LON'))
                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [lon, lat]
                        },
                        'properties': row
                    }
                    features.append(feature)
                except (ValueError, KeyError) as e:
                    print(f"Skipping row due to error: {e}. Row: {row}")

        feature_collection = {
            'type': 'FeatureCollection',
            'features': features
        }

        with open(geojson_path, 'w', encoding='utf-8') as geojsonfile:
            json.dump(feature_collection, geojsonfile, indent=4)

        print(f'Converted {csv_path} to {geojson_path}')
