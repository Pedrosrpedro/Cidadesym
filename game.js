// NOVO: Gerador de Ruído Perlin para criar terreno realista.
// Este objeto é autônomo e pode ser usado em qualquer lugar.
const Noise = {
    p: new Uint8Array(512),
    init: function() {
        const p = [];
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const n = Math.floor((i + 1) * Math.random());
            [p[i], p[n]] = [p[n], p[i]];
        }
        for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = p[i];
    },
    lerp: (a, b, t) => a + t * (b - a),
    grad: function(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    perlin2: function(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
        const u = fade(x);
        const v = fade(y);
        const p = this.p;
        const A = p[X] + Y, B = p[X + 1] + Y;
        return this.lerp(
            this.lerp(this.grad(p[A], x, y), this.grad(p[B], x - 1, y), u),
            this.lerp(this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1), u),
            v
        );
    }
};
Noise.init(); // Inicializa a tabela de permutação do ruído

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
    
    setupScene: function() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 400);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.cameraPivot = new THREE.Object3D(); this.scene.add(this.cameraPivot);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 100, 120); this.camera.lookAt(this.cameraPivot.position);
        this.cameraPivot.add(this.camera);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(50, 100, 25); this.scene.add(dirLight);

        this.terrainMesh = this.createIslandTerrain();
        this.terrainMesh.userData.isGround = true;
        this.scene.add(this.terrainMesh);

        this.waterMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.gridWorldSize * 2, this.gridWorldSize * 2),
            new THREE.MeshLambertMaterial({
                color: 0x006994,
                transparent: true,
                opacity: 0.7,
                map: new THREE.TextureLoader().load('assets/water.png', (texture) => {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(20, 20);
                })
            })
        );
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.y = 1.0;
        this.scene.add(this.waterMesh);
        
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 0.5, this.gridSize);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
        this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.buildCursor.visible = false; this.scene.add(this.buildCursor);
        
        const terraformGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
        const terraformMat = new THREE.MeshBasicMaterial({ color: 0xdaa520, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        this.terraformCursor = new THREE.Mesh(terraformGeo, terraformMat);
        this.terraformCursor.rotation.x = -Math.PI / 2;
        this.terraformCursor.visible = false;
        this.scene.add(this.terraformCursor);

        this.powerOverlay = new THREE.Group();
        this.powerOverlay.visible = false;
        this.scene.add(this.powerOverlay);
    },

    // ATUALIZADO: Geração de terreno usando Ruído Perlin
    createIslandTerrain: function() {
        const segments = 128; // Mais segmentos para melhor detalhe
        const geometry = new THREE.PlaneGeometry(this.gridWorldSize, this.gridWorldSize, segments, segments);
        const vertices = geometry.attributes.position;
        
        const colors = [];
        const sandColor = new THREE.Color(0xC2B280);
        const grassColor = new THREE.Color(0x55902A);
        const rockColor = new THREE.Color(0x808080);
        
        const center = new THREE.Vector2(0, 0);
        const maxDist = this.gridWorldSize / 2;
        
        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const z = vertices.getY(i);
            
            // Múltiplas camadas de ruído (oitavas) para realismo
            let noise = 0;
            let frequency = 2.5 / this.gridWorldSize;
            let amplitude = 20;
            for (let j = 0; j < 4; j++) {
                noise += Noise.perlin2(x * frequency, z * frequency) * amplitude;
                frequency *= 2;
                amplitude /= 2;
            }

            const dist = center.distanceTo(new THREE.Vector2(x, z));
            const falloff = Math.pow(1.0 - (dist / maxDist), 2.0);
            let height = noise * falloff;
            height = Math.max(height, 0);
            
            vertices.setZ(i, height);

            // Define a cor do vértice baseado na altura
            if (height < 2.5) {
                colors.push(sandColor.r, sandColor.g, sandColor.b);
            } else if (height > 18) {
                 colors.push(rockColor.r, rockColor.g, rockColor.b);
            } else {
                colors.push(grassColor.r, grassColor.g, grassColor.b);
            }
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    },
    
    updateCursor: function(x, y) {
        if (!this.buildCursor.visible) {
            this.terraformCursor.visible = false;
            return;
        }
        this.mouse.x = (x / window.innerWidth) * 2 - 1; this.mouse.y = -(y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.terrainMesh);
        
        if (intersects.length > 0) {
            const pos = intersects[0].point;
            const gridX = Math.round(pos.x / this.gridSize);
            const gridZ = Math.round(pos.z / this.gridSize);
            const terrainHeight = this.getTerrainHeight(gridX * this.gridSize, gridZ * this.gridSize);
            
            this.buildCursor.position.set(gridX * this.gridSize, terrainHeight + 0.25, gridZ * this.gridSize);
            
            const needsTerraforming = this.buildMode.startsWith('power') || this.buildMode === 'residential' || this.buildMode === 'commercial';
            this.terraformCursor.visible = needsTerraforming;
            if (needsTerraforming) {
                this.terraformCursor.position.set(this.buildCursor.position.x, terrainHeight + 0.05, this.buildCursor.position.z);
            }
            
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

    createRoadSegment: function(start, end) {
        const startPos = start.clone();
        startPos.y = this.getTerrainHeight(start.x, start.z);
        const endPos = end.clone();
        endPos.y = this.getTerrainHeight(end.x, end.z);
        const roadMesh = this.createRoadMesh(startPos, endPos);
        this.terraformArea(roadMesh, [startPos, endPos]);
        this.checkForAndProcessIntersections(roadMesh);
    },

    finalizeCurvedRoad: function() {
        if (this.currentCurvePoints.length < 2) {
            this.cancelCurvedRoad();
            return;
        }
        const pointsWithHeight = this.currentCurvePoints.map(p => {
            const point = p.clone();
            point.y = this.getTerrainHeight(p.x, p.z);
            return point;
        });
        const curve = new THREE.CatmullRomCurve3(pointsWithHeight);
        const roadWidth = this.gridSize * 0.8;
        const tubularSegments = Math.floor(curve.getLength() * 2);
        const geo = new THREE.TubeGeometry(curve, tubularSegments, roadWidth / 2, 8, false);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { type: 'road-curved', points: pointsWithHeight };
        this.terraformArea(mesh, pointsWithHeight);
        this.checkForAndProcessIntersections(mesh);
        this.cancelCurvedRoad();
    },

    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        const position = this.buildCursor.position.clone();
        if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
            const logicalCoords = this.worldToGridCoords(position);
            if (!logicalCoords || this.logicalGrid[logicalCoords.x][logicalCoords.z] !== 2) { return; }
        }
        
        const objectSize = (this.buildMode === 'power-coal') ? this.gridSize * 2 : this.gridSize;
        const newHeight = this.terraformArea(null, [position], objectSize);
        
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
        newObject.position.copy(position).y = newHeight + (height / 2);
        newObject.userData = objectData;
        this.scene.add(newObject);
        this.cityObjects.push(newObject);
        this.updatePowerGrid();
    },

    terraformArea: function(pathObject, pathPoints, areaSize = this.gridSize) {
        const terrainGeo = this.terrainMesh.geometry;
        const vertices = terrainGeo.attributes.position;
        let averageHeight = pathPoints.reduce((sum, p) => sum + this.getTerrainHeight(p.x, p.z), 0) / pathPoints.length;
        
        const modifiedVertices = new Set();
        if (pathObject && pathObject.userData.type?.startsWith('road')) {
             const curve = new THREE.CatmullRomCurve3(pathPoints);
             const pointsOnCurve = curve.getPoints(Math.floor(curve.getLength()));
             pointsOnCurve.forEach((point, i) => {
                 const newHeight = pathPoints[0].y + (pathPoints[pathPoints.length-1].y - pathPoints[0].y) * (i / pointsOnCurve.length);
                 this.findAndModifyVertices(point, this.gridSize, newHeight, vertices, modifiedVertices);
             });
        } else {
             this.findAndModifyVertices(pathPoints[0], areaSize, averageHeight, vertices, modifiedVertices);
        }
        vertices.needsUpdate = true;
        terrainGeo.computeVertexNormals();
        return averageHeight;
    },

    findAndModifyVertices: function(center, size, newHeight, vertices, modifiedSet) {
        const halfSize = size / 2;
        for (let i = 0; i < vertices.count; i++) {
            const vX = vertices.getX(i);
            const vZ = vertices.getY(i);
            if (vX >= center.x - halfSize && vX <= center.x + halfSize &&
                vZ >= center.z - halfSize && vZ <= center.z + halfSize) {
                vertices.setZ(i, newHeight);
                modifiedSet.add(i);
            }
        }
    },

    getTerrainHeight: function(x, z) {
        this.raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
        const intersects = this.raycaster.intersectObject(this.terrainMesh);
        return intersects.length > 0 ? intersects[0].point.y : 0;
    },

    // CORRIGIDO: Bug de demolição de cruzamentos
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
                    // Lógica robusta que funciona para estradas retas e curvas
                    const roadPoints = road.userData.points || [road.userData.startPoint, road.userData.endPoint];
                    if (roadPoints.some(p => p.distanceTo(intersectionPoint) < 0.1)) {
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
                        const objPos = otherObj.position;
                        const dist = sourcePos.distanceTo(objPos);
                        if(dist < radius) isConnected = true;
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
                const pos = poweredObj.position;
                const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
                const circleGeo = new THREE.CircleGeometry(radius, 32);
                const circleMesh = new THREE.Mesh(circleGeo, circleMat);
                circleMesh.position.copy(pos).y = terrainHeight + 0.15;
                circleMesh.rotation.x = -Math.PI / 2;
                this.powerOverlay.add(circleMesh);
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

    // Funções restantes (completas e inalteradas)
    initializeLogicalGrid: function() { this.logicalGrid = []; for (let i = 0; i < this.gridCells; i++) { this.logicalGrid[i] = []; for (let j = 0; j < this.gridCells; j++) { this.logicalGrid[i][j] = 0; } } },
    setBuildMode: function(mode) { if(this.buildMode === 'road-curved' && this.currentCurvePoints.length > 0) { this.cancelCurvedRoad(); } this.buildMode = mode; this.buildCursor.visible = (mode !== 'select'); this.isDrawing = false; this.startPoint = null; if (this.temporaryPole) { this.scene.remove(this.temporaryPole); this.temporaryPole = null; } },
    setupControls: function() { const options = { zone: document.getElementById('joystick-zone'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 120 }; this.joystick = nipplejs.create(options); this.joystick.on('move', (evt, data) => { const angle = data.angle.radian; const force = data.force; this.moveDirection.x = Math.cos(angle) * force; this.moveDirection.z = -Math.sin(angle) * force; }).on('end', () => { this.moveDirection.x = 0; this.moveDirection.z = 0; }); document.getElementById('camera-mode-btn')?.addEventListener('click', (event) => { this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move'; event.target.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]'; }); document.getElementById('power-overlay-btn')?.addEventListener('click', () => this.togglePowerOverlay()); const canvas = this.renderer.domElement; canvas.addEventListener('mousemove', (e) => this.updateCursor(e.clientX, e.clientY)); canvas.addEventListener('click', () => this.handleMapClick()); window.addEventListener('keydown', (e) => { if (this.buildMode === 'road-curved') { if (e.key === 'Enter') this.finalizeCurvedRoad(); else if (e.key === 'Escape') this.cancelCurvedRoad(); } }); },
    handleMapClick: function() { if (this.buildMode === 'demolish') { this.demolishObject(); } else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) { this.handleLinePlacement(); } else { this.placeObject(); } },
    handleLinePlacement: function() { const currentPos = this.buildCursor.position.clone(); if (this.buildMode === 'road-curved') { this.currentCurvePoints.push(currentPos); const guideGeo = new THREE.SphereGeometry(1, 8, 8); const guideMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); const guideMesh = new THREE.Mesh(guideGeo, guideMat); guideMesh.position.copy(currentPos); this.scene.add(guideMesh); this.curveGuideMeshes.push(guideMesh); } else if (this.buildMode === 'road') { if (!this.isDrawing) { this.startPoint = currentPos; this.isDrawing = true; } else { this.createRoadSegment(this.startPoint, currentPos); this.isDrawing = false; this.startPoint = null; } } else if (this.buildMode === 'power-line') { if (!this.isDrawing) { this.startPoint = currentPos; const poleHeight = 12; const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8); const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); this.temporaryPole = new THREE.Mesh(poleGeo, poleMat); this.temporaryPole.position.copy(this.startPoint).y = this.getTerrainHeight(this.startPoint.x, this.startPoint.z) + poleHeight / 2; this.scene.add(this.temporaryPole); this.isDrawing = true; } else { const endPoint = currentPos; if (this.startPoint.distanceTo(endPoint) > 0) { this.scene.remove(this.temporaryPole); this.createPowerLineObject(this.startPoint, endPoint, this.temporaryPole); } else { this.scene.remove(this.temporaryPole); } this.isDrawing = false; this.startPoint = null; this.temporaryPole = null; } } },
    cancelCurvedRoad: function() { this.curveGuideMeshes.forEach(mesh => this.scene.remove(mesh)); this.curveGuideMeshes = []; this.currentCurvePoints = []; },
    checkForAndProcessIntersections: function(newRoadObject) { let intersections = []; const newRoadSegments = this.getRoadSegments(newRoadObject); const roadsToCheck = this.cityObjects.filter(obj => obj.userData.type?.startsWith('road')); for (const existingRoad of roadsToCheck) { const existingRoadSegments = this.getRoadSegments(existingRoad); for (const newSeg of newRoadSegments) { for (const existingSeg of existingRoadSegments) { const intersectionPoint = this.lineSegmentIntersection(newSeg.p1, newSeg.p2, existingSeg.p1, existingSeg.p2); if (intersectionPoint) { intersections.push({ point: intersectionPoint, road1: newRoadObject, road2: existingRoad }); } } } } if (intersections.length > 0) { const roadsToReplace = new Set(); intersections.forEach(i => { roadsToReplace.add(i.road1); roadsToReplace.add(i.road2); }); roadsToReplace.forEach(road => this.removeObject(road, false)); intersections.forEach(i => this.createIntersectionNode(i.point)); roadsToReplace.forEach(road => { let roadPoints = (road.userData.type === 'road') ? [road.userData.startPoint, road.userData.endPoint] : road.userData.points; let intersectionPointsOnThisRoad = intersections.filter(i => i.road1 === road || i.road2 === road).map(i => i.point); const allPoints = [...roadPoints, ...intersectionPointsOnThisRoad].sort((a, b) => roadPoints[0].distanceTo(a) - roadPoints[0].distanceTo(b)); for (let i = 0; i < allPoints.length - 1; i++) { const p1 = allPoints[i]; const p2 = allPoints[i+1]; if (p1.distanceTo(p2) > 1) { this.addRoadObjectToScene(this.createRoadMesh(p1, p2)); } } }); } else { this.addRoadObjectToScene(newRoadObject); } this.recalculateAllRoadAdjacency(); this.updatePowerGrid(); },
    createRoadMesh: function(p1, p2) { const path = new THREE.Vector3().subVectors(p2, p1); const length = path.length(); const geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length); const mat = new THREE.MeshLambertMaterial({ color: 0x444444 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(p1).add(path.clone().multiplyScalar(0.5)); mesh.rotation.y = Math.atan2(path.x, path.z); mesh.userData = { type: 'road', startPoint: p1.clone(), endPoint: p2.clone() }; return mesh; },
    addRoadObjectToScene: function(roadObject) { roadObject.userData.isPowered = false; roadObject.userData.powerRadius = this.gridSize * 0.6; roadObject.userData.consumption = 0.1 * (roadObject.userData.points ? roadObject.userData.points.length : 1); this.scene.add(roadObject); this.cityObjects.push(roadObject); this.powerConnectors.push(roadObject); },
    createIntersectionNode: function(position) { const nodeHeight = this.getTerrainHeight(position.x, position.z); const geo = new THREE.CylinderGeometry(this.gridSize * 0.5, this.gridSize * 0.5, 0.3, 16); const mat = new THREE.MeshLambertMaterial({ color: 0x333333 }); const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(position).y = nodeHeight + 0.15; mesh.userData = { type: 'intersection', isPowered: false, powerRadius: this.gridSize * 0.6, consumption: 0.05 }; this.scene.add(mesh); this.cityObjects.push(mesh); this.powerConnectors.push(mesh); },
    getRoadSegments: function(roadObject) { let segments = []; if (roadObject.userData.type === 'road') { segments.push({ p1: roadObject.userData.startPoint, p2: roadObject.userData.endPoint }); } else if (roadObject.userData.type === 'road-curved') { const points = roadObject.userData.points; for (let i = 0; i < points.length - 1; i++) { segments.push({ p1: points[i], p2: points[i + 1] }); } } return segments; },
    lineSegmentIntersection: function(p1, p2, p3, p4) { const den = (p1.x - p2.x) * (p3.z - p4.z) - (p1.z - p2.z) * (p3.x - p4.x); if (den === 0) return null; const t = ((p1.x - p3.x) * (p3.z - p4.z) - (p1.z - p3.z) * (p3.x - p4.x)) / den; const u = -((p1.x - p2.x) * (p1.z - p3.z) - (p1.z - p2.z) * (p1.x - p3.x)) / den; if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) { const intersectionPoint = new THREE.Vector3(); intersectionPoint.x = p1.x + t * (p2.x - p1.x); intersectionPoint.z = p1.z + t * (p2.z - p1.z); return intersectionPoint; } return null; },
    removeObject: function(object, doRecalculate = true) { const wasRoad = object.userData.type?.startsWith('road') || object.userData.type === 'intersection'; this.cityObjects = this.cityObjects.filter(o => o.uuid !== object.uuid); this.powerProducers = this.powerProducers.filter(o => o.uuid !== object.uuid); this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== object.uuid); this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== object.uuid); this.scene.remove(object); object.traverse(child => { if (child.isMesh) { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); } }); if (wasRoad && doRecalculate) { this.recalculateAllRoadAdjacency(); this.updatePowerGrid(); } },
    recalculateAllRoadAdjacency: function() { this.initializeLogicalGrid(); this.cityObjects.forEach(obj => { if (obj.userData.type === 'road') this.updateLogicalGridForRoad(obj); else if (obj.userData.type === 'road-curved') this.updateLogicalGridForCurvedRoad(obj); else if (obj.userData.type === 'intersection') this.markGridCellsAroundPoint(obj.position); }); },
    worldToGridCoords: function(worldPos) { const gridX = Math.floor(worldPos.x / this.gridSize) + (this.gridCells / 2); const gridZ = Math.floor(worldPos.z / this.gridSize) + (this.gridCells / 2); if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) { return { x: gridX, z: gridZ }; } return null; },
    updateLogicalGridForRoad: function(roadMesh) { const start = roadMesh.userData.startPoint; const end = roadMesh.userData.endPoint; const distance = start.distanceTo(end); const segments = distance / (this.gridSize / 2); const path = new THREE.Vector3().subVectors(end, start); for (let i = 0; i <= segments; i++) { const point = start.clone().add(path.clone().multiplyScalar(i / segments)); this.markGridCellsAroundPoint(point); } },
    updateLogicalGridForCurvedRoad: function(roadMesh) { const curve = new THREE.CatmullRomCurve3(roadMesh.userData.points); const points = curve.getPoints(Math.floor(curve.getLength() * 0.5)); points.forEach(point => this.markGridCellsAroundPoint(point)); },
    markGridCellsAroundPoint: function(point) { const coords = this.worldToGridCoords(point); if (coords) { this.logicalGrid[coords.x][coords.z] = 1; const neighbors = [{x:0,z:1}, {x:0,z:-1}, {x:1,z:0}, {x:-1,z:0}]; neighbors.forEach(n => { const nx = coords.x + n.x; const nz = coords.z + n.z; if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells && this.logicalGrid[nx][nz] === 0) { this.logicalGrid[nx][nz] = 2; } }); } },
    createPowerLineObject: function(start, end, firstPole) { const startHeight = this.getTerrainHeight(start.x, start.z); const endHeight = this.getTerrainHeight(end.x, end.z); const poleHeight = 12; firstPole.position.y = startHeight + poleHeight / 2; const path = new THREE.Vector3().subVectors(end, start); const length = path.length(); const powerLineGroup = new THREE.Group(); const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4); powerLineGroup.add(firstPole); const secondPole = firstPole.clone(); secondPole.position.copy(end).y = endHeight + poleHeight / 2; powerLineGroup.add(secondPole); const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat); crossarm1.position.copy(start).y = startHeight + poleHeight - 1.5; crossarm1.rotation.y = Math.atan2(path.x, path.z) + Math.PI / 2; powerLineGroup.add(crossarm1); const crossarm2 = crossarm1.clone(); crossarm2.position.copy(end).y = endHeight + poleHeight - 1.5; powerLineGroup.add(crossarm2); const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length); const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 }); const wire = new THREE.Mesh(wireGeo, wireMat); const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5); const midHeight = (startHeight + endHeight) / 2; wire.position.set(midPoint.x, midHeight + poleHeight - 1.7, midPoint.z); const endLookAt = new THREE.Vector3(end.x, endHeight + poleHeight - 1.7, end.z); wire.lookAt(endLookAt); powerLineGroup.add(wire); powerLineGroup.userData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 2.5, consumption: 0.2 }; this.scene.add(powerLineGroup); this.cityObjects.push(powerLineGroup); this.powerConnectors.push(powerLineGroup); this.updatePowerGrid(); },
    updatePowerUI: function() { UI.updatePowerInfo(this.powerAvailable, this.powerNeeded); },
    toggleNoPowerIcon: function(building, show) { let icon = building.getObjectByName("noPowerIcon"); if (show && !icon) { if (!this.noPowerTexture) { this.noPowerTexture = new THREE.TextureLoader().load('assets/no_power_icon.png'); } const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 }); icon = new THREE.Sprite(material); icon.name = "noPowerIcon"; icon.scale.set(8, 8, 8); icon.position.y = building.geometry.parameters.height + 5; building.add(icon); } else if (!show && icon) { building.remove(icon); } },
    togglePowerOverlay: function() { this.powerOverlay.visible = !this.powerOverlay.visible; },
    animate: function() { requestAnimationFrame(this.animate); const { x, z } = this.moveDirection; if (x !== 0 || z !== 0) { if (this.cameraMode === 'move') { this.cameraPivot.translateX(x * this.moveSpeed); this.cameraPivot.translateZ(z * this.moveSpeed); } else { this.cameraPivot.rotateY(-x * this.rotateSpeed); const newRotX = this.camera.rotation.x - z * this.rotateSpeed; if (newRotX > -1.2 && newRotX < 1.2) this.camera.rotation.x = newRotX; } } if(this.renderer && this.scene && this.camera) { this.renderer.render(this.scene, this.camera); } }
};
