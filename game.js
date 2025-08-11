const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    
    temporaryPole: null, 
    currentCurvePoints: [],
    curveGuideMeshes: [],

    // Gerenciamento de objetos da cidade
    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    // Gerenciamento de energia
    powerAvailable: 0,
    powerNeeded: 0,

    // Grid lógico para regras de construção
    logicalGrid: [],
    gridWorldSize: 500,
    gridCells: 50,

    init: function() {
        if (this.isInitialized) return;
        this.gridCells = this.gridWorldSize / this.gridSize;
        this.initializeLogicalGrid();
        this.setupScene();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate();
        this.isInitialized = true;
        this.updatePowerUI();
    },
    
    initializeLogicalGrid: function() {
        this.logicalGrid = [];
        for (let i = 0; i < this.gridCells; i++) {
            this.logicalGrid[i] = [];
            for (let j = 0; j < this.gridCells; j++) {
                this.logicalGrid[i][j] = 0; // 0: Vazio, 1: Estrada, 2: Construível
            }
        }
    },

    setupScene: function() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.cameraPivot = new THREE.Object3D(); this.scene.add(this.cameraPivot);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 80, 50); this.camera.lookAt(this.cameraPivot.position);
        this.cameraPivot.add(this.camera);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(50, 100, 25); this.scene.add(dirLight);

        this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.gridWorldSize, this.gridWorldSize), new THREE.MeshLambertMaterial({ color: 0x55902A }));
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.mapPlane.userData.isGround = true;
        this.scene.add(this.mapPlane);
        
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 1, this.gridSize);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
        this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.buildCursor.visible = false; this.scene.add(this.buildCursor);

        this.powerOverlay = new THREE.Group();
        this.powerOverlay.visible = false;
        this.scene.add(this.powerOverlay);
    },

    setBuildMode: function(mode) {
        if(this.buildMode === 'road-curved' && this.currentCurvePoints.length > 0) {
            this.cancelCurvedRoad();
        }
        this.buildMode = mode;
        this.buildCursor.visible = (mode !== 'select');
        this.isDrawing = false; 
        this.startPoint = null;
        if (this.temporaryPole) {
            this.scene.remove(this.temporaryPole);
            this.temporaryPole = null;
        }
    },

    setupControls: function() {
        const options = { zone: document.getElementById('joystick-zone'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 120 };
        this.joystick = nipplejs.create(options);
        this.joystick.on('move', (evt, data) => {
            const angle = data.angle.radian; const force = data.force;
            this.moveDirection.x = Math.cos(angle) * force; this.moveDirection.z = -Math.sin(angle) * force;
        }).on('end', () => { this.moveDirection.x = 0; this.moveDirection.z = 0; });

        document.getElementById('camera-mode-btn')?.addEventListener('click', (event) => {
            this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move';
            event.target.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]';
        });
        document.getElementById('power-overlay-btn')?.addEventListener('click', () => this.togglePowerOverlay());
        
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousemove', (e) => this.updateCursor(e.clientX, e.clientY));
        canvas.addEventListener('click', () => this.handleMapClick());
        
        window.addEventListener('keydown', (e) => {
            if (this.buildMode === 'road-curved') {
                if (e.key === 'Enter') this.finalizeCurvedRoad();
                else if (e.key === 'Escape') this.cancelCurvedRoad();
            }
        });
    },
    
    updateCursor: function(x, y) {
        if (!this.buildCursor.visible) return;
        this.mouse.x = (x / window.innerWidth) * 2 - 1; this.mouse.y = -(y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mapPlane);
        
        if (intersects.length > 0) {
            const pos = intersects[0].point;
            const gridX = Math.round(pos.x / this.gridSize);
            const gridZ = Math.round(pos.z / this.gridSize);
            this.buildCursor.position.set(gridX * this.gridSize, 0.5, gridZ * this.gridSize);
            
            if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
                const logicalCoords = this.worldToGridCoords(this.buildCursor.position);
                if (logicalCoords && this.logicalGrid[logicalCoords.x][logicalCoords.z] === 2) {
                    this.buildCursor.material.color.set(0x00ff00);
                } else {
                    this.buildCursor.material.color.set(0xff0000);
                }
            } else if (this.buildMode === 'demolish') {
                this.buildCursor.material.color.set(0xff0000);
            } else {
                 this.buildCursor.material.color.set(0xffffff);
            }
        }
    },
    
    handleMapClick: function() {
        if (this.buildMode === 'demolish') {
            this.demolishObject();
        } else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) {
            this.handleLinePlacement();
        } else {
            this.placeObject();
        }
    },

    handleLinePlacement: function() {
        const currentPos = this.buildCursor.position.clone();
        
        if (this.buildMode === 'road-curved') {
            this.currentCurvePoints.push(currentPos);
            const guideGeo = new THREE.SphereGeometry(1, 8, 8);
            const guideMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const guideMesh = new THREE.Mesh(guideGeo, guideMat);
            guideMesh.position.copy(currentPos);
            this.scene.add(guideMesh);
            this.curveGuideMeshes.push(guideMesh);
        } else if (this.buildMode === 'road') {
            if (!this.isDrawing) {
                this.startPoint = currentPos;
                this.isDrawing = true;
            } else {
                this.createRoadSegment(this.startPoint, currentPos);
                this.isDrawing = false;
                this.startPoint = null;
            }
        } else if (this.buildMode === 'power-line') {
             if (!this.isDrawing) {
                this.startPoint = currentPos;
                const poleHeight = 12;
                const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
                this.temporaryPole = new THREE.Mesh(poleGeo, poleMat);
                this.temporaryPole.position.copy(this.startPoint).y = poleHeight / 2;
                this.scene.add(this.temporaryPole);
                this.isDrawing = true;
            } else {
                const endPoint = currentPos;
                if (this.startPoint.distanceTo(endPoint) > 0) {
                    this.scene.remove(this.temporaryPole); 
                    this.createPowerLineObject(this.startPoint, endPoint, this.temporaryPole);
                } else {
                    this.scene.remove(this.temporaryPole);
                }
                this.isDrawing = false;
                this.startPoint = null;
                this.temporaryPole = null;
            }
        } 
    },

    finalizeCurvedRoad: function() {
        if (this.currentCurvePoints.length < 2) {
            this.cancelCurvedRoad();
            return;
        }
        const curve = new THREE.CatmullRomCurve3(this.currentCurvePoints);
        const roadWidth = this.gridSize * 0.8;
        const tubularSegments = Math.floor(curve.getLength() * 2);
        const geo = new THREE.TubeGeometry(curve, tubularSegments, roadWidth / 2, 8, false);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.y = 0.05; 
        mesh.position.y = 0.1;
        mesh.userData = { type: 'road-curved', points: [...this.currentCurvePoints] };
        this.checkForAndProcessIntersections(mesh);
        this.cancelCurvedRoad();
    },

    cancelCurvedRoad: function() {
        this.curveGuideMeshes.forEach(mesh => this.scene.remove(mesh));
        this.curveGuideMeshes = [];
        this.currentCurvePoints = [];
    },
    
    createRoadSegment: function(start, end) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        if(length === 0) return;
        const geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start).add(path.clone().multiplyScalar(0.5));
        mesh.rotation.y = Math.atan2(path.x, path.z);
        mesh.userData = { type: 'road', startPoint: start.clone(), endPoint: end.clone() };
        this.checkForAndProcessIntersections(mesh);
    },

    checkForAndProcessIntersections: function(newRoadObject) {
        let intersections = [];
        const newRoadSegments = this.getRoadSegments(newRoadObject);
        const roadsToCheck = this.cityObjects.filter(obj => obj.userData.type?.startsWith('road'));

        for (const existingRoad of roadsToCheck) {
            const existingRoadSegments = this.getRoadSegments(existingRoad);
            for (const newSeg of newRoadSegments) {
                for (const existingSeg of existingRoadSegments) {
                    const intersectionPoint = this.lineSegmentIntersection(newSeg.p1, newSeg.p2, existingSeg.p1, existingSeg.p2);
                    if (intersectionPoint) {
                        intersections.push({ point: intersectionPoint, road1: newRoadObject, road2: existingRoad });
                    }
                }
            }
        }

        if (intersections.length > 0) {
            const roadsToReplace = new Set();
            intersections.forEach(i => {
                roadsToReplace.add(i.road1);
                roadsToReplace.add(i.road2);
            });
            
            roadsToReplace.forEach(road => this.removeObject(road, false));
            intersections.forEach(i => this.createIntersectionNode(i.point));

            roadsToReplace.forEach(road => {
                let roadPoints = (road.userData.type === 'road') ? [road.userData.startPoint, road.userData.endPoint] : road.userData.points;
                let intersectionPointsOnThisRoad = intersections.filter(i => i.road1 === road || i.road2 === road).map(i => i.point);
                const allPoints = [...roadPoints, ...intersectionPointsOnThisRoad].sort((a, b) => roadPoints[0].distanceTo(a) - roadPoints[0].distanceTo(b));

                for (let i = 0; i < allPoints.length - 1; i++) {
                    const p1 = allPoints[i];
                    const p2 = allPoints[i+1];
                    if (p1.distanceTo(p2) > 1) { 
                        this.addRoadObjectToScene(this.createRoadMesh(p1, p2));
                    }
                }
            });
        } else {
            this.addRoadObjectToScene(newRoadObject);
        }
        this.recalculateAllRoadAdjacency();
        this.updatePowerGrid();
    },

    createRoadMesh: function(p1, p2) {
        const path = new THREE.Vector3().subVectors(p2, p1);
        const length = path.length();
        const geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(p1).add(path.clone().multiplyScalar(0.5));
        mesh.rotation.y = Math.atan2(path.x, path.z);
        mesh.userData = { type: 'road', startPoint: p1.clone(), endPoint: p2.clone() };
        return mesh;
    },

    addRoadObjectToScene: function(roadObject) {
        roadObject.userData.isPowered = false;
        roadObject.userData.powerRadius = this.gridSize * 0.6;
        roadObject.userData.consumption = 0.1 * (roadObject.userData.points ? roadObject.userData.points.length : 1);
        this.scene.add(roadObject);
        this.cityObjects.push(roadObject);
        this.powerConnectors.push(roadObject);
    },

    createIntersectionNode: function(position) {
        const geo = new THREE.CylinderGeometry(this.gridSize * 0.5, this.gridSize * 0.5, 0.3, 16);
        const mat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position).y = 0.15;
        mesh.userData = { type: 'intersection', isPowered: false, powerRadius: this.gridSize * 0.6, consumption: 0.05 };
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.powerConnectors.push(mesh);
    },

    getRoadSegments: function(roadObject) {
        let segments = [];
        if (roadObject.userData.type === 'road') {
            segments.push({ p1: roadObject.userData.startPoint, p2: roadObject.userData.endPoint });
        } else if (roadObject.userData.type === 'road-curved') {
            const points = roadObject.userData.points;
            for (let i = 0; i < points.length - 1; i++) {
                segments.push({ p1: points[i], p2: points[i + 1] });
            }
        }
        return segments;
    },

    lineSegmentIntersection: function(p1, p2, p3, p4) {
        const den = (p1.x - p2.x) * (p3.z - p4.z) - (p1.z - p2.z) * (p3.x - p4.x);
        if (den === 0) return null;
        const t = ((p1.x - p3.x) * (p3.z - p4.z) - (p1.z - p3.z) * (p3.x - p4.x)) / den;
        const u = -((p1.x - p2.x) * (p1.z - p3.z) - (p1.z - p2.z) * (p1.x - p3.x)) / den;
        if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) { // Pequena margem para evitar tocar nas pontas
            const intersectionPoint = new THREE.Vector3();
            intersectionPoint.x = p1.x + t * (p2.x - p1.x);
            intersectionPoint.z = p1.z + t * (p2.z - p1.z);
            return intersectionPoint;
        }
        return null;
    },

    demolishObject: function() {
        const intersects = this.raycaster.intersectObjects(this.cityObjects, true);
        if (intersects.length > 0) {
            let objectToDemolish = intersects[0].object;
            while (objectToDemolish.parent && objectToDemolish.parent !== this.scene) {
                objectToDemolish = objectToDemolish.parent;
            }
            if (objectToDemolish.userData.type === 'intersection') {
                const intersectionPoint = objectToDemolish.position;
                const objectsToRemove = [objectToDemolish];
                this.cityObjects.filter(obj => obj.userData.type?.startsWith('road')).forEach(road => {
                    const start = road.userData.startPoint;
                    const end = road.userData.endPoint;
                    if (start?.distanceTo(intersectionPoint) < 0.1 || end?.distanceTo(intersectionPoint) < 0.1) {
                        objectsToRemove.push(road);
                    }
                });
                objectsToRemove.forEach(obj => this.removeObject(obj, false));
                this.recalculateAllRoadAdjacency();
                this.updatePowerGrid();
            } else {
                this.removeObject(objectToDemolish, true);
            }
        }
    },

    removeObject: function(object, doRecalculate = true) {
        const wasRoad = object.userData.type?.startsWith('road') || object.userData.type === 'intersection';
        this.cityObjects = this.cityObjects.filter(o => o.uuid !== object.uuid);
        this.powerProducers = this.powerProducers.filter(o => o.uuid !== object.uuid);
        this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== object.uuid);
        this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== object.uuid);
        
        this.scene.remove(object);
        object.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        
        if (wasRoad && doRecalculate) {
            this.recalculateAllRoadAdjacency();
            this.updatePowerGrid();
        }
    },

    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        const position = this.buildCursor.position.clone();
        if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
            const logicalCoords = this.worldToGridCoords(position);
            if (!logicalCoords || this.logicalGrid[logicalCoords.x][logicalCoords.z] !== 2) { return; }
        }
        let newObject, height = 0;
        let objectData = { isPowered: false, originalColor: 0xffffff };
        switch (this.buildMode) {
            case 'residential':
                height = this.gridSize; objectData.originalColor = 0x34A853;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor }));
                objectData.type = 'consumer'; objectData.consumption = 5; this.powerConsumers.push(newObject);
                break;
            case 'commercial':
                height = this.gridSize * 1.5; objectData.originalColor = 0x4285F4;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor }));
                objectData.type = 'consumer'; objectData.consumption = 10; this.powerConsumers.push(newObject);
                break;
            case 'power-wind':
                height = this.gridSize * 2.5;
                newObject = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                objectData.type = 'producer'; objectData.production = 20; objectData.powerRadius = 50; this.powerProducers.push(newObject);
                break;
            case 'power-coal':
                height = this.gridSize * 1.2;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*1.5), new THREE.MeshLambertMaterial({ color: 0x555555 }));
                objectData.type = 'producer'; objectData.production = 100; objectData.powerRadius = 80; this.powerProducers.push(newObject);
                break;
            default: return;
        }
        newObject.position.copy(position).y = height / 2;
        newObject.userData = objectData;
        this.scene.add(newObject);
        this.cityObjects.push(newObject);
        this.updatePowerGrid();
    },

    recalculateAllRoadAdjacency: function() {
        this.initializeLogicalGrid();
        this.cityObjects.forEach(obj => {
            if (obj.userData.type === 'road') this.updateLogicalGridForRoad(obj);
            else if (obj.userData.type === 'road-curved') this.updateLogicalGridForCurvedRoad(obj);
            else if (obj.userData.type === 'intersection') this.markGridCellsAroundPoint(obj.position);
        });
    },

    worldToGridCoords: function(worldPos) {
        const gridX = Math.floor(worldPos.x / this.gridSize) + (this.gridCells / 2);
        const gridZ = Math.floor(worldPos.z / this.gridSize) + (this.gridCells / 2);
        if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) {
            return { x: gridX, z: gridZ };
        }
        return null;
    },

    updateLogicalGridForRoad: function(roadMesh) {
        const start = roadMesh.userData.startPoint;
        const end = roadMesh.userData.endPoint;
        const distance = start.distanceTo(end);
        const segments = distance / (this.gridSize / 2);
        const path = new THREE.Vector3().subVectors(end, start);
        for (let i = 0; i <= segments; i++) {
            const point = start.clone().add(path.clone().multiplyScalar(i / segments));
            this.markGridCellsAroundPoint(point);
        }
    },
    
    updateLogicalGridForCurvedRoad: function(roadMesh) {
        const curve = new THREE.CatmullRomCurve3(roadMesh.userData.points);
        const points = curve.getPoints(Math.floor(curve.getLength() * 0.5));
        points.forEach(point => this.markGridCellsAroundPoint(point));
    },

    markGridCellsAroundPoint: function(point) {
        const coords = this.worldToGridCoords(point);
        if (coords) {
            this.logicalGrid[coords.x][coords.z] = 1;
            const neighbors = [{x:0,z:1}, {x:0,z:-1}, {x:1,z:0}, {x:-1,z:0}];
            neighbors.forEach(n => {
                const nx = coords.x + n.x;
                const nz = coords.z + n.z;
                if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells && this.logicalGrid[nx][nz] === 0) {
                    this.logicalGrid[nx][nz] = 2;
                }
            });
        }
    },

    createPowerLineObject: function(start, end, firstPole) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        const poleHeight = 12;
        const powerLineGroup = new THREE.Group();
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4);
        powerLineGroup.add(firstPole);
        const secondPole = firstPole.clone();
        secondPole.position.copy(end).y = poleHeight / 2;
        powerLineGroup.add(secondPole);
        const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat);
        crossarm1.position.copy(start).y = poleHeight - 1.5;
        crossarm1.rotation.y = Math.atan2(path.x, path.z) + Math.PI / 2;
        powerLineGroup.add(crossarm1);
        const crossarm2 = crossarm1.clone();
        crossarm2.position.copy(end).y = poleHeight - 1.5;
        powerLineGroup.add(crossarm2);
        const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length);
        const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.copy(start).add(path.clone().multiplyScalar(0.5));
        wire.position.y = poleHeight - 1.7;
        wire.lookAt(end);
        powerLineGroup.add(wire);
        powerLineGroup.userData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 2.5, consumption: 0.2 };
        this.scene.add(powerLineGroup);
        this.cityObjects.push(powerLineGroup);
        this.powerConnectors.push(powerLineGroup);
        this.updatePowerGrid();
    },

    updatePowerGrid: function() {
        const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors];
        this.powerOverlay.clear();
        allPowerObjects.forEach(obj => { obj.userData.isPowered = false; });
        this.powerAvailable = 0;
        this.powerNeeded = 0;
        const poweredQueue = [];
        this.powerProducers.forEach(producer => {
            this.powerAvailable += producer.userData.production;
            producer.userData.isPowered = true;
            poweredQueue.push(producer);
        });
        let head = 0;
        while (head < poweredQueue.length) {
            const currentPowered = poweredQueue[head++];
            const radius = currentPowered.userData.powerRadius || 0;
            if (!radius) continue;
            const sourcePositions = [];
            if (currentPowered.isGroup && currentPowered.userData.type === 'connector') {
                sourcePositions.push(currentPowered.children[0].position, currentPowered.children[1].position);
            } else {
                sourcePositions.push(currentPowered.position);
            }
            sourcePositions.forEach(sourcePos => {
                allPowerObjects.forEach(otherObj => {
                    if (!otherObj.userData.isPowered) {
                        let isConnected = false;
                        if (otherObj.isGroup && otherObj.userData.type === 'connector') {
                            const p1 = otherObj.children[0].position; const p2 = otherObj.children[1].position;
                            if (sourcePos.distanceTo(p1) < radius || sourcePos.distanceTo(p2) < radius) isConnected = true;
                        } else if(otherObj.userData.type?.startsWith('road') || otherObj.userData.type === 'intersection') {
                            if (sourcePos.distanceTo(otherObj.position) < radius) isConnected = true;
                        } else {
                            if (sourcePos.distanceTo(otherObj.position) < radius) isConnected = true;
                        }
                        if (isConnected) {
                            otherObj.userData.isPowered = true;
                            poweredQueue.push(otherObj);
                        }
                    }
                });
            });
        }
        poweredQueue.forEach(poweredObj => {
            if (poweredObj.userData.powerRadius) {
                const radius = poweredObj.userData.powerRadius;
                const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 });
                const overlayPositions = [];
                if (poweredObj.isGroup && poweredObj.userData.type === 'connector') {
                    overlayPositions.push(poweredObj.children[0].position, poweredObj.children[1].position);
                } else {
                    overlayPositions.push(poweredObj.position);
                }
                overlayPositions.forEach(pos => {
                    const circleGeo = new THREE.CircleGeometry(radius, 32);
                    const circleMesh = new THREE.Mesh(circleGeo, circleMat);
                    circleMesh.position.copy(pos).y = 0.1;
                    circleMesh.rotation.x = -Math.PI / 2;
                    this.powerOverlay.add(circleMesh);
                });
            }
        });
        this.powerConsumers.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        this.powerConnectors.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        const hasEnoughPower = this.powerAvailable >= this.powerNeeded;
        this.powerConsumers.forEach(c => {
            const shouldBePowered = c.userData.isPowered && hasEnoughPower;
            c.material.color.set(shouldBePowered ? c.userData.originalColor : 0x808080);
            this.toggleNoPowerIcon(c, !shouldBePowered);
        });
        this.updatePowerUI();
    },

    updatePowerUI: function() {
        UI.updatePowerInfo(this.powerAvailable, this.powerNeeded);
    },
    
    toggleNoPowerIcon: function(building, show) {
        let icon = building.getObjectByName("noPowerIcon");
        if (show && !icon) {
            if (!this.noPowerTexture) {
                this.noPowerTexture = new THREE.TextureLoader().load('assets/no_power_icon.png');
            }
            const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 });
            icon = new THREE.Sprite(material);
            icon.name = "noPowerIcon";
            icon.scale.set(8, 8, 8);
            icon.position.y = building.geometry.parameters.height + 5;
            building.add(icon);
        } else if (!show && icon) {
            building.remove(icon);
        }
    },
    
    togglePowerOverlay: function() {
        this.powerOverlay.visible = !this.powerOverlay.visible;
    },
    
    animate: function() {
        requestAnimationFrame(this.animate);
        const { x, z } = this.moveDirection;
        if (x !== 0 || z !== 0) {
            if (this.cameraMode === 'move') {
                this.cameraPivot.translateX(x * this.moveSpeed);
                this.cameraPivot.translateZ(z * this.moveSpeed);
            } else {
                this.cameraPivot.rotateY(-x * this.rotateSpeed);
                const newRotX = this.camera.rotation.x - z * this.rotateSpeed;
                if (newRotX > -1.2 && newRotX < 1.2) this.camera.rotation.x = newRotX;
            }
        }
        if(this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
};
