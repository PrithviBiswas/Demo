/**
 * Get the canvas HTML element and initialize Fabric.js canvas
 * with selection disabled and object stacking preserved.
 */
const canvasElement = document.getElementById('annotationCanvas');
const fabricCanvas = new fabric.Canvas('annotationCanvas', {
    selection: false,
    preserveObjectStacking: true,
    skipTargetFind: false
});

/**
 * Get references to UI elements for image upload, drawing,
 * clearing, saving, and class management.
 */
const imageUpload = document.getElementById('imageUpload');
const drawBtn = document.getElementById('drawBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const addClassBtn = document.getElementById('addClassBtn');
const newClassName = document.getElementById('newClassName');
const newClassColor = document.getElementById('newClassColor');
const classList = document.getElementById('classList');

/**
 * Flag indicating whether the user is currently drawing a polygon.
 */
let isDrawing = false;

/**
 * Array of points (objects with x and y) representing the current polygon being drawn.
 */
let currentPolygonPoints = [];

/**
 * Array of polygon objects, each containing the Fabric polygon and its vertex circles.
 */
let polygons = [];

/**
 * Array of class objects, each with name, color, and id.
 */
let classes = [];

/**
 * The currently active class selected for polygon annotation.
 */
let activeClass = null;

/**
 * Fabric.js Image object representing the uploaded image.
 */
let img = null;

/**
 * Scale factor applied to the image and polygons for fitting the canvas.
 */
let scaleFactor = 1;

/**
 * Render the list of classes in the UI.
 * Highlights the active class.
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
 * Event listener for adding a new class.
 * Adds the class if the name is unique and non-empty.
 */
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

/**
 * Event listener for image upload.
 * Loads the image into the Fabric canvas and scales it to fit.
 * Clears existing polygons on new image load.
 */
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

/**
 * Event listener for the draw button.
 * Toggles drawing mode on and off.
 * When drawing, sets cursor and enables mouse events for drawing.
 * When not drawing, finalizes polygon and disables drawing events.
 */
drawBtn.addEventListener('click', function() {
    isDrawing = !isDrawing;
    drawBtn.textContent = isDrawing ? 'Drawing...' : 'Draw Polygon';
    if (isDrawing) {
        fabricCanvas.selection = false;
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.on('mouse:down', onCanvasMouseDown);
        fabricCanvas.on('mouse:dblclick', completePolygon);
    } else {
        fabricCanvas.selection = false; // Keep selection false to remove bounding box
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

/**
 * Completes the current polygon being drawn if it has at least 3 points.
 * Adds the polygon to the canvas and resets the current points.
 */
function completePolygon() {
    if (currentPolygonPoints.length > 2) {
        addPolygon(currentPolygonPoints);
        currentPolygonPoints = [];
        removeTemporaryPolygon();
    }
}

/**
 * Event listener for the clear button.
 * Clears the canvas and resets polygons.
 * Restores the background image if present.
 */
clearBtn.addEventListener('click', function() {
    fabricCanvas.clear();
    if (img) {
        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
    }
    clearAllPolygons();
});

/**
 * Event listener for the save button.
 * Calls the saveAnnotation function to save polygon annotations.
 */
saveBtn.addEventListener('click', saveAnnotation);

/**
 * Temporary polygon used during drawing before completion.
 */
let tempPolygon = null;

/**
 * Temporary vertex circles used during drawing before completion.
 */
let tempVertexCircles = [];

/**
 * Array of vertex circles for existing polygons.
 */
let vertexCircles = [];

/**
 * Handler for mouse down event on the canvas during drawing mode.
 * Adds the clicked point to current polygon points and updates temporary polygon and vertices.
 * @param {Object} options - Fabric.js mouse event options.
 */
function onCanvasMouseDown(options) {
    if (!isDrawing) return;
    const pointer = fabricCanvas.getPointer(options.e);
    currentPolygonPoints.push({ x: pointer.x, y: pointer.y });
    drawTemporaryPolygon();
    drawTemporaryVertexCircles();
}

/**
 * Draws a temporary polygon (polyline) on the canvas during drawing mode.
 * Removes any existing temporary polygon before drawing.
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
 * Draws temporary vertex circles on the canvas during drawing mode.
 * Removes existing temporary vertex circles before drawing.
 * Adds event listeners to update polygon points when vertices are moved.
 */
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

/**
 * Removes the temporary polygon and its vertex circles from the canvas.
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
 * Removes all temporary vertex circles from the canvas.
 */
function removeTemporaryVertexCircles() {
    tempVertexCircles.forEach(circle => fabricCanvas.remove(circle));
    tempVertexCircles = [];
}

/**
 * Clears all polygons and their vertex circles from the canvas.
 * Resets polygon and vertex circle arrays and current points.
 */
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

/**
 * Adds a polygon to the canvas with given points.
 * Sets up event listeners for moving and modifying the polygon.
 * Creates vertex circles for editing polygon points.
 * @param {Array} points - Array of point objects {x, y} for the polygon vertices.
 */
function addPolygon(points) {
    const polygon = new fabric.Polygon(points, {
        stroke: activeClass?.color || 'rgba(255,0,0,0.5)', // Stroke color of polygon
        strokeWidth: 2, // Width of polygon stroke
        fill: activeClass?.color || 'rgba(255,0,0,0.3)', // Fill color of polygon
        objectCaching: false, // Disable object caching for better performance during editing
        transparentCorners: false, // Corners are not transparent
        cornerColor: 'blue', // Color of control corners
        cornerSize: 8, // Size of control corners
        hasRotatingPoint: false, // Disable rotation control
        perPixelTargetFind: true, // Enable per-pixel target detection for better hit testing
        selectable: true, // Polygon is selectable
        hasBorders: false, // Disable bounding box borders
        hasControls: false, // Disable control handles
        lockMovementX: true, // Lock movement in X axis
        lockMovementY: true, // Lock movement in Y axis
        selectionColor: 'transparent', // Transparent selection color
        selectionLineWidth: 0 // No selection line width
    });

    // Event listener for when polygon is moved
    polygon.on('moving', () => {
        updateVertexCircles(polygons.find(p => p.polygon === polygon)); // Update vertex circles position
        fabricCanvas.renderAll(); // Re-render canvas
    });

    // Event listener for when polygon is modified (e.g., after dragging)
    polygon.on('modified', () => {
        const p = polygons.find(p => p.polygon === polygon);
        if (!p) return;
        // Update polygon points to current positions
        p.polygon.points = p.polygon.get('points').map(p => ({ x: p.x, y: p.y }));
        updateVertexCircles(p); // Update vertex circles position
        fabricCanvas.renderAll(); // Re-render canvas
    });

    polygon.classId = activeClass?.id || 1; // Assign class ID to polygon
    fabricCanvas.add(polygon); // Add polygon to canvas

    // Create vertex circles for editing polygon vertices
    const circles = points.map((point, index) => {
        const circle = new fabric.Circle({
            left: point.x - 5, // Position circle centered on vertex
            top: point.y - 5,
            radius: 5, // Radius of vertex circle
            fill: 'white', // Fill color of vertex circle
            stroke: 'black', // Stroke color of vertex circle
            strokeWidth: 1, // Stroke width of vertex circle
            hasBorders: false, // No borders on vertex circle
            hasControls: false, // No controls on vertex circle
            originX: 'center', // Origin centered horizontally
            originY: 'center', // Origin centered vertically
            selectable: true, // Vertex circle is selectable
            evented: true, // Vertex circle responds to events
            index: index // Index of vertex in polygon points array
        });
        // Event listener for moving vertex circle
        circle.on('moving', function(e) {
            const p = polygons.find(p => p.polygon === polygon);
            if (!p) return;
            const pos = circle.getCenterPoint();
            // Update corresponding polygon point to new position
            p.polygon.points[circle.index].x = pos.x;
            p.polygon.points[circle.index].y = pos.y;
            p.polygon.set({ dirty: true }); // Mark polygon as dirty for re-render
            p.polygon.setCoords(); // Update polygon coordinates
            updatePolygonPath(p.polygon); // Update polygon path string
            updateVertexCircles(p); // Update vertex circles position
            fabricCanvas.renderAll(); // Re-render canvas
        });
        fabricCanvas.add(circle); // Add vertex circle to canvas
        return circle;
    });

    polygons.push({ polygon: polygon, vertexCircles: circles, classId: polygon.classId }); // Add polygon and its vertices to polygons array

    fabricCanvas.setActiveObject(polygon); // Set polygon as active object
    fabricCanvas.renderAll(); // Render canvas
}

/**
 * Updates the SVG path string of the polygon based on its points.
 * @param {fabric.Polygon} polygon - The polygon object to update.
 */
function updatePolygonPath(polygon) {
    const points = polygon.points;
    const path = points.map((p, i) => {
        return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
    }).join(' ') + ' Z';
    polygon.path = path;
    polygon.set({ dirty: true });
}

/**
 * Updates the position of vertex circles to match the polygon points.
 * @param {Object} polygonData - Object containing polygon and its vertex circles.
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
 * Saves the current annotations by sending polygon data and classes to the server.
 * Scales polygon points back to original image size before sending.
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
