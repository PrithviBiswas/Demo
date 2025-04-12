const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
const imageUpload = document.getElementById('imageUpload');
const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const colorPicker = document.getElementById('colorPicker');

let isDrawing = false;
let currentPolygon = [];
let polygons = [];
let img = null;
let scaleFactor = 1;
let selectedPoint = null;
let isDragging = false;
const POINT_RADIUS = 5;
let currentColor = 'rgba(255,0,0,0.5)'; // Default color

// Handle image upload
imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            img = new Image();
            img.onload = function() {
                const maxWidth = 800;
                const maxHeight = 600;
                scaleFactor = Math.min(
                    maxWidth / img.width,
                    maxHeight / img.height
                );
                
                canvas.width = img.width * scaleFactor;
                canvas.height = img.height * scaleFactor;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                redrawPolygons();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Color picker change event
colorPicker.addEventListener('change', function() {
    currentColor = this.value;
});

// Drawing mode toggle
drawBtn.addEventListener('click', function() {
    isDrawing = !isDrawing;
    drawBtn.textContent = isDrawing ? 'Drawing...' : 'Draw Polygon';
    selectedPoint = null;
});

// Clear canvas
clearBtn.addEventListener('click', function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    currentPolygon = [];
    polygons = [];
    selectedPoint = null;
});

// Save annotation
saveBtn.addEventListener('click', saveAnnotation);

// Drawing event handlers
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('dblclick', completePolygon);

function handleMouseDown(e) {
    const pos = getMousePos(e);
    
    if (isDrawing) {
        currentPolygon.push(pos);
        redrawPolygons();
    } else {
        selectedPoint = findPointNear(pos);
        isDragging = selectedPoint !== null;
    }
}

function handleMouseMove(e) {
    const pos = getMousePos(e);
    
    if (isDragging && selectedPoint) {
        selectedPoint.x = pos.x;
        selectedPoint.y = pos.y;
        redrawPolygons();
    } else if (isDrawing && currentPolygon.length > 0) {
        redrawPolygons();
        drawCurrentSegment(pos);
    }
}

function handleMouseUp() {
    isDragging = false;
}

function completePolygon() {
    if (currentPolygon.length > 2) {
        polygons.push([...currentPolygon]);
        currentPolygon = [];
        redrawPolygons();
    }
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function findPointNear(pos) {
    for (const polygon of [...polygons, currentPolygon]) {
        for (const point of polygon) {
            const dist = Math.sqrt(
                Math.pow(pos.x - point.x, 2) + 
                Math.pow(pos.y - point.y, 2)
            );
            if (dist <= POINT_RADIUS) {
                return point;
            }
        }
    }
    return null;
}

function drawCurrentSegment(toPos) {
    if (currentPolygon.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    
    for (let i = 1; i < currentPolygon.length; i++) {
        ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y);
    }
    
    ctx.lineTo(toPos.x, toPos.y);
    ctx.strokeStyle = currentColor; // Use selected color
    ctx.lineWidth = 2;
    ctx.stroke();
}

function redrawPolygons() {
    if (!img) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.fillStyle = currentColor; // Use selected color
    
    for (const polygon of [...polygons, currentPolygon]) {
        if (polygon.length < 2) continue;
        
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        
        for (let i = 1; i < polygon.length; i++) {
            ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        
        if (polygon === currentPolygon) {
            ctx.stroke();
        } else {
            ctx.closePath();
            ctx.stroke();
            ctx.fill(); // Fill with selected color
        }
    }
    
    for (const polygon of [...polygons, currentPolygon]) {
        for (const point of polygon) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = point === selectedPoint ? '#00FF00' : '#FF0000';
            ctx.fill();
        }
    }
}

function saveAnnotation() {
    if (polygons.length > 0 && img) {
        const className = document.getElementById('className').value || 'unknown';
        const annotations = {
            className: className,
            image: imageUpload.files[0]?.name,
            width: img.width,
            height: img.height,
            color: currentColor,
            polygons: polygons.map(poly => 
                poly.flatMap(point => [point.x / scaleFactor, point.y / scaleFactor])
            )
        };
        
        fetch('/save-annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(annotations)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`COCO annotation saved as ${data.filename}`);
            } else {
                alert('Error saving annotation: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to save annotation');
        });
    } else {
        alert(img ? 'No polygons to save' : 'Please upload an image first');
    }
}
