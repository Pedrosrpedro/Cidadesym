// Gerador de Ruído Perlin (sem alterações)
const Noise = { p: new Uint8Array(512), init: function() { const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const n = Math.floor((i + 1) * Math.random());[p[i], p[n]] = [p[n], p[i]]; } for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = p[i]; }, lerp: (a, b, t) => a + t * (b - a), grad: function(hash, x, y) { const h = hash & 15; const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : 0; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); }, perlin2: function(x, y) { const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const fade = t => t * t * t * (t * (t * 6 - 15) + 10); const u = fade(x); const v = fade(y); const p = this.p; const A = p[X] + Y, B = p[X + 1] + Y; return this.lerp(this.lerp(this.grad(p[A], x, y), this.grad(p[B], x - 1, y), u), this.lerp(this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1), u), v); } };
Noise.init();

const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, terrainMesh: null, waterMesh: null,
    buildCursor: null, terraformCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.6, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    
    temporaryPole: null, 
    currentCurvePoints: [],
    curveGuideMeshes: [],

    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    // NOVO: SISTEMA DE ÁGUA E ESGOTO
    waterProducers: [],
    waterConnectors: [], // Canos
    sewageProcessors: [],
    waterOverlay: null,

    powerAvailable: 0,
    powerNeeded: 0,

    logicalGrid: [],
    gridWorldSize: 500,
    gridCells: 50,
    
    population: 0,
    vehicles: [],
    lastSpawnTime: 0,
    lastTime: 0,

    init: function() {
        if (this.isInitialized) return;
        this.gridCells = this.gridWorldSize / this.gridSize;
        this.initializeLogicalGrid();
        this.setupScene();
        this.createInitialHighway();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate(0);
        this.isInitialized = true;
        this.updatePopulationUI();
        this.updatePowerUI();
    },
    
    initializeLogicalGrid: function() { this.logicalGrid = Array(this.gridCells).fill(0).map(() => Array(this.gridCells).fill(0)); },

    setupScene: function() {
        this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x87CEEB); this.scene.fog = new THREE.Fog(0x87CEEB, 250, 550);
        this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setSize(window.innerWidth, window.innerHeight); document.getElementById('game-container').appendChild(this.renderer.domElement);
        this.cameraPivot = new THREE.Object3D(); this.scene.add(this.cameraPivot);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); this.camera.position.set(0, 150, 200); this.camera.lookAt(this.cameraPivot.position); this.cameraPivot.add(this.camera);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.7); dirLight.position.set(50, 100, 25); this.scene.add(dirLight);
        this.terrainMesh = this.createPennisulaTerrain(); this.terrainMesh.userData.isGround = true; this.scene.add(this.terrainMesh);
        this.waterMesh = new THREE.Mesh( new THREE.PlaneGeometry(this.gridWorldSize * 2, this.gridWorldSize * 2), new THREE.MeshLambertMaterial({ color: 0x006994, transparent: true, opacity: 0.7 }) ); this.waterMesh.rotation.x = -Math.PI / 2; this.waterMesh.position.y = 5.5; this.scene.add(this.waterMesh);
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 0.5, this.gridSize); const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true }); this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat); this.buildCursor.visible = false; this.scene.add(this.buildCursor);
        const terraformGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize); const terraformMat = new THREE.MeshBasicMaterial({ color: 0xdaa520, transparent: true, opacity: 0.4, side: THREE.DoubleSide }); this.terraformCursor = new THREE.Mesh(terraformGeo, terraformMat); this.terraformCursor.rotation.x = -Math.PI / 2; this.terraformCursor.visible = false; this.scene.add(this.terraformCursor);
        this.powerOverlay = new THREE.Group(); this.powerOverlay.visible = false; this.scene.add(this.powerOverlay);
        this.waterOverlay = new THREE.Group(); this.waterOverlay.visible = false; this.scene.add(this.waterOverlay); // NOVO
    },

    // ... createPennisulaTerrain e createInitialHighway sem alterações ...
    createPennisulaTerrain: function() { const segments = 128; const geometry = new THREE.PlaneGeometry(this.gridWorldSize, this.gridWorldSize, segments, segments); const vertices = geometry.attributes.position; const colors = []; const sandColor = new THREE.Color(0xC2B280), grassColor = new THREE.Color(0x55902A), rockColor = new THREE.Color(0x808080), snowColor = new THREE.Color(0xFFFAFA); const center = new THREE.Vector2(0, 0); const maxDist = this.gridWorldSize / 2; const baseHeight = 18.0; const maxAmplitude = 45.0; for (let i = 0; i < vertices.count; i++) { const x = vertices.getX(i); const z = vertices.getY(i); let noise = 0; let frequency = 1.8 / this.gridWorldSize; let amplitude = maxAmplitude; for (let j = 0; j < 4; j++) { noise += Noise.perlin2(x * frequency, z * frequency) * amplitude; frequency *= 2.1; amplitude /= 2.2; } const dist = center.distanceTo(new THREE.Vector2(x, z)); let islandFalloff = Math.pow(1.0 - THREE.MathUtils.smoothstep(dist, maxDist * 0.7, maxDist), 1.2); let continentFalloff = Math.pow(THREE.MathUtils.smoothstep(z, maxDist * 0.5, maxDist), 2); let finalFalloff = THREE.MathUtils.lerp(islandFalloff, 1.0, continentFalloff); const flatAreaFactor = 1.0 - Math.pow(THREE.MathUtils.smoothstep(dist, 70, 150), 2); noise *= flatAreaFactor; let height = (baseHeight + noise) * finalFalloff; if (height < 6) height = 6; vertices.setZ(i, height); if (height < 10) colors.push(sandColor.r, sandColor.g, sandColor.b); else if (height < 30) colors.push(grassColor.r, grassColor.g, grassColor.b); else if (height < 45) colors.push(rockColor.r, rockColor.g, rockColor.b); else colors.push(snowColor.r, snowColor.g, snowColor.b); } geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); const material = new THREE.MeshLambertMaterial({ vertexColors: true }); const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; return mesh; },
    createInitialHighway: function() { const halfSize = this.gridWorldSize / 2; const startZ = halfSize - 1; const endZ = 0; const startY_in = this.getTerrainHeight(15, startZ) + 0.2; const endY_in = this.getTerrainHeight(15, endZ) + 0.2; this.createRoadObject([new THREE.Vector3(15, startY_in, startZ), new THREE.Vector3(15, endY_in, endZ)]); const startY_out = this.getTerrainHeight(-15, startZ) + 0.2; const endY_out = this.getTerrainHeight(-15, endZ) + 0.2; this.createRoadObject([new THREE.Vector3(-15, endY_out, endZ), new THREE.Vector3(-15, startY_out, startZ)]); },
    
    // FUNÇÃO CORRIGIDA
    setupControls: function() {
        const options = { zone: document.getElementById('joystick-zone'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 120 };
        this.joystick = nipplejs.create(options);
        this.joystick.on('move', (evt, data) => { const angle = data.angle.radian; const force = data.force; this.moveDirection.x = Math.cos(angle) * force; this.moveDirection.z = -Math.sin(angle) * force; }).on('end', () => { this.moveDirection.x = 0; this.moveDirection.z = 0; });
        document.getElementById('camera-mode-btn')?.addEventListener('click', () => { this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move'; event.target.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]'; });
        document.getElementById('power-overlay-btn')?.addEventListener('click', this.togglePowerOverlay.bind(this));
        document.getElementById('water-overlay-btn')?.addEventListener('click', this.toggleWaterOverlay.bind(this)); // NOVO
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousemove', this.updateCursor.bind(this));
        canvas.addEventListener('click', this.handleMapClick.bind(this));
        window.addEventListener('keydown', (e) => { if (this.buildMode === 'road-curved') { if (e.key === 'Enter') this.finalizeCurvedRoad(); else if (e.key === 'Escape') this.cancelCurvedRoad(); } });
    },
    
    // ... updateCursor e handleMapClick sem alterações ...
    updateCursor: function(e) { if (!this.buildCursor.visible) { this.terraformCursor.visible = false; return; } const rect = this.renderer.domElement.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; this.mouse.x = (x / rect.width) * 2 - 1; this.mouse.y = -(y / rect.height) * 2 + 1; this.raycaster.setFromCamera(this.mouse, this.camera); const intersects = this.raycaster.intersectObject(this.terrainMesh); if (intersects.length > 0) { const pos = intersects[0].point; const gridX = Math.round(pos.x / this.gridSize); const gridZ = Math.round(pos.z / this.gridSize); const snappedX = gridX * this.gridSize; const snappedZ = gridZ * this.gridSize; const terrainHeight = intersects[0].point.y; this.buildCursor.position.set(snappedX, terrainHeight + 0.25, snappedZ); const needsTerraformingCursor = this.buildMode.startsWith('power') || this.buildMode.startsWith('water') || this.buildMode === 'residential' || this.buildMode === 'commercial' || this.buildMode.startsWith('terraform'); this.terraformCursor.visible = needsTerraformingCursor; if (needsTerraformingCursor) { this.terraformCursor.position.set(snappedX, terrainHeight + 0.05, snappedZ); if(this.buildMode === 'terraform-raise') this.terraformCursor.material.color.set(0x00ff00); else if(this.buildMode === 'terraform-lower') this.terraformCursor.material.color.set(0xff0000); else this.terraformCursor.material.color.set(0xdaa520); } const logicalCoords = this.worldToGridCoords(this.buildCursor.position); if (this.buildMode === 'residential' || this.buildMode === 'commercial') { if (logicalCoords && this.logicalGrid[logicalCoords.x] && this.logicalGrid[logicalCoords.x][logicalCoords.z] === 2) this.buildCursor.material.color.set(0x00ff00); else this.buildCursor.material.color.set(0xff0000); } else if (this.buildMode === 'demolish') { this.buildCursor.material.color.set(0xff0000); } else { this.buildCursor.material.color.set(0xffffff); } } },
    handleMapClick: function() { if (!this.buildCursor.visible || this.buildMode === 'select') return; if (this.buildMode === 'demolish') { this.demolishObject(); } else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line') || this.buildMode === 'pipe') { this.handleLinePlacement(); } else if (this.buildMode.startsWith('terraform')) { this.modifyTerrainOnClick(); } else { this.placeObject(); } },
    
    // FUNÇÃO QUE DAVA ERRO, AGORA CORRIGIDA PELO BIND
    modifyTerrainOnClick: function() { if (!this.buildCursor.visible) return; const center = this.buildCursor.position; const brushSize = this.gridSize * 1.5; const brushStrength = 0.5; const terrainGeo = this.terrainMesh.geometry; const vertices = terrainGeo.attributes.position; for (let i = 0; i < vertices.count; i++) { const vPos = new THREE.Vector3(vertices.getX(i), 0, vertices.getY(i)); const dist = vPos.distanceTo(new THREE.Vector3(center.x, 0, center.z)); if (dist < brushSize) { const falloff = Math.cos((dist / brushSize) * (Math.PI / 2)); const amount = brushStrength * falloff; let currentHeight = vertices.getZ(i); if (this.buildMode === 'terraform-raise') { vertices.setZ(i, currentHeight + amount); } else if (this.buildMode === 'terraform-lower') { vertices.setZ(i, currentHeight - amount); } } } vertices.needsUpdate = true; terrainGeo.computeVertexNormals(); this.updateTerrainColors(); },
    updateTerrainColors: function() { const terrainGeo = this.terrainMesh.geometry; const vertices = terrainGeo.attributes.position; const colors = []; const sandColor = new THREE.Color(0xC2B280), grassColor = new THREE.Color(0x55902A), rockColor = new THREE.Color(0x808080), snowColor = new THREE.Color(0xFFFAFA); for(let i = 0; i < vertices.count; i++) { const height = vertices.getZ(i); if (height < 10) colors.push(sandColor.r, sandColor.g, sandColor.b); else if (height < 30) colors.push(grassColor.r, grassColor.g, grassColor.b); else if (height < 45) colors.push(rockColor.r, rockColor.g, rockColor.b); else colors.push(snowColor.r, snowColor.g, snowColor.b); } terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeo.attributes.color.needsUpdate = true; },
    
    // MODIFICADO PARA INCLUIR CANOS
    handleLinePlacement: function() {
        const currentPos = this.buildCursor.position.clone();
        if (this.buildMode === 'pipe') {
             if (!this.isDrawing) { this.startPoint = currentPos; this.isDrawing = true; } 
             else { this.createPipeObject(this.startPoint, currentPos); this.isDrawing = false; this.startPoint = null; }
        } else if (this.buildMode === 'road') {
            if (!this.isDrawing) { this.startPoint = currentPos; this.isDrawing = true; } 
            else { this.createRoadSegment(this.startPoint, currentPos); this.isDrawing = false; this.startPoint = null; }
        } else if (this.buildMode === 'road-curved') {
            this.currentCurvePoints.push(currentPos);
            // ... (lógica do guia visual da curva)
        } else if (this.buildMode === 'power-line') {
            // ... (lógica dos postes)
        }
    },
    
    // ... createRoadObject, etc, sem alteração ...
    cancelCurvedRoad: function() { this.curveGuideMeshes.forEach(mesh => this.scene.remove(mesh)); this.curveGuideMeshes = []; this.currentCurvePoints = []; },
    createRoadObject: function(points) { if (!points || points.length < 2) return; const curve = new THREE.CatmullRomCurve3(points); const roadWidth = this.gridSize * 0.8; const roadGeo = new THREE.TubeGeometry(curve, Math.max(20, Math.floor(curve.getLength())), roadWidth / 2, 4, false); const roadMat = new THREE.MeshLambertMaterial({ color: 0x444444, side: THREE.DoubleSide }); const mesh = new THREE.Mesh(roadGeo, roadMat); mesh.scale.y = 0.05; const curvePoints = curve.getPoints(Math.max(50, Math.floor(curve.getLength() * 1.5))); mesh.userData = { type: 'road', points: curvePoints, curve: curve }; this.terraformArea(mesh); this.addRoadObjectToScene(mesh); this.recalculateAllRoadAdjacency(); },
    createRoadSegment: function(start, end) { const startY = this.getTerrainHeight(start.x, start.z) + 0.2; const endY = this.getTerrainHeight(end.x, end.z) + 0.2; this.createRoadObject([new THREE.Vector3(start.x, startY, start.z), new THREE.Vector3(end.x, endY, end.z)]); },
    finalizeCurvedRoad: function() { if (this.currentCurvePoints.length < 2) { this.cancelCurvedRoad(); return; } const pointsWithHeight = this.currentCurvePoints.map(p => new THREE.Vector3(p.x, this.getTerrainHeight(p.x, p.z) + 0.2, p.z)); this.createRoadObject(pointsWithHeight); this.cancelCurvedRoad(); },
    
    // NOVO: CRIAÇÃO DE CANOS
    createPipeObject: function(start, end) {
        const startY = this.getTerrainHeight(start.x, start.z) - 1.0; // Canos são subterrâneos
        const endY = this.getTerrainHeight(end.x, end.z) - 1.0;
        const curve = new THREE.LineCurve3(new THREE.Vector3(start.x, startY, start.z), new THREE.Vector3(end.x, endY, end.z));
        const pipeGeo = new THREE.TubeGeometry(curve, 1, 0.8, 8, false);
        const pipeMat = new THREE.MeshLambertMaterial({ color: 0x3d85c6 });
        const mesh = new THREE.Mesh(pipeGeo, pipeMat);
        mesh.userData = { type: 'pipe', connectionRadius: this.gridSize * 1.5 };
        
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.waterConnectors.push(mesh);
        this.updateWaterGrid(); // Atualiza a rede de água
    },

    // ATUALIZADO PARA INCLUIR EDIFÍCIOS DE ÁGUA
    placeObject: function() {
        const position = this.buildCursor.position.clone();
        const logicalCoords = this.worldToGridCoords(position);
        if (this.buildMode === 'residential' || this.buildMode === 'commercial') { if (!logicalCoords || !this.logicalGrid[logicalCoords.x]?.[logicalCoords.z] === 2) return; }
        
        const objectSize = (this.buildMode === 'power-coal') ? this.gridSize * 2 : this.gridSize;
        const newHeight = this.terraformArea(null, [position], objectSize);
        let newObject, height = 0;
        let objectData = { isPowered: false, hasWater: false, hasSewage: false, originalColor: new THREE.Color(0xffffff) };

        switch (this.buildMode) {
            case 'residential': height = this.gridSize; objectData.originalColor.set(0x34A853); newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor })); objectData.type = 'consumer'; objectData.consumption = 5; objectData.isOccupied = false; this.powerConsumers.push(newObject); break;
            case 'commercial': height = this.gridSize * 1.5; objectData.originalColor.set(0x4285F4); newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor })); objectData.type = 'consumer'; objectData.consumption = 10; this.powerConsumers.push(newObject); break;
            case 'power-wind': height = this.gridSize * 2.5; newObject = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee })); objectData.type = 'producer'; objectData.production = 20; objectData.powerRadius = 50; this.powerProducers.push(newObject); break;
            case 'power-coal': height = this.gridSize * 1.2; newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*1.5), new THREE.MeshLambertMaterial({ color: 0x555555 })); objectData.type = 'producer'; objectData.production = 100; objectData.powerRadius = 80; this.powerProducers.push(newObject); break;
            // NOVOS EDIFÍCIOS
            case 'water-pump': height = this.gridSize * 0.8; newObject = new THREE.Mesh(new THREE.CylinderGeometry(this.gridSize/2, this.gridSize/2, height, 16), new THREE.MeshLambertMaterial({ color: 0x6fa8dc })); objectData.type = 'water-producer'; objectData.connectionRadius = this.gridSize * 1.5; this.waterProducers.push(newObject); break;
            case 'sewage-plant': height = this.gridSize; newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*2), new THREE.MeshLambertMaterial({ color: 0x83532c })); objectData.type = 'sewage-processor'; objectData.connectionRadius = this.gridSize * 1.5; this.sewageProcessors.push(newObject); break;
            default: return;
        }
        newObject.position.copy(position).y = newHeight + (height / 2); newObject.userData = objectData; this.scene.add(newObject); this.cityObjects.push(newObject);
        this.updatePowerGrid();
        this.updateWaterGrid();
    },
    
    // ATUALIZADO PARA REMOVER OBJETOS DE ÁGUA
    removeObject: function(object, doRecalculate = true) {
        // ... (lógica de remoção de população e estrada) ...
        this.waterProducers = this.waterProducers.filter(o => o.uuid !== object.uuid);
        this.waterConnectors = this.waterConnectors.filter(o => o.uuid !== object.uuid);
        this.sewageProcessors = this.sewageProcessors.filter(o => o.uuid !== object.uuid);
        // ... (resto da função de remoção) ...
        this.updatePowerGrid();
        this.updateWaterGrid();
    },
    
    // ... Funções de terraplanagem, adjacencia, etc. (sem grandes alterações) ...
    terraformArea: function(pathObject, buildingPoints = null, areaSize = this.gridSize) { const terrainGeo = this.terrainMesh.geometry; const vertices = terrainGeo.attributes.position; let needsUpdate = false; if (pathObject && pathObject.userData.type?.startsWith('road')) { const pathPoints = pathObject.userData.points; if (!pathPoints || pathPoints.length < 2) return; const modifiedVertices = new Set(); for (const pointOnCurve of pathPoints) { this.findAndModifyVertices(pointOnCurve, areaSize, pointOnCurve.y - 0.2, vertices, modifiedVertices); } needsUpdate = true; } else if (buildingPoints) { const centerPoint = buildingPoints[0]; let totalHeight = 0, count = 0; const halfSize = areaSize / 2; for (let i = 0; i < vertices.count; i++) { const vX = vertices.getX(i), vZ = vertices.getY(i); if (vX >= centerPoint.x - halfSize && vX <= centerPoint.x + halfSize && vZ >= centerPoint.z - halfSize && vZ <= centerPoint.z + halfSize) { totalHeight += vertices.getZ(i); count++; } } const averageHeight = count > 0 ? totalHeight / count : this.getTerrainHeight(centerPoint.x, centerPoint.z); this.findAndModifyVertices(centerPoint, areaSize, averageHeight, vertices, new Set()); needsUpdate = true; if(needsUpdate) { vertices.needsUpdate = true; terrainGeo.computeVertexNormals(); this.updateTerrainColors(); } return averageHeight; } if(needsUpdate) { vertices.needsUpdate = true; terrainGeo.computeVertexNormals(); this.updateTerrainColors(); } },
    findAndModifyVertices: function(center, size, newHeight, vertices, modifiedSet) { const halfSize = size / 2; for (let i = 0; i < vertices.count; i++) { if (modifiedSet.has(i)) continue; const vX = vertices.getX(i); const vZ = vertices.getY(i); const dist = Math.sqrt(Math.pow(vX - center.x, 2) + Math.pow(vZ - center.z, 2)); if (dist < halfSize) { const currentHeight = vertices.getZ(i); const falloff = 1.0 - THREE.MathUtils.smoothstep(dist, 0, halfSize); const finalHeight = THREE.MathUtils.lerp(currentHeight, newHeight, falloff); vertices.setZ(i, finalHeight); modifiedSet.add(i); } } },
    getTerrainHeight: function(x, z) { this.raycaster.ray.origin.set(x, 200, z); this.raycaster.ray.direction.set(0, -1, 0); const intersects = this.raycaster.intersectObject(this.terrainMesh); return intersects.length > 0 ? intersects[0].point.y : 0; },
    addRoadObjectToScene: function(roadObject) { roadObject.userData.isPowered = false; roadObject.userData.powerRadius = this.gridSize * 0.6; roadObject.userData.consumption = 0.1 * (roadObject.userData.points?.length || 1); this.scene.add(roadObject); this.cityObjects.push(roadObject); this.powerConnectors.push(roadObject); },
    recalculateAllRoadAdjacency: function() { this.initializeLogicalGrid(); this.cityObjects.forEach(obj => { if (obj.userData.type?.startsWith('road')) { const points = obj.userData.points; if(points) { points.forEach(p => this.markGridCellsAroundPoint(p)); } } }); },
    worldToGridCoords: function(worldPos) { if (!worldPos) return null; const gridX = Math.floor((worldPos.x + this.gridWorldSize / 2) / this.gridSize); const gridZ = Math.floor((worldPos.z + this.gridWorldSize / 2) / this.gridSize); if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) { return { x: gridX, z: gridZ }; } return null; },
    markGridCellsAroundPoint: function(point) { const coords = this.worldToGridCoords(point); if (coords) { for(let i=-1; i<=1; i++){ for(let j=-1; j<=1; j++){ const nx = coords.x + i, nz = coords.z + j; if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells) { const isRoadCell = (i===0 && j===0); if(isRoadCell) { this.logicalGrid[nx][nz] = 1; } else if (this.logicalGrid[nx][nz] === 0) { this.logicalGrid[nx][nz] = 2; } } } } } },

    // ... Lógica de energia e UI de energia ...
    updatePowerGrid: function() { const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors]; this.powerOverlay.clear(); allPowerObjects.forEach(obj => { obj.userData.isPowered = false; }); this.powerAvailable = 0; this.powerNeeded = 0; const poweredQueue = []; this.powerProducers.forEach(producer => { this.powerAvailable += producer.userData.production; producer.userData.isPowered = true; poweredQueue.push(producer); }); let head = 0; while (head < poweredQueue.length) { const currentPowered = poweredQueue[head++]; const radius = currentPowered.userData.powerRadius || 0; if (!radius) continue; const sourcePositions = (currentPowered.isGroup && currentPowered.userData.type === 'connector') ? [currentPowered.children[0].position, currentPowered.children[1].position] : [currentPowered.position]; sourcePositions.forEach(sourcePos => { allPowerObjects.forEach(otherObj => { if (!otherObj.userData.isPowered) { const dist = sourcePos.distanceTo(otherObj.position); if(dist < radius) { otherObj.userData.isPowered = true; poweredQueue.push(otherObj); } } }); }); } poweredQueue.forEach(poweredObj => { if (poweredObj.userData.powerRadius) { const circleGeo = new THREE.CircleGeometry(poweredObj.userData.powerRadius, 32); const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 }); const circleMesh = new THREE.Mesh(circleGeo, circleMat); circleMesh.position.copy(poweredObj.position).y = this.getTerrainHeight(poweredObj.position.x, poweredObj.position.z) + 0.15; circleMesh.rotation.x = -Math.PI / 2; this.powerOverlay.add(circleMesh); } }); this.powerConsumers.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; }); this.powerConnectors.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; }); const hasEnoughPower = this.powerAvailable >= this.powerNeeded; this.powerConsumers.forEach(c => { const shouldBePowered = c.userData.isPowered && hasEnoughPower; c.userData.isPowered = shouldBePowered; this.toggleNoPowerIcon(c, !shouldBePowered); }); this.updatePowerUI(); },
    updatePowerUI: function() { if(window.UI && UI.updatePowerInfo) UI.updatePowerInfo(this.powerAvailable, this.powerNeeded); },
    updatePopulationUI: function() { if(window.UI && UI.updatePopulation) UI.updatePopulation(this.population); },
    toggleNoPowerIcon: function(building, show) { let icon = building.getObjectByName("noPowerIcon"); if (show && !icon) { if (!this.noPowerTexture) this.noPowerTexture = new THREE.TextureLoader().load('assets/no_power_icon.png'); const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 }); icon = new THREE.Sprite(material); icon.name = "noPowerIcon"; icon.scale.set(8, 8, 8); icon.position.y = (building.geometry?.parameters.height || this.gridSize) + 5; building.add(icon); } else if (!show && icon) { building.remove(icon); } },
    togglePowerOverlay: function() { this.powerOverlay.visible = !this.powerOverlay.visible; },

    // ===== NOVO SISTEMA DE ÁGUA =====
    toggleWaterOverlay: function() {
        this.waterOverlay.visible = !this.waterOverlay.visible;
    },

    updateWaterGrid: function() {
        this.waterOverlay.clear();
        const consumers = this.powerConsumers; // Assumimos que todos consumidores precisam de água
        const allWaterObjects = [...this.waterProducers, ...this.waterConnectors, ...this.sewageProcessors, ...consumers];

        // Resetar status
        consumers.forEach(c => { c.userData.hasWater = false; c.userData.hasSewage = false; });
        this.waterConnectors.forEach(p => p.material.color.set(0x333333)); // Cor cinza padrão para canos

        // Etapa 1: Espalhar ÁGUA LIMPA a partir das bombas
        let waterQueue = [...this.waterProducers];
        let waterHead = 0;
        const waterColor = new THREE.Color(0x00aaff);
        
        while(waterHead < waterQueue.length) {
            const source = waterQueue[waterHead++];
            const radius = source.userData.connectionRadius;
            
            this.waterConnectors.forEach(pipe => {
                if (pipe.material.color.equals(waterColor)) return; // Já tem água limpa
                if(pipe.position.distanceTo(source.position) < radius) {
                    pipe.material.color.set(waterColor);
                    waterQueue.push(pipe);
                }
            });

            consumers.forEach(c => {
                if (!c.userData.hasWater && c.position.distanceTo(source.position) < radius) {
                    c.userData.hasWater = true;
                }
            });
        }
        
        // Etapa 2: Espalhar CONEXÃO DE ESGOTO a partir das estações de tratamento
        let sewageQueue = [...this.sewageProcessors];
        let sewageHead = 0;
        const sewageColor = new THREE.Color(0x8fce00); // Verde-esgoto
        const mixedColor = new THREE.Color(0x4a736a); // Cor para canos com ambos

        while(sewageHead < sewageQueue.length) {
            const source = sewageQueue[sewageHead++];
            const radius = source.userData.connectionRadius;

            this.waterConnectors.forEach(pipe => {
                if (pipe.position.distanceTo(source.position) < radius) {
                    if (pipe.material.color.equals(sewageColor)) return; // Já tem conexão
                    
                    if (pipe.material.color.equals(waterColor)) { // Cano já tem água limpa?
                        pipe.material.color.set(mixedColor);
                    } else {
                        pipe.material.color.set(sewageColor);
                    }
                    sewageQueue.push(pipe);
                }
            });

            consumers.forEach(c => {
                if (!c.userData.hasSewage && c.position.distanceTo(source.position) < radius) {
                    c.userData.hasSewage = true;
                }
            });
        }
        
        // Etapa 3: Aplicar status e ícones nos edifícios
        consumers.forEach(c => {
            this.toggleNoWaterIcon(c, !c.userData.hasWater || !c.userData.hasSewage);
        });

        // Adiciona visualização da área de efeito ao overlay
        const allServiceBuildings = [...this.waterProducers, ...this.sewageProcessors];
        allServiceBuildings.forEach(b => {
            const circleGeo = new THREE.CircleGeometry(b.userData.connectionRadius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.2, side:THREE.DoubleSide });
            const circleMesh = new THREE.Mesh(circleGeo, circleMat);
            circleMesh.position.copy(b.position).y = this.getTerrainHeight(b.position.x, b.position.z) + 0.1;
            circleMesh.rotation.x = -Math.PI / 2;
            this.waterOverlay.add(circleMesh);
        });
    },

    toggleNoWaterIcon: function(building, show) {
        let icon = building.getObjectByName("noWaterIcon");
        if (show && !icon) {
            if (!this.noWaterTexture) this.noWaterTexture = new THREE.TextureLoader().load('assets/no_water_icon.png'); // Crie este ícone!
            const material = new THREE.SpriteMaterial({ map: this.noWaterTexture, color: 0x00aaff });
            icon = new THREE.Sprite(material);
            icon.name = "noWaterIcon";
            icon.scale.set(8, 8, 8);
            icon.position.y = (building.geometry?.parameters.height || this.gridSize) + 5;
            
            // Se já tiver um ícone de energia, coloca o de água ao lado
            if (building.getObjectByName("noPowerIcon")) icon.position.x = 8;
            
            building.add(icon);
        } else if (!show && icon) {
            building.remove(icon);
        }
    },
    
    // ... Veículos, População e Animate ...
    spawnVehicle: function() { const unoccupiedHouses = this.powerConsumers.filter(c => c.userData.type === 'consumer' && !c.userData.isOccupied); const commercialBuildings = this.cityObjects.filter(c => c.userData.type === 'commercial'); if (unoccupiedHouses.length === 0 || commercialBuildings.length === 0) return; const entryRoad = this.cityObjects.find(o => o.userData.type === 'road' && o.userData.curve.points[0].z > this.gridWorldSize / 2 - 5); if (!entryRoad) return; const carColors = [0xcf1b1b, 0x1b58cf, 0xcfc81b, 0x1bcf5a, 0xcf6b1b, 0xffffff, 0x333333]; const geo = new THREE.BoxGeometry(2.5, 2, 4.5); const mat = new THREE.MeshLambertMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)] }); const car = new THREE.Mesh(geo, mat); this.vehicles.push({ mesh: car, path: entryRoad.userData.curve, progress: 0, speed: 0.0005 + Math.random() * 0.0008 }); this.scene.add(car); },
    updateVehicles: function(deltaTime) { for (let i = this.vehicles.length - 1; i >= 0; i--) { const v = this.vehicles[i]; v.progress += v.speed * deltaTime * 100; if (v.progress >= 1) { this.scene.remove(v.mesh); this.vehicles.splice(i, 1); this.handleArrival(); continue; } const pos = v.path.getPointAt(v.progress); v.mesh.position.copy(pos).y += 1.2; const tangent = v.path.getTangentAt(v.progress); v.mesh.lookAt(pos.clone().add(tangent)); } },
    handleArrival: function() { const house = this.powerConsumers.find(c => c.userData.type === 'consumer' && !c.userData.isOccupied); if (house) { house.userData.isOccupied = true; house.material.color.set(house.userData.originalColor.clone().multiplyScalar(0.6)); this.population++; this.updatePopulationUI(); } },
    animate: function(time) { requestAnimationFrame(this.animate); const deltaTime = (time - this.lastTime) / 1000; this.lastTime = time; if (!this.isInitialized) return; const { x, z } = this.moveDirection; if (x !== 0 || z !== 0) { if (this.cameraMode === 'move') { this.cameraPivot.translateX(x * this.moveSpeed); this.cameraPivot.translateZ(z * this.moveSpeed); } else { this.cameraPivot.rotateY(-x * this.rotateSpeed); const newRotX = this.camera.rotation.x - z * this.rotateSpeed; if (newRotX > -1.2 && newRotX < 1.2) this.camera.rotation.x = newRotX; } } const boundary = this.gridWorldSize / 2 - 20; this.cameraPivot.position.x = THREE.MathUtils.clamp(this.cameraPivot.position.x, -boundary, boundary); this.cameraPivot.position.z = THREE.MathUtils.clamp(this.cameraPivot.position.z, -boundary, boundary); if (time - this.lastSpawnTime > 4000) { if(Math.random() < 0.5) this.spawnVehicle(); this.lastSpawnTime = time; } this.updateVehicles(deltaTime || 0); this.renderer.render(this.scene, this.camera); }
};
