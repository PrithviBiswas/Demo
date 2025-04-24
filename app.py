from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from datetime import datetime
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'annotations'

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# Example segmentation_points data to pass to template
segmentation_points =   [
          [
            71.88053802346468,
            127.76117141723633
          ],
          [
            34.18812063969015,
            183.20117141723634
          ],
          [
            30.341955600529484,
            244.80117141723633
          ],
          [
            51.876644858989884,
            320.2611714172363
          ],
          [
            78.03440208612174,
            362.61117141723633
          ],
          [
            106.49602337591067,
            391.10117141723634
          ],
          [
            137.26534368919602,
            398.80117141723633
          ],
          [
            181.88085814345976,
            401.11117141723633
          ],
          [
            235.7271686917091,
            388.79117141723634
          ],
          [
            282.65038216946925,
            358.7611714172363
          ],
          [
            298.03504232611186,
            326.42117141723634
          ],
          [
            296.49657631044767,
            266.36117141723633
          ],
          [
            325.72743060806874,
            248.65117141723633
          ],
          [
            323.41973158457233,
            204.76117141723634
          ],
          [
            320.3427995532438,
            183.97117141723632
          ],
          [
            310.342770451426,
            154.71117141723633
          ],
          [
            284.1888481851335,
            159.33117141723633
          ],
          [
            240.34256673870192,
            145.47117141723632
          ],
          [
            200.34245033143094,
            113.90117141723633
          ],
          [
            166.4961979868171,
            106.20117141723632
          ],
          [
            134.18457669702818,
            120.06117141723632
          ],
          [
            101.11139232108573,
            111.59117141723632
          ]
        ]
# Add class data to be passed to template
default_class = {
    "name": "Default Class",
    "color": "rgba(255,0,0,0.5)"
}

@app.route('/save-annotation', methods=['POST'])
def save_annotation():
    try:
        data = request.json
        classes = data.get('classes', [])
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"coco_{timestamp}.json"
        
        coco_data = {
            "info": {
                "description": "COCO Annotation File",
                "version": "1.0",
                "year": datetime.now().year,
                "date_created": datetime.now().strftime("%Y/%m/%d")
            },
            "images": [{
                "id": 1,
                "file_name": data.get('image', ''),
                "width": data.get('width', 0),
                "height": data.get('height', 0),
                "date_captured": timestamp
            }],
            "annotations": [{
                "id": idx + 1,
                "image_id": 1,
                "category_id": polygon['classId'],
                "segmentation": [polygon['points']],
                "area": 0,
                "bbox": [],
                "iscrowd": 0
            } for idx, polygon in enumerate(data.get('polygons', []))],
            "categories": [{
                "id": i + 1,
                "name": cls['name'],
                "supercategory": "object"
            } for i, cls in enumerate(classes)]
        }
        
        with open(os.path.join(app.config['UPLOAD_FOLDER'], filename), 'w') as f:
            json.dump(coco_data, f, indent=2)
        
        return jsonify({'status': 'success', 'filename': filename})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/')
def serve_index():
    print("Debug: segmentation_points =", segmentation_points)
    return render_template("index.html", segmentation_points=segmentation_points, default_class=default_class)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)
