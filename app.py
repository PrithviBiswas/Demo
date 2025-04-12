from flask import Flask, send_from_directory, request, jsonify
import os
from datetime import datetime
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'annotations'

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

@app.route('/save-annotation', methods=['POST'])
def save_annotation():
    try:
        data = request.json
        class_name = data.get('className', 'unknown')
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
                "id": i+1,
                "image_id": 1,
                "category_id": 1,
                "segmentation": [polygon],
                "area": 0,
                "bbox": [],
                "iscrowd": 0
            } for i, polygon in enumerate(data.get('polygons', []))],
            "categories": [{
                "id": 1,
                "name": class_name,
                "supercategory": "object"
            }]
        }
        
        with open(os.path.join(app.config['UPLOAD_FOLDER'], filename), 'w') as f:
            json.dump(coco_data, f, indent=2)
        
        return jsonify({'status': 'success', 'filename': filename})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)
