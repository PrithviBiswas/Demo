const canvasElement = document.getElementById('annotationCanvas');
const fabricCanvas = new fabric.Canvas('annotationCanvas', {
    selection: false,
    preserveObjectStacking: true
});
const imageUpload = document.getElementById('imageUpload');
const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const addClassBtn = document.getElementById('addClassBtn');
const newClassName = document.getElementById('newClassName');
const newClassColor = document.getElementById('newClassColor');
const classList = document.getElementById('classList');

let isDrawing = false;
let currentPolygonPoints = [];
let polygons = [];
let classes = [];
let activeClass = null;
let img = null;
let scaleFactor = 1;

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

imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            fabric.Image.fromURL(event.target.result, function(oImg) {
                img = oImg;
                const maxWidth = 800;
                const maxHeight = 600;
                scaleFactor = Math.min(
                    maxWidth / img.width,
                    maxHeight / img.height
                );
                img.scale(scaleFactor);
                fabricCanvas.setWidth(img.width * scaleFactor);
                fabricCanvas.setHeight(img.height * scaleFactor);
                fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
                clearAllPolygons();
            });
        };
        reader.readAsDataURL(file);
    }
});

drawBtn.addEventListener('click', function() {
    isDrawing = !isDrawing;
    drawBtn.textContent = isDrawing ? 'Drawing...' : 'Draw Polygon';
    if (isDrawing) {
        fabricCanvas.selection = false;
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.on('mouse:down', onCanvasMouseDown);
        fabricCanvas.on('mouse:dblclick', completePolygon);
    } else {
        fabricCanvas.selection = true;
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.off('mouse:down', onCanvasMouseDown);
        fabricCanvas.off('mouse:dblclick', completePolygon);
        if (currentPolygonPoints.length > 2) {
            addPolygon(currentPolygonPoints);
        }
        currentPolygonPoints = [];
        removeTemporaryPolygon();
    }
});

function completePolygon() {
    if (currentPolygonPoints.length > 2) {
        addPolygon(currentPolygonPoints);
        currentPolygonPoints = [];
        removeTemporaryPolygon();
    }
}

clearBtn.addEventListener('click', function() {
    fabricCanvas.clear();
    if (img) {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
    }
    clearAllPolygons();
});

saveBtn.addEventListener('click', saveAnnotation);

let tempPolygon = null;
let tempVertexCircles = [];
let vertexCircles = [];

function onCanvasMouseDown(options) {
    if (!isDrawing) return;
    const pointer = fabricCanvas.getPointer(options.e);
    currentPolygonPoints.push({ x: pointer.x, y: pointer.y });
    drawTemporaryPolygon();
    drawTemporaryVertexCircles();
}

function drawTemporaryPolygon() {
    removeTemporaryPolygon();
    if (currentPolygonPoints.length < 2) return;

    tempPolygon = new fabric.Polyline(currentPolygonPoints, {
        stroke: activeClass?.color || 'rgba(255,0,0,0.5)',
        strokeWidth: 2,
        fill: '',
        selectable: false,
        evented: false
    });
    fabricCanvas.add(tempPolygon);
    fabricCanvas.renderAll();
}

function drawTemporaryVertexCircles() {
    removeTemporaryVertexCircles();
    currentPolygonPoints.forEach(point => {
        const circle = new fabric.Circle({
            left: point.x - 5,
            top: point.y - 5,
            radius: 5,
            fill: activeClass?.color || 'rgba(255,0,0,0.7)',
            selectable: true,
            evented: true,
            originX: 'center',
            originY: 'center'
        });
        circle.on('moving', function(e) {
            const pos = circle.getCenterPoint();
            const index = circle.index;
            currentPolygonPoints[index].x = pos.x;
            currentPolygonPoints[index].y = pos.y;
            drawTemporaryPolygon();
            drawTemporaryVertexCircles();
        });
        circle.index = currentPolygonPoints.indexOf(point);
        tempVertexCircles.push(circle);
        fabricCanvas.add(circle);
    });
    fabricCanvas.renderAll();
}

function removeTemporaryPolygon() {
    if (tempPolygon) {
        fabricCanvas.remove(tempPolygon);
        tempPolygon = null;
    }
    removeTemporaryVertexCircles();
    fabricCanvas.renderAll();
}

function removeTemporaryVertexCircles() {
    tempVertexCircles.forEach(circle => fabricCanvas.remove(circle));
    tempVertexCircles = [];
}

function clearAllPolygons() {
    polygons.forEach(p => {
        fabricCanvas.remove(p.polygon);
        p.vertexCircles.forEach(c => fabricCanvas.remove(c));
    });
    polygons = [];
    vertexCircles = [];
    currentPolygonPoints = [];
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
}

function addPolygon(points) {
    const polygon = new fabric.Polygon(points, {
        stroke: activeClass?.color || 'rgba(255,0,0,0.5)',
        strokeWidth: 2,
        fill: activeClass?.color || 'rgba(255,0,0,0.3)',
        objectCaching: false,
        transparentCorners: false,
        cornerColor: 'blue',
        cornerSize: 8,
        hasRotatingPoint: false,
        perPixelTargetFind: true,
        selectable: true,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true
    });

    polygon.on('moving', () => {
        updateVertexCircles(polygons.find(p => p.polygon === polygon));
        fabricCanvas.renderAll();
    });

    polygon.on('modified', () => {
        const p = polygons.find(p => p.polygon === polygon);
        if (!p) return;
        p.polygon.points = p.polygon.get('points').map(p => ({ x: p.x, y: p.y }));
        updateVertexCircles(p);
        fabricCanvas.renderAll();
    });
    polygon.classId = activeClass?.id || 1;
    fabricCanvas.add(polygon);

    // Create vertex circles for editing
    const circles = points.map((point, index) => {
        const circle = new fabric.Circle({
            left: point.x - 5,
            top: point.y - 5,
            radius: 5,
            fill: 'white',
            stroke: 'black',
            strokeWidth: 1,
            hasBorders: false,
            hasControls: false,
            originX: 'center',
            originY: 'center',
            selectable: true,
            evented: true,
            index: index
        });
        circle.on('moving', function(e) {
            const p = polygons.find(p => p.polygon === polygon);
            if (!p) return;
            const pos = circle.getCenterPoint();
            p.polygon.points[circle.index].x = pos.x;
            p.polygon.points[circle.index].y = pos.y;
            p.polygon.set({ dirty: true });
            p.polygon.setCoords();
            updatePolygonPath(p.polygon);
            updateVertexCircles(p);
            fabricCanvas.renderAll();
        });
        fabricCanvas.add(circle);
        return circle;
    });

    polygons.push({ polygon: polygon, vertexCircles: circles, classId: polygon.classId });

    polygon.on('selected', () => {
        // Show vertex circles for selected polygon
        polygons.forEach(p => {
            p.vertexCircles.forEach(c => c.visible = false);
        });
        const p = polygons.find(p => p.polygon === polygon);
        if (p) {
            p.vertexCircles.forEach(c => c.set('visible', true));
        }
        fabricCanvas.renderAll();
    });

    polygon.on('deselected', () => {
        // Hide vertex circles when polygon is deselected
        const p = polygons.find(p => p.polygon === polygon);
        if (p) {
            p.vertexCircles.forEach(c => c.set('visible', false));
        }
        fabricCanvas.renderAll();
    });

    fabricCanvas.setActiveObject(polygon);
    fabricCanvas.renderAll();
}

function updatePolygonPath(polygon) {
    const points = polygon.points;
    const path = points.map((p, i) => {
        return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
    }).join(' ') + ' Z';
    polygon.path = path;
    polygon.set({ dirty: true });
}

function updateVertexCircles(polygonData) {
    polygonData.vertexCircles.forEach((circle, index) => {
        const point = polygonData.polygon.points[index];
        circle.set({
            left: point.x,
            top: point.y
        });
        circle.setCoords();
    });
}

function saveAnnotation() {
    if (polygons.length > 0 && img && classes.length > 0) {
        const annotations = {
            image: imageUpload.files[0]?.name,
            width: img.width / scaleFactor,
            height: img.height / scaleFactor,
            polygons: polygons.map(poly => ({
                classId: poly.classId,
                points: poly.polygon.points.flatMap(point => [point.x / scaleFactor, point.y / scaleFactor])
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
