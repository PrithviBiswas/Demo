const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
const imageUpload = document.getElementById('imageUpload');
const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const addClassBtn = document.getElementById('addClassBtn');
const newClassName = document.getElementById('newClassName');
const newClassColor = document.getElementById('newClassColor');
const classList = document.getElementById('classList');

let isDrawing = false;
let currentPolygon = [];
let polygons = [];
let classes = [];
let activeClass = null;
let img = null;
let scaleFactor = 1;
let selectedPoint = null;
let isDragging = false;
const POINT_RADIUS = 5;

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

// Class management
addClassBtn.addEventListener('click', function() {
    const name = newClassName.value.trim();
    const color = newClassColor.value;
    
    if (name && !classes.some(c => c.name === name)) {
        const newClass = { name, color, id: classes.length + 1 };
        classes.push(newClass);
        activeClass = newClass;
        renderClassList();
        newClassName.value = '';
    }
});

function renderClassList() {
    classList.innerHTML = '';
    classes.forEach(cls => {
        const classItem = document.createElement('div');
        classItem.className = `class-item ${activeClass?.id === cls.id ? 'active' : ''}`;
        classItem.innerHTML = `
            <div class="class-color" style="background-color: ${cls.color}"></div>
            <span>${cls.name}</span>
        `;
        classItem.addEventListener('click', () => {
            activeClass = cls;
            renderClassList();
        });
        classList.appendChild(classItem);
    });
}

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
        polygons.push({
            points: [...currentPolygon],
            classId: activeClass?.id || 1
        });
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
    // Check polygons array (completed polygons)
    for (const poly of polygons) {
        for (const point of poly.points) {
            const dist = Math.sqrt(
                Math.pow(pos.x - point.x, 2) + 
                Math.pow(pos.y - point.y, 2)
            );
            if (dist <= POINT_RADIUS) {
                return point;
            }
        }
    }
    
    // Check current polygon (in-progress)
    for (const point of currentPolygon) {
        const dist = Math.sqrt(
            Math.pow(pos.x - point.x, 2) + 
            Math.pow(pos.y - point.y, 2)
        );
        if (dist <= POINT_RADIUS) {
            return point;
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
    ctx.strokeStyle = activeClass?.color || 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function redrawPolygons() {
    if (!img) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    for (const poly of [...polygons, {points: currentPolygon}]) {
        if (!poly.points || poly.points.length < 2) continue;
        
        const polygonClass = classes.find(c => c.id === poly.classId) || activeClass;
        ctx.strokeStyle = polygonClass?.color || 'rgba(255,0,0,0.5)';
        ctx.fillStyle = polygonClass?.color || 'rgba(255,0,0,0.5)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        
        for (let i = 1; i < poly.points.length; i++) {
            ctx.lineTo(poly.points[i].x, poly.points[i].y);
        }
        
        if (poly.points === currentPolygon) {
            ctx.stroke();
        } else {
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }
    }
    
    for (const poly of [...polygons, {points: currentPolygon}]) {
        if (!poly.points) continue;
        for (const point of poly.points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = point === selectedPoint ? '#00FF00' : '#FF0000';
            ctx.fill();
        }
    }
}

function saveAnnotation() {
    if (polygons.length > 0 && img && classes.length > 0) {
        const annotations = {
            image: imageUpload.files[0]?.name,
            width: img.width,
            height: img.height,
            polygons: polygons.map(poly => ({
                classId: poly.classId,
                points: poly.points.flatMap(point => [point.x / scaleFactor, point.y / scaleFactor])
            })),
            classes: classes
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
