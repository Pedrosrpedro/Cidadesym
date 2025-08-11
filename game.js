// Gerador de Ruído Perlin para criar terreno realista.
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
        this.createInitialHighway(); // <- NOVO: Cria a rodovia inicial
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
                this.logicalGrid[i][j] = 0;
            }
        }
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
        dirLight.position.set(50, 100, 25);
        this.scene.add(dirLight);

        this.terrainMesh = this.createIslandTerrain(); // <- MODIFICADO para ser península
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
        this.waterMesh.position.y = 4.0;
        this.scene.add(this.waterMesh);
        
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 0.5, this.gridSize);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
        this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.buildCursor.visible = false;
        this.scene.add(this.buildCursor);
        
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

    // ===== FUNÇÃO MODIFICADA PARA CRIAR UMA PENÍNSULA =====
    createIslandTerrain: function() {
        const segments = 128;
        const geometry = new THREE.PlaneGeometry(this.gridWorldSize, this.gridWorldSize, segments, segments);
        const vertices = geometry.attributes.position;
        
        const colors = [];
        const sandColor = new THREE.Color(0xC2B280);
        const grassColor = new THREE.Color(0x55902A);
        const rockColor = new THREE.Color(0x808080);
        const snowColor = new THREE.Color(0xFFFAFA);
        
        const center = new THREE.Vector2(0, 0);
        const maxDist = this.gridWorldSize / 2;
        
        const baseHeight = 15.0; 
        const maxAmplitude = 60.0;

        for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const z = vertices.getY(i); // Em PlaneGeometry, a coordenada Z do mundo está em 'y'
            
            let noise = 0;
            let frequency = 2.0 / this.gridWorldSize;
            let amplitude = maxAmplitude;
            for (let j = 0; j < 4; j++) {
                noise += Noise.perlin2(x * frequency, z * frequency) * amplitude;
                frequency *= 2.2; 
                amplitude /= 2.0;
            }

            // Falloff circular padrão para criar uma ilha
            const dist = center.distanceTo(new THREE.Vector2(x, z));
            const islandFalloff = Math.pow(1.0 - THREE.MathUtils.smoothstep(dist, maxDist * 0.7, maxDist), 1.5);
            
            // NOVO: Falloff linear para criar a conexão com o continente na borda Z positiva
            const continentFalloff = THREE.MathUtils.smoothstep(z, maxDist * 0.2, maxDist);
            
            // Combina os dois falloffs, pegando o valor mais alto. Isso mantém a borda Z alta.
            const combinedFalloff = Math.max(islandFalloff, continentFalloff);

            let height = (baseHeight + noise) * combinedFalloff;
            
            vertices.setZ(i, height); // A altura do terreno é o eixo Z do vértice no BufferGeometry

            if (height < 6) {
                colors.push(sandColor.r, sandColor.g, sandColor.b);
            } else if (height < 35) {
                colors.push(grassColor.r, grassColor.g, grassColor.b);
            } else if (height < 50) {
                 colors.push(rockColor.r, rockColor.g, rockColor.b);
            } else {
                 colors.push(snowColor.r, snowColor.g, snowColor.b);
            }
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    },
    
    // ===== NOVA FUNÇÃO PARA CRIAR A RODOVIA INICIAL =====
    createInitialHighway: function() {
        const halfSize = this.gridWorldSize / 2;
        // Começa na borda do "continente" e vai até um pouco para dentro do mapa
        const startPoint = new THREE.Vector3(0, 0, halfSize -1); // Começa na borda
        const endPoint = new THREE.Vector3(0, 0, -50);        // Termina perto do centro
        
        this.createRoadSegment(startPoint, endPoint);
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
        canvas.addEventListener('mousemove', (e) => this.updateCursor(e));
        canvas.addEventListener('click', () => this.handleMapClick());
        
        window.addEventListener('keydown', (e) => {
            if (this.buildMode === 'road-curved') {
                if (e.key === 'Enter') this.finalizeCurvedRoad();
                else if (e.key === 'Escape') this.cancelCurvedRoad();
            }
        });
    },

    updateCursor: function(e) {
        if (!this.buildCursor.visible) {
            this.terraformCursor.visible = false;
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouse.x = (x / rect.width) * 2 - 1;
        this.mouse.y = -(y / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.terrainMesh);
        
        if (intersects.length > 0) {
            const pos = intersects[0].point;
            const gridX = Math.round(pos.x / this.gridSize);
            const gridZ = Math.round(pos.z / this.gridSize);
            const snappedX = gridX * this.gridSize;
            const snappedZ = gridZ * this.gridSize;
            
            const terrainHeight = intersects[0].point.y; 
            
            this.buildCursor.position.set(snappedX, terrainHeight + 0.25, snappedZ);
            
            const needsTerraformingCursor = this.buildMode.startsWith('power') || this.buildMode === 'residential' || this.buildMode === 'commercial' || this.buildMode.startsWith('terraform');
            this.terraformCursor.visible = needsTerraformingCursor;
            if (needsTerraformingCursor) {
                this.terraformCursor.position.set(snappedX, terrainHeight + 0.05, snappedZ);
                if(this.buildMode === 'terraform-raise') this.terraformCursor.material.color.set(0x00ff00);
                else if(this.buildMode === 'terraform-lower') this.terraformCursor.material.color.set(0xff0000);
                else this.terraformCursor.material.color.set(0xdaa520);
            }
            
            if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
                const logicalCoords = this.worldToGridCoords(this.buildCursor.position);
                if (logicalCoords && this.logicalGrid[logicalCoords.x] && this.logicalGrid[logicalCoords.x][logicalCoords.z] === 2) {
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
        } else if (this.buildMode.startsWith('terraform')) {
            this.modifyTerrainOnClick();
        } else {
            this.placeObject();
        }
    },

    modifyTerrainOnClick: function() {
        if (!this.buildCursor.visible) return;

        const center = this.buildCursor.position;
        const brushSize = this.gridSize * 1.5;
        const brushStrength = 0.5;

        const terrainGeo = this.terrainMesh.geometry;
        const vertices = terrainGeo.attributes.position;

        for (let i = 0; i < vertices.count; i++) {
            const vPos = new THREE.Vector3(vertices.getX(i), 0, vertices.getY(i));
            const dist = vPos.distanceTo(new THREE.Vector3(center.x, 0, center.z));

            if (dist < brushSize) {
                const falloff = Math.cos((dist / brushSize) * (Math.PI / 2));
                const amount = brushStrength * falloff;
                
                let currentHeight = vertices.getZ(i);
                if (this.buildMode === 'terraform-raise') {
                    vertices.setZ(i, currentHeight + amount);
                } else if (this.buildMode === 'terraform-lower') {
                    vertices.setZ(i, currentHeight - amount);
                }
            }
        }
        vertices.needsUpdate = true;
        terrainGeo.computeVertexNormals();
        this.updateTerrainColors();
    },

    updateTerrainColors: function() {
        const terrainGeo = this.terrainMesh.geometry;
        const vertices = terrainGeo.attributes.position;
        const colors = [];
        const sandColor = new THREE.Color(0xC2B280);
        const grassColor = new THREE.Color(0x55902A);
        const rockColor = new THREE.Color(0x808080);
        const snowColor = new THREE.Color(0xFFFAFA);

        for(let i = 0; i < vertices.count; i++) {
            const height = vertices.getZ(i);
            if (height < 6) {
                colors.push(sandColor.r, sandColor.g, sandColor.b);
            } else if (height < 35) {
                colors.push(grassColor.r, grassColor.g, grassColor.b);
            } else if (height < 50) {
                 colors.push(rockColor.r, rockColor.g, rockColor.b);
            } else {
                 colors.push(snowColor.r, snowColor.g, snowColor.b);
            }
        }
        terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        terrainGeo.attributes.color.needsUpdate = true;
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
                this.temporaryPole.position.copy(this.startPoint).y = this.getTerrainHeight(this.startPoint.x, this.startPoint.z) + poleHeight / 2;
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

    cancelCurvedRoad: function() {
        this.curveGuideMeshes.forEach(mesh => this.scene.remove(mesh));
        this.curveGuideMeshes = [];
        this.currentCurvePoints = [];
    },
    
    // ===== FUNÇÃO CORRIGIDA PARA ADICIONAR A ESTRADA À CENA IMEDIATAMENTE =====
    createRoadObject: function(points) {
        const pointsWithTerrainHeight = points.map(p => {
            const point = p.clone();
            point.y = this.getTerrainHeight(p.x, p.z) + 0.1; 
            return point;
        });

        const curve = new THREE.CatmullRomCurve3(pointsWithTerrainHeight);
        const curvePoints = curve.getPoints(Math.max(50, Math.floor(curve.getLength() * 1.5)));
        const roadWidth = this.gridSize * 0.8;

        const roadVertices = [];
        const roadIndices = [];
        const up = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < curvePoints.length; i++) {
            const point = curvePoints[i];
            const tangent = curve.getTangentAt(i / (curvePoints.length - 1));
            const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const v1 = point.clone().add(side.clone().multiplyScalar(roadWidth / 2));
            const v2 = point.clone().add(side.clone().multiplyScalar(-roadWidth / 2));
            roadVertices.push(v1.x, v1.y, v1.z);
            roadVertices.push(v2.x, v2.y, v2.z);
        }

        for (let i = 0; i < curvePoints.length - 1; i++) {
            const p1_prev = i * 2;
            const p2_prev = i * 2 + 1;
            const p1_curr = (i + 1) * 2;
            const p2_curr = (i + 1) * 2 + 1;
            roadIndices.push(p1_prev, p2_prev, p1_curr);
            roadIndices.push(p2_prev, p2_curr, p1_curr);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
        geo.setIndex(roadIndices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.userData = { 
            type: 'road-unified', 
            points: curvePoints
        };
        
        // Adiciona a estrada à cena ANTES de verificar interseções.
        this.addRoadObjectToScene(mesh);
        
        this.terraformArea(mesh);
        this.checkForAndProcessIntersections(mesh);
    },

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

    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        const position = this.buildCursor.position.clone();
        if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
            const logicalCoords = this.worldToGridCoords(position);
            if (!logicalCoords || !this.logicalGrid[logicalCoords.x] || this.logicalGrid[logicalCoords.x][logicalCoords.z] !== 2) { return; }
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
    
    terraformArea: function(pathObject, buildingPoints = null, areaSize = this.gridSize) {
        const terrainGeo = this.terrainMesh.geometry;
        const vertices = terrainGeo.attributes.position;
        const maxDeformationThreshold = 2.0;
        let needsColorUpdate = false;

        if (pathObject && pathObject.userData.type?.startsWith('road')) {
            const pathPoints = pathObject.userData.points;
            if (!pathPoints || pathPoints.length < 2) return;
            
            const modifiedVertices = new Set();
            for (const pointOnCurve of pathPoints) {
                this.findAndModifyVertices(pointOnCurve, areaSize, pointOnCurve.y, vertices, modifiedVertices, maxDeformationThreshold);
            }
            needsColorUpdate = true;

        } else if (buildingPoints) {
            const centerPoint = buildingPoints[0];
            let totalHeight = 0;
            let count = 0;
            const halfSize = areaSize / 2;

            for (let i = 0; i < vertices.count; i++) {
                const vX = vertices.getX(i);
                const vZ = vertices.getY(i);
                if (vX >= centerPoint.x - halfSize && vX <= centerPoint.x + halfSize &&
                    vZ >= centerPoint.z - halfSize && vZ <= centerPoint.z + halfSize) {
                    totalHeight += vertices.getZ(i);
                    count++;
                }
            }
            const averageHeight = count > 0 ? totalHeight / count : this.getTerrainHeight(centerPoint.x, centerPoint.z);
            this.findAndModifyVertices(centerPoint, areaSize, averageHeight, vertices, new Set());
            needsColorUpdate = true;
            vertices.needsUpdate = true;
            terrainGeo.computeVertexNormals();
            if (needsColorUpdate) { this.updateTerrainColors(); }
            return averageHeight;
        }

        vertices.needsUpdate = true;
        terrainGeo.computeVertexNormals();
        if (needsColorUpdate) {
            this.updateTerrainColors();
        }
    },

    findAndModifyVertices: function(center, size, newHeight, vertices, modifiedSet, threshold = -1) {
        const halfSize = size / 2;
        for (let i = 0; i < vertices.count; i++) {
            if (modifiedSet.has(i)) continue;

            const vX = vertices.getX(i);
            const vZ = vertices.getY(i);
            const dist = Math.sqrt(Math.pow(vX - center.x, 2) + Math.pow(vZ - center.z, 2));

            if (dist < halfSize) {
                const currentHeight = vertices.getZ(i);
                let finalHeight = newHeight;
                
                if (threshold >= 0) {
                    const heightDifference = Math.abs(currentHeight - newHeight);
                    if (heightDifference < threshold) {
                        continue;
                    }
                    const falloff = 1.0 - THREE.MathUtils.smoothstep(dist, 0, halfSize);
                    finalHeight = THREE.MathUtils.lerp(currentHeight, newHeight, falloff);
                }
                
                vertices.setZ(i, finalHeight);
                modifiedSet.add(i);
            }
        }
    },

    getTerrainHeight: function(x, z) {
        this.raycaster.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
        const intersects = this.raycaster.intersectObject(this.terrainMesh);
        return intersects.length > 0 ? intersects[0].point.y : 0;
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
                    const roadPoints = road.userData.points;
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

    removeObject: function(object, doRecalculate = true) {
        const wasRoad = object.userData.type?.startsWith('road') || object.userData.type === 'intersection';
        this.cityObjects = this.cityObjects.filter(o => o.uuid !== object.uuid);
        this.powerProducers = this.powerProducers.filter(o => o.uuid !== object.uuid);
        this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== object.uuid);
        this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== object.uuid);
        
        if(object.parent) object.parent.remove(object);
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

    // ===== FUNÇÃO CORRIGIDA PARA NÃO ADICIONAR A ESTRADA DUAS VEZES =====
    checkForAndProcessIntersections: function(newRoadObject) {
        let intersections = [];
        const roadsToCheck = this.cityObjects.filter(obj => obj.userData.type?.startsWith('road'));

        for (const existingRoad of roadsToCheck) {
            if (existingRoad === newRoadObject) continue;
            const existingRoadSegments = this.getRoadSegments(existingRoad);
            const newRoadSegments = this.getRoadSegments(newRoadObject);
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
                const firstSegment = new THREE.Line3(roadPoints[0], roadPoints[roadPoints.length-1]);
                const allPoints = [...roadPoints, ...intersectionPointsOnThisRoad].sort((a, b) => 
                     firstSegment.closestPointToPoint(a, false, new THREE.Vector3()).distanceTo(roadPoints[0]) - 
                     firstSegment.closestPointToPoint(b, false, new THREE.Vector3()).distanceTo(roadPoints[0])
                );

                for (let i = 0; i < allPoints.length - 1; i++) {
                    const p1 = allPoints[i];
                    const p2 = allPoints[i+1];
                    if (p1.distanceTo(p2) > 1) { 
                        this.createRoadObject([p1, p2]);
                    }
                }
            });
        }
        // O bloco 'else' que adicionava a estrada foi removido, pois ela já é adicionada em createRoadObject.
    },
    
    addRoadObjectToScene: function(roadObject) {
        roadObject.userData.isPowered = false;
        roadObject.userData.powerRadius = this.gridSize * 0.6;
        roadObject.userData.consumption = 0.1 * (roadObject.userData.points?.length || 1);
        this.scene.add(roadObject);
        this.cityObjects.push(roadObject);
        this.powerConnectors.push(roadObject);
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
    
    lineSegmentIntersection: function(p1, p2, p3, p4) {
        const den = (p1.x - p2.x) * (p3.z - p4.z) - (p1.z - p2.z) * (p3.x - p4.x);
        if (den === 0) return null;
        const t = ((p1.x - p3.x) * (p3.z - p4.z) - (p1.z - p3.z) * (p3.x - p4.x)) / den;
        const u = -((p1.x - p2.x) * (p1.z - p3.z) - (p1.z - p2.z) * (p1.x - p3.x)) / den;
        if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) {
            const avgY = (p1.y + p2.y + p3.y + p4.y) / 4;
            const intersectionPoint = new THREE.Vector3(p1.x + t * (p2.x - p1.x), avgY, p1.z + t * (p2.z - p1.z));
            return intersectionPoint;
        }
        return null;
    },

    createIntersectionNode: function(position) {
        const nodeHeight = this.getTerrainHeight(position.x, position.z);
        const geo = new THREE.CylinderGeometry(this.gridSize * 0.5, this.gridSize * 0.5, 0.3, 16);
        const mat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position).y = nodeHeight + 0.15;
        mesh.userData = { type: 'intersection', isPowered: false, powerRadius: this.gridSize * 0.6, consumption: 0.05 };
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.powerConnectors.push(mesh);
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

    worldToGridCoords: function(worldPos) {
        if (!worldPos) return null;
        const gridX = Math.floor(worldPos.x / this.gridSize) + (this.gridCells / 2);
        const gridZ = Math.floor(worldPos.z / this.gridSize) + (this.gridCells / 2);
        if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) {
            return { x: gridX, z: gridZ };
        }
        return null;
    },

    markGridCellsAroundPoint: function(point) {
        const coords = this.worldToGridCoords(point);
        if (coords) {
            if(!this.logicalGrid[coords.x]) this.logicalGrid[coords.x] = [];
            this.logicalGrid[coords.x][coords.z] = 1;
            const neighbors = [{x:0,z:1}, {x:0,z:-1}, {x:1,z:0}, {x:-1,z:0}];
            neighbors.forEach(n => {
                const nx = coords.x + n.x;
                const nz = coords.z + n.z;
                if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells) {
                    if(!this.logicalGrid[nx]) this.logicalGrid[nx] = [];
                    if (this.logicalGrid[nx][nz] === 0) {
                        this.logicalGrid[nx][nz] = 2;
                    }
                }
            });
        }
    },

    createPowerLineObject: function(start, end, firstPole) {
        const startHeight = this.getTerrainHeight(start.x, start.z);
        const endHeight = this.getTerrainHeight(end.x, end.z);
        const poleHeight = 12;
        firstPole.position.y = startHeight + poleHeight / 2;
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        const powerLineGroup = new THREE.Group();
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4);
        powerLineGroup.add(firstPole);
        const secondPole = firstPole.clone();
        secondPole.position.copy(end).y = endHeight + poleHeight / 2;
        powerLineGroup.add(secondPole);
        const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat);
        crossarm1.position.copy(start).y = startHeight + poleHeight - 1.5;
        crossarm1.rotation.y = Math.atan2(path.x, path.z) + Math.PI / 2;
        powerLineGroup.add(crossarm1);
        const crossarm2 = crossarm1.clone();
        crossarm2.position.copy(end).y = endHeight + poleHeight - 1.5;
        powerLineGroup.add(crossarm2);
        const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length);
        const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const midHeight = (startHeight + endHeight) / 2;
        wire.position.set(midPoint.x, midHeight + poleHeight - 1.7, midPoint.z);
        const endLookAt = new THREE.Vector3(end.x, endHeight + poleHeight - 1.7, end.z);
        wire.lookAt(endLookAt);
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

    updatePowerUI: function() {
        if(window.UI) {
            UI.updatePowerInfo(this.powerAvailable, this.powerNeeded);
        }
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
            icon.position.y = (building.geometry.parameters.height || this.gridSize) + 5;
            building.add(icon);
        } else if (!show && icon) {
            building.remove(icon);
        }
    },
    
    togglePowerOverlay: function() {
        this.powerOverlay.visible = !this.powerOverlay.visible;
    },
    
    // ===== FUNÇÃO MODIFICADA COM LIMITES DE CÂMERA =====
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
        
        // NOVO: Adiciona limites para a câmera não sair do mapa
        const boundary = this.gridWorldSize / 2 - 20; // 20 é um buffer da borda
        this.cameraPivot.position.x = THREE.MathUtils.clamp(this.cameraPivot.position.x, -boundary, boundary);
        this.cameraPivot.position.z = THREE.MathUtils.clamp(this.cameraPivot.position.z, -boundary, boundary);
        
        if(this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
};
