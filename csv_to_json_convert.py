import os
import csv
import json

csv_dir = './data'

for filename in os.listdir(csv_dir):
    if filename.lower().endswith('.csv'):
        csv_path = os.path.join(csv_dir, filename)
        json_filename = os.path.splitext(filename)[0] + '.json'
        json_path = os.path.join(csv_dir, json_filename)

        with open(csv_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            data = list(reader)

        with open(json_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(data, jsonfile, indent=4)

        print(f'Converted {csv_path} to {json_path}')
