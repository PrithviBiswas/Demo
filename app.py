from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from datetime import datetime
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'annotations'

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# Example segmentation_points data to pass to template
segmentation_points = [
    [100, 200],
    [230, 243],
    [150, 300],
    [120, 280]
]

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
    return render_template('index.html', segmentation_points=segmentation_points)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)
