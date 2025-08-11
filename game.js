// Gerador de Ruído Perlin (inalterado)
const Noise = {
    p: new Uint8Array(512),
    init: function() { const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const n = Math.floor((i + 1) * Math.random()); [p[i], p[n]] = [p[n], p[i]]; } for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = p[i]; },
    lerp: (a, b, t) => a + t * (b - a),
    grad: function(hash, x, y) { const h = hash & 15; const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : 0; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); },
    perlin2: function(x, y) { const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const fade = t => t * t * t * (t * (t * 6 - 15) + 10); const u = fade(x); const v = fade(y); const p = this.p; const A = p[X] + Y, B = p[X + 1] + Y; return this.lerp(this.lerp(this.grad(p[A], x, y), this.grad(p[B], x - 1, y), u), this.lerp(this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1), u), v); }
};
Noise.init();

const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, terrainMesh: null, waterMesh: null,
    buildCursor: null, terraformCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    
    temporaryPole: null, 
    currentCurvePoints: [],
    curveGuideMeshes: [],

    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    powerAvailable: 0,
    powerNeeded: 0,

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
    
    // ATUALIZADO: Unificamos a criação de estradas em uma única função robusta
    createRoadObject: function(points) {
        // 1. Pega a altura do terreno para cada ponto do caminho
        const pointsWithTerrainHeight = points.map(p => {
            const point = p.clone();
            point.y = this.getTerrainHeight(p.x, p.z);
            return point;
        });

        // 2. Cria a curva base que segue o terreno
        const terrainCurve = new THREE.CatmullRomCurve3(pointsWithTerrainHeight);
        const curvePoints = terrainCurve.getPoints(Math.floor(terrainCurve.getLength() * 1.5));
        
        // 3. Cria uma curva suavizada que será o leito da estrada (a rampa suave)
        const smoothedPoints = [];
        const firstPointY = curvePoints[0].y;
        const lastPointY = curvePoints[curvePoints.length - 1].y;
        for(let i=0; i < curvePoints.length; i++){
            const point = curvePoints[i].clone();
            const ratio = i / (curvePoints.length - 1);
            point.y = firstPointY + (lastPointY - firstPointY) * ratio; // Interpolação linear da altura
            smoothedPoints.push(point);
        }
        const smoothedCurve = new THREE.CatmullRomCurve3(smoothedPoints);

        // 4. Cria a malha da estrada usando a curva SUAVIZADA
        const roadWidth = this.gridSize * 0.8;
        const geo = new THREE.TubeGeometry(smoothedCurve, curvePoints.length, roadWidth / 2, 8, false);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Armazena os pontos suavizados, que representam a estrada final
        mesh.userData = { 
            type: 'road-unified', 
            points: smoothedPoints 
        };
        
        // 5. Terraplana o terreno para se encontrar com a estrada
        this.terraformArea(mesh);

        // 6. Verifica cruzamentos com outras estradas
        this.checkForAndProcessIntersections(mesh);
    },

    // ATUALIZADO: Funções antigas agora chamam o novo sistema unificado
    createRoadSegment: function(start, end) {
        this.createRoadObject([start, end]);
    },

    finalizeCurvedRoad: function() {
        if (this.currentCurvePoints.length < 2) {
            this.cancelCurvedRoad();
            return;
        }
        this.createRoadObject(this.currentCurvePoints);
        this.cancelCurvedRoad();
    },

    // ATUALIZADO: A terraplanagem agora funciona com a malha da estrada
    terraformArea: function(pathObject, buildingPoints = null, areaSize = this.gridSize) {
        const terrainGeo = this.terrainMesh.geometry;
        const vertices = terrainGeo.attributes.position;
        const modifiedVertices = new Set();
        
        if (pathObject && pathObject.userData.type?.startsWith('road')) {
            // Para estradas, usa os pontos da própria malha da estrada como guia
            const pathPoints = pathObject.userData.points;
            pathPoints.forEach(pointOnCurve => {
                this.findAndModifyVertices(pointOnCurve, this.gridSize, pointOnCurve.y, vertices, modifiedVertices);
            });
        } else if (buildingPoints) {
            // Para edifícios, usa a altura média da área
            let averageHeight = buildingPoints.reduce((sum, p) => sum + this.getTerrainHeight(p.x, p.z), 0) / buildingPoints.length;
            this.findAndModifyVertices(buildingPoints[0], areaSize, averageHeight, vertices, modifiedVertices);
            vertices.needsUpdate = true;
            terrainGeo.computeVertexNormals();
            return averageHeight;
        }

        vertices.needsUpdate = true;
        terrainGeo.computeVertexNormals();
    },
    
    // ATUALIZADO: Lógica de demolição mais robusta
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
                    const roadPoints = road.userData.points; // Todas as estradas agora têm 'points'
                    if (roadPoints && roadPoints.some(p => p.distanceTo(intersectionPoint) < 0.1)) {
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
    
    // ATUALIZADO: Cruzamentos agora usam a nova lógica de estrada
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
            const roadsToReplace = new Set([newRoadObject, ...intersections.map(i => i.road2)]);
            roadsToReplace.forEach(road => this.removeObject(road, false));
            intersections.forEach(i => this.createIntersectionNode(i.point));

            roadsToReplace.forEach(road => {
                let roadPoints = road.userData.points;
                let intersectionPointsOnThisRoad = intersections.filter(i => i.road1 === road || i.road2 === road).map(i => i.point);
                const allPoints = [...roadPoints, ...intersectionPointsOnThisRoad].sort((a, b) => roadPoints[0].distanceTo(a) - roadPoints[0].distanceTo(b));

                for (let i = 0; i < allPoints.length - 1; i++) {
                    const p1 = allPoints[i];
                    const p2 = allPoints[i+1];
                    if (p1.distanceTo(p2) > 1) { 
                        this.createRoadObject([p1, p2]); // Recria os segmentos com a nova função
                    }
                }
            });
        } else {
            this.addRoadObjectToScene(newRoadObject);
        }
        this.recalculateAllRoadAdjacency();
        this.updatePowerGrid();
    },

    getRoadSegments: function(roadObject) {
        let segments = [];
        const points = roadObject.userData.points;
        if (points) {
            for (let i = 0; i < points.length - 1; i++) {
                segments.push({ p1: points[i], p2: points[i + 1] });
            }
        }
        return segments;
    },

    recalculateAllRoadAdjacency: function() {
        this.initializeLogicalGrid();
        this.cityObjects.forEach(obj => {
            if (obj.userData.type?.startsWith('road')) {
                const points = obj.userData.points;
                if(points) {
                    points.forEach(p => this.markGridCellsAroundPoint(p));
                }
            } else if (obj.userData.type === 'intersection') {
                this.markGridCellsAroundPoint(obj.position);
            }
        });
    },

    // --- FUNÇÕES INALTERADAS (mas completas) ---

    init: function() { if (this.isInitialized) return; this.gridCells = this.gridWorldSize / this.gridSize; this.initializeLogicalGrid(); this.setupScene(); this.setupControls(); this.animate = this.animate.bind(this); this.animate(); this.isInitialized = true; this.updatePowerUI(); },
    initializeLogicalGrid: function() { this.logicalGrid = []; for (let i = 0; i < this.gridCells; i++) { this.logicalGrid[i] = []; for (let j = 0; j < this.gridCells; j++) { this.logicalGrid[i][j] = 0; } } },
    setupScene: function() { this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x87CEEB); this.scene.fog = new THREE.Fog(0x87CEEB, 200, 400); this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setSize(window.innerWidth, window.innerHeight); document.getElementById('game-container').appendChild(this.renderer.domElement); this.cameraPivot = new THREE.Object3D(); this.scene.add(this.cameraPivot); this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); this.camera.position.set(0, 100, 120); this.camera.lookAt(this.cameraPivot.position); this.cameraPivot.add(this.camera); this.scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); dirLight.position.set(50, 100, 25); this.scene.add(dirLight); this.terrainMesh = this.createIslandTerrain(); this.terrainMesh.userData.isGround = true; this.scene.add(this.terrainMesh); this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.gridWorldSize * 2, this.gridWorldSize * 2), new THREE.MeshLambertMaterial({ color: 0x006994, transparent: true, opacity: 0.7, map: new THREE.TextureLoader().load('assets/water.png', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(20, 20); }) })); this.waterMesh.rotation.x = -Math.PI / 2; this.waterMesh.position.y = 1.0; this.scene.add(this.waterMesh); const cursorGeo = new THREE.BoxGeometry(this.gridSize, 0.5, this.gridSize); const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true }); this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat); this.buildCursor.visible = false; this.scene.add(this.buildCursor); const terraformGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize); const terraformMat = new THREE.MeshBasicMaterial({ color: 0xdaa520, transparent: true, opacity: 0.4, side: THREE.DoubleSide }); this.terraformCursor = new THREE.Mesh(terraformGeo, terraformMat); this.terraformCursor.rotation.x = -Math.PI / 2; this.terraformCursor.visible = false; this.scene.add(this.terraformCursor); this.powerOverlay = new THREE.Group(); this.powerOverlay.visible = false; this.scene.add(this.powerOverlay); },
    createIslandTerrain: function() { const segments = 128; const geometry = new THREE.PlaneGeometry(this.gridWorldSize, this.gridWorldSize, segments, segments); const vertices = geometry.attributes.position; const colors = []; const sandColor = new THREE.Color(0xC2B280); const grassColor = new THREE.Color(0x55902A); const rockColor = new THREE.Color(0x808080); const center = new THREE.Vector2(0, 0); const maxDist = this.gridWorldSize / 2; for (let i = 0; i < vertices.count; i++) { const x = vertices.getX(i); const z = vertices.getY(i); let noise = 0; let frequency = 2.5 / this.gridWorldSize; let amplitude = 20; for (let j = 0; j < 4; j++) { noise += Noise.perlin2(x * frequency, z * frequency) * amplitude; frequency *= 2; amplitude /= 2; } const dist = center.distanceTo(new THREE.Vector2(x, z)); const falloff = Math.pow(1.0 - (dist / maxDist), 2.0); let height = noise * falloff; height = Math.max(height, 0); vertices.setZ(i, height); if (height < 2.5) { colors.push(sandColor.r, sandColor.g, sandColor.b); } else if (height > 18) { colors.push(rockColor.r, rockColor.g, rockColor.b); } else { colors.push(grassColor.r, grassColor.g, grassColor.b); } } geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); const material = new THREE.MeshLambertMaterial({ vertexColors: true }); const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; return mesh; },
    updateCursor: function(x, y) { if (!this.buildCursor.visible) { this.terraformCursor.visible = false; return; } this.mouse.x = (x / window.innerWidth) * 2 - 1; this.mouse.y = -(y / window.innerHeight) * 2 + 1; this.raycaster.setFromCamera(this.mouse, this.camera); const intersects = this.raycaster.intersectObject(this.terrainMesh); if (intersects.length > 0) { const pos = intersects[0].point; const gridX = Math.round(pos.x / this.gridSize); const gridZ = Math.round(pos.z / this.gridSize); const terrainHeight = this.getTerrainHeight(gridX * this.gridSize, gridZ * this.gridSize); this.buildCursor.position.set(gridX * this.gridSize, terrainHeight + 0.25, gridZ * this.gridSize); const needsTerraforming = this.buildMode.startsWith('power') || this.buildMode === 'residential' || this.buildMode === 'commercial'; this.terraformCursor.visible = needsTerraforming; if (needsTerraforming) { this.terraformCursor.position.set(this.buildCursor.position.x, terrainHeight + 0.05, this.buildCursor.position.z); } if (this.buildMode === 'residential' || this.buildMode === 'commercial') { const logicalCoords = this.worldToGridCoords(this.buildCursor.position); if (logicalCoords && this.logicalGrid[logicalCoords.x][logicalCoords.z] === 2) { this.buildCursor.material.color.set(0x00ff00); } else { this.buildCursor.material.color.set(0xff0000); } } else if (this.buildMode === 'demolish') { this.buildCursor.material.color.set(0xff0000); } else { this.buildCursor.material.color.set(0xffffff); } } },
    setBuildMode: function(mode) { if(this.buildMode === 'road-curved' && this.currentCurvePoints.length > 0) { this.cancelCurvedRoad(); } this.buildMode = mode; this.buildCursor.visible = (mode !== 'select'); this.isDrawing = false; this.startPoint = null; if (this.temporaryPole) { this.scene.remove(this.temporaryPole); this.temporaryPole = null; } },
    setupControls: function() { const options = { zone: document.getElementById('joystick-zone'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 120 }; this.joystick = nipplejs.create(options); this.joystick.on('move', (evt, data) => { const angle = data.angle.radian; const force = data.force; this.moveDirection.x = Math.cos(angle) * force; this.moveDirection.z = -Math.sin(angle) * force; }).on('end', () => { this.moveDirection.x = 0; this.moveDirection.z = 0; }); document.getElementById('camera-mode-btn')?.addEventListener('click', (event) => { this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move'; event.target.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]'; }); document.getElementById('power-overlay-btn')?.addEventListener('click', () => this.togglePowerOverlay()); const canvas = this.renderer.domElement; canvas.addEventListener('mousemove', (e) => this.updateCursor(e.clientX, e.clientY)); canvas.addEventListener('click', () => this.handleMapClick()); window.addEventListener('keydown', (e) => { if (this.buildMode === 'road-curved') { if (e.key === 'Enter') this.finalizeCurvedRoad(); else if (e.key === 'Escape') this.cancelCurvedRoad(); } }); },
    handleMapClick: function() { if (this.buildMode === 'demolish') { this.demolishObject(); } else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) { this.handleLinePlacement(); } else { this.placeObject(); } },
    handleLinePlacement: function() { const currentPos = this.buildCursor.position.clone(); if (this.buildMode === 'road-curved') { this.currentCurvePoints.push(currentPos); const guideGeo = new THREE.SphereGeometry(1, 8, 8); const guideMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); const guideMesh = new THREE.Mesh(guideGeo, guideMat); guideMesh.position.copy(currentPos); this.scene.add(guideMesh); this.curveGuideMeshes.push(guideMesh); } else if (this.buildMode === 'road') { if (!this.isDrawing) { this.startPoint = currentPos; this.isDrawing = true; } else { this.createRoadSegment(this.startPoint, currentPos); this.isDrawing = false; this.startPoint = null; } } else if (this.buildMode === 'power-line') { if (!this.isDrawing) { this.startPoint = currentPos; const poleHeight = 12; const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8); const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); this.temporaryPole = new THREE.Mesh(poleGeo, poleMat); this.temporaryPole.position.copy(this.startPoint).y = this.getTerrainHeight(this.startPoint.x, this.startPoint.z) + poleHeight / 2; this.scene.add(this.temporaryPole); this.isDrawing = true; } else { const endPoint = currentPos; if (this.startPoint.distanceTo(endPoint) > 0) { this.scene.remove(this.temporaryPole); this.createPowerLineObject(this.startPoint, endPoint, this.temporaryPole); } else { this.scene.remove(this.temporaryPole); } this.isDrawing = false; this.startPoint = null; this.temporaryPole = null; } } },
    cancelCurvedRoad: function() { this.curveGuideMeshes.forEach(mesh => this.scene.remove(mesh)); this.curveGuideMeshes = []; this.currentCurvePoints = []; },
    addRoadObjectToScene: function(roadObject) { roadObject.userData.isPowered = false; roadObject.userData.powerRadius = this.gridSize * 0.6; roadObject.userData.consumption = 0.1 * roadObject.userData.points.length; this.scene.add(roadObject); this.cityObjects.push(roadObject); this.powerConnectors.push(roadObject); },
    createIntersectionNode: function(position) { const nodeHeight = this.getTerrainHeight(position.x, position.z); const geo = new THREE.CylinderGeometry(this.gridSize * 0.5, this.gridSize * 0.5, 0.3, 16); const mat = new THREE.MeshLambertMaterial({ color: 0x333333 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(position).y = nodeHeight + 0.15; mesh.userData = { type: 'intersection', isPowered: false, powerRadius: this.gridSize * 0.6, consumption: 0.05 }; this.scene.add(mesh); this.cityObjects.push(mesh); this.powerConnectors.push(mesh); },
    lineSegmentIntersection: function(p1, p2, p3, p4) { const den = (p1.x - p2.x) * (p3.z - p4.z) - (p1.z - p2.z) * (p3.x - p4.x); if (den === 0) return null; const t = ((p1.x - p3.x) * (p3.z - p4.z) - (p1.z - p3.z) * (p3.x - p4.x)) / den; const u = -((p1.x - p2.x) * (p1.z - p3.z) - (p1.z - p2.z) * (p1.x - p3.x)) / den; if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) { const intersectionPoint = new THREE.Vector3(p1.x + t * (p2.x - p1.x), 0, p1.z + t * (p2.z - p1.z)); return intersectionPoint; } return null; },
    removeObject: function(object, doRecalculate = true) { const wasRoad = object.userData.type?.startsWith('road') || object.userData.type === 'intersection'; this.cityObjects = this.cityObjects.filter(o => o.uuid !== object.uuid); this.powerProducers = this.powerProducers.filter(o => o.uuid !== object.uuid); this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== object.uuid); this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== object.uuid); this.scene.remove(object); object.traverse(child => { if (child.isMesh) { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); } }); if (wasRoad && doRecalculate) { this.recalculateAllRoadAdjacency(); this.updatePowerGrid(); } },
    worldToGridCoords: function(worldPos) { const gridX = Math.floor(worldPos.x / this.gridSize) + (this.gridCells / 2); const gridZ = Math.floor(worldPos.z / this.gridSize) + (this.gridCells / 2); if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) { return { x: gridX, z: gridZ }; } return null; },
    markGridCellsAroundPoint: function(point) { const coords = this.worldToGridCoords(point); if (coords) { this.logicalGrid[coords.x][coords.z] = 1; const neighbors = [{x:0,z:1}, {x:0,z:-1}, {x:1,z:0}, {x:-1,z:0}]; neighbors.forEach(n => { const nx = coords.x + n.x; const nz = coords.z + n.z; if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells && this.logicalGrid[nx][nz] === 0) { this.logicalGrid[nx][nz] = 2; } }); } },
    createPowerLineObject: function(start, end, firstPole) { const startHeight = this.getTerrainHeight(start.x, start.z); const endHeight = this.getTerrainHeight(end.x, end.z); const poleHeight = 12; firstPole.position.y = startHeight + poleHeight / 2; const path = new THREE.Vector3().subVectors(end, start); const length = path.length(); const powerLineGroup = new THREE.Group(); const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4); powerLineGroup.add(firstPole); const secondPole = firstPole.clone(); secondPole.position.copy(end).y = endHeight + poleHeight / 2; powerLineGroup.add(secondPole); const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat); crossarm1.position.copy(start).y = startHeight + poleHeight - 1.5; crossarm1.rotation.y = Math.atan2(path.x, path.z) + Math.PI / 2; powerLineGroup.add(crossarm1); const crossarm2 = crossarm1.clone(); crossarm2.position.copy(end).y = endHeight + poleHeight - 1.5; powerLineGroup.add(crossarm2); const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length); const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 }); const wire = new THREE.Mesh(wireGeo, wireMat); const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5); const midHeight = (startHeight + endHeight) / 2; wire.position.set(midPoint.x, midHeight + poleHeight - 1.7, midPoint.z); const endLookAt = new THREE.Vector3(end.x, endHeight + poleHeight - 1.7, end.z); wire.lookAt(endLookAt); powerLineGroup.add(wire); powerLineGroup.userData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 2.5, consumption: 0.2 }; this.scene.add(powerLineGroup); this.cityObjects.push(powerLineGroup); this.powerConnectors.push(powerLineGroup); this.updatePowerGrid(); },
    updatePowerUI: function() { UI.updatePowerInfo(this.powerAvailable, this.powerNeeded); },
    toggleNoPowerIcon: function(building, show) { let icon = building.getObjectByName("noPowerIcon"); if (show && !icon) { if (!this.noPowerTexture) { this.noPowerTexture = new THREE.TextureLoader().load('assets/no_power_icon.png'); } const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 }); icon = new THREE.Sprite(material); icon.name = "noPowerIcon"; icon.scale.set(8, 8, 8); icon.position.y = building.geometry.parameters.height + 5; building.add(icon); } else if (!show && icon) { building.remove(icon); } },
    togglePowerOverlay: function() { this.powerOverlay.visible = !this.powerOverlay.visible; },
    animate: function() { requestAnimationFrame(this.animate); const { x, z } = this.moveDirection; if (x !== 0 || z !== 0) { if (this.cameraMode === 'move') { this.cameraPivot.translateX(x * this.moveSpeed); this.cameraPivot.translateZ(z * this.moveSpeed); } else { this.cameraPivot.rotateY(-x * this.rotateSpeed); const newRotX = this.camera.rotation.x - z * this.rotateSpeed; if (newRotX > -1.2 && newRotX < 1.2) this.camera.rotation.x = newRotX; } } if(this.renderer && this.scene && this.camera) { this.renderer.render(this.scene, this.camera); } }
};
