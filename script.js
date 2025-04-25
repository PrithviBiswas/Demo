/**
 * Image Annotation Tool - Modularized and Improved
 */

const canvasElement = document.getElementById('annotationCanvas');
const fabricCanvas = new fabric.Canvas('annotationCanvas', {
    selection: false,
    preserveObjectStacking: true,
    skipTargetFind: false
});

const imageUpload = document.getElementById('imageUpload');
const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const addClassBtn = document.getElementById('addClassBtn');
const newClassName = document.getElementById('newClassName');
const newClassColor = document.getElementById('newClassColor');
const classList = document.getElementById('classList');
const showPolygonBtn = document.getElementById('showPolygonBtn');

let isDrawing = false;
let currentPolygonPoints = [];
let polygons = [];
let classes = [];
let activeClass = null;
let img = null;
let scaleFactor = 1;

let tempPolygon = null;
let tempVertexCircles = [];

/**
 * Initialize event listeners
 */
function initEventListeners() {
    addClassBtn.addEventListener('click', onAddClass);
    imageUpload.addEventListener('change', onImageUpload);
    drawBtn.addEventListener('click', onDrawToggle);
    clearBtn.addEventListener('click', onClearCanvas);
    saveBtn.addEventListener('click', saveAnnotation);
    showPolygonBtn.addEventListener('click', onShowPolygon);
}

/**
 * Render the list of classes in the UI.
 */
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

/**
 * Add a new class if valid.
 */
function onAddClass() {
    const name = newClassName.value.trim();
    const color = newClassColor.value;

    if (name && !classes.some(c => c.name === name)) {
        const newClass = { name, color, id: classes.length + 1 };
        classes.push(newClass);
        activeClass = newClass;
        renderClassList();
        newClassName.value = '';
    }
}

/**
 * Handle image upload and setup canvas.
 */
function onImageUpload(e) {
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
}

/**
 * Toggle drawing mode.
 */
function onDrawToggle() {
    isDrawing = !isDrawing;
    drawBtn.textContent = isDrawing ? 'Drawing...' : 'Draw Polygon';
    if (isDrawing) {
        startDrawing();
    } else {
        stopDrawing();
    }
}

/**
 * Start drawing mode.
 */
function startDrawing() {
    currentPolygonPoints = [];
    removeTemporaryPolygon();

    fabricCanvas.selection = false;
    fabricCanvas.defaultCursor = 'crosshair';
    fabricCanvas.on('mouse:down', onCanvasMouseDown);
    fabricCanvas.on('mouse:dblclick', completePolygon);
}

/**
 * Stop drawing mode.
 */
function stopDrawing() {
    fabricCanvas.selection = false;
    fabricCanvas.defaultCursor = 'default';
    fabricCanvas.off('mouse:down', onCanvasMouseDown);
    fabricCanvas.off('mouse:dblclick', completePolygon);
    if (currentPolygonPoints.length > 2) {
        addPolygon(currentPolygonPoints);
    }
    currentPolygonPoints = [];
    removeTemporaryPolygon();
}

/**
 * Handle mouse down event during drawing.
 */
function onCanvasMouseDown(options) {
    if (!isDrawing) return;
    const pointer = fabricCanvas.getPointer(options.e);
    currentPolygonPoints.push({ x: pointer.x, y: pointer.y });
    drawTemporaryPolygon();
    drawTemporaryVertexCircles();
}

/**
 * Complete the polygon being drawn.
 */
function completePolygon() {
    if (currentPolygonPoints.length > 2) {
        addPolygon(currentPolygonPoints);
        currentPolygonPoints = [];
        removeTemporaryPolygon();
    }
}

/**
 * Clear the canvas and polygons.
 */
function onClearCanvas() {
    fabricCanvas.clear();
    if (img) {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
    }
    clearAllPolygons();
}

/**
 * Show polygon from loaded data.
 */
function onShowPolygon() {
    const data = getJSONData('segmentation-data');
    const classData = getJSONData('class-data');

    if (!data || data.length === 0) {
        alert('No segmentation points data available');
        return;
    }

    if (classData && !classes.some(c => c.id === classData.id || c.name === classData.name)) {
        classes.push(classData);
        renderClassList();
    }

    activeClass = classData;
    currentPolygonPoints = data.map(point => ({ x: point[0] * scaleFactor, y: point[1] * scaleFactor }));
    addPolygon(currentPolygonPoints);
}

/**
 * Get JSON data from script tag by id.
 */
function getJSONData(id) {
    const scriptTag = document.getElementById(id);
    if (!scriptTag) return null;
    try {
        return JSON.parse(scriptTag.textContent);
    } catch (e) {
        console.error(`Error parsing JSON from script tag with id ${id}:`, e);
        return null;
    }
}

/**
 * Draw temporary polygon during drawing.
 */
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

/**
 * Draw temporary vertex circles during drawing.
 */
function drawTemporaryVertexCircles() {
    removeTemporaryVertexCircles();
    currentPolygonPoints.forEach((point, index) => {
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
        circle.on('moving', function() {
            const pos = circle.getCenterPoint();
            currentPolygonPoints[index].x = pos.x;
            currentPolygonPoints[index].y = pos.y;
            drawTemporaryPolygon();
            drawTemporaryVertexCircles();
        });
        tempVertexCircles.push(circle);
        fabricCanvas.add(circle);
    });
    fabricCanvas.renderAll();
}

/**
 * Remove temporary polygon and vertex circles.
 */
function removeTemporaryPolygon() {
    if (tempPolygon) {
        fabricCanvas.remove(tempPolygon);
        tempPolygon = null;
    }
    removeTemporaryVertexCircles();
    fabricCanvas.renderAll();
}

/**
 * Remove all temporary vertex circles.
 */
function removeTemporaryVertexCircles() {
    tempVertexCircles.forEach(circle => fabricCanvas.remove(circle));
    tempVertexCircles = [];
}

/**
 * Clear all polygons and vertex circles.
 */
function clearAllPolygons() {
    polygons.forEach(p => {
        fabricCanvas.remove(p.polygon);
        p.vertexCircles.forEach(c => fabricCanvas.remove(c));
    });
    polygons = [];
    currentPolygonPoints = [];
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
}

/**
 * Add polygon to canvas with event listeners and vertex circles.
 */
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
        lockMovementY: true,
        selectionColor: 'transparent',
        selectionLineWidth: 0
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
        circle.on('moving', function() {
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

    fabricCanvas.setActiveObject(polygon);
    fabricCanvas.renderAll();
}

/**
 * Update polygon SVG path string.
 */
function updatePolygonPath(polygon) {
    const points = polygon.points;
    const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ') + ' Z';
    polygon.path = path;
    polygon.set({ dirty: true });
}

/**
 * Update vertex circles position.
 */
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

/**
 * Save annotations to server.
 */
function saveAnnotation() {
    if (polygons.length > 0 && img && classes.length > 0) {
        const annotations = {
            image: imageUpload.files[0]?.name,
            width: img.width / scaleFactor,
            height: img.height / scaleFactor,
            polygons: polygons.map(poly => ({
                classId: poly.classId,
                points: poly.polygon.points.map(point => [point.x / scaleFactor, point.y / scaleFactor])
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

// Initialize event listeners on page load
initEventListeners();
