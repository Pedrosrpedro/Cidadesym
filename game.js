const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    
    temporaryPole: null, 
    
    // NOVO: Pontos para desenhar estradas curvas
    currentCurvePoints: [],

    // Gerenciamento da cidade e da rede elétrica
    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    // Gerenciamento de Carga
    powerAvailable: 0,
    powerNeeded: 0,

    // NOVO: Grid lógico para gerenciar onde se pode construir
    logicalGrid: [],
    gridWorldSize: 500, // Deve ser o mesmo tamanho da mapPlane
    gridCells: 50,     // gridWorldSize / gridSize

    init: function() {
        if (this.isInitialized) return;
        this.gridCells = this.gridWorldSize / this.gridSize;
        this.initializeLogicalGrid(); // Inicializa o grid lógico
        this.setupScene();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate();
        this.isInitialized = true;
        this.updatePowerUI();
    },
    
    // NOVO: Cria a matriz de dados que representa o mapa
    initializeLogicalGrid: function() {
        this.logicalGrid = [];
        for (let i = 0; i < this.gridCells; i++) {
            this.logicalGrid[i] = [];
            for (let j = 0; j < this.gridCells; j++) {
                // 0: Vazio, 1: Estrada, 2: Zona construível (adjacente a estrada)
                this.logicalGrid[i][j] = 0; 
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
        this.buildMode = mode;
        this.buildCursor.visible = (mode !== 'select');
        this.isDrawing = false; 
        this.startPoint = null;
        this.currentCurvePoints = []; // Limpa os pontos da curva ao trocar de modo
        
        if (this.temporaryPole) {
            this.scene.remove(this.temporaryPole);
            this.temporaryPole = null;
        }
        // A cor do cursor agora será definida dinamicamente em updateCursor
    },

    setupControls: function() {
        const options = { zone: document.getElementById('joystick-zone'), mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 120 };
        this.joystick = nipplejs.create(options);
        this.joystick.on('move', (evt, data) => {
            const angle = data.angle.radian; const force = data.force;
            this.moveDirection.x = Math.cos(angle) * force; this.moveDirection.z = -Math.sin(angle) * force;
        }).on('end', () => { this.moveDirection.x = 0; this.moveDirection.z = 0; });

        const modeBtn = document.getElementById('camera-mode-btn');
        if (modeBtn) modeBtn.addEventListener('click', () => {
            this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move';
            modeBtn.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]';
        });

        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousemove', (e) => this.updateCursor(e.clientX, e.clientY));
        canvas.addEventListener('click', () => this.handleMapClick());
    },
    
    // ATUALIZADO: O cursor agora muda de cor para indicar se a construção é válida
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
            
            // Lógica de cor do cursor
            if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
                const logicalCoords = this.worldToGridCoords(this.buildCursor.position);
                if (logicalCoords && this.logicalGrid[logicalCoords.x][logicalCoords.z] === 2) {
                    this.buildCursor.material.color.set(0x00ff00); // Verde: Construção permitida
                } else {
                    this.buildCursor.material.color.set(0xff0000); // Vermelho: Construção proibida
                }
            } else if (this.buildMode === 'demolish') {
                this.buildCursor.material.color.set(0xff0000);
            } else {
                 this.buildCursor.material.color.set(0xffffff); // Branco: Padrão
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

        if (this.buildMode === 'power-line') {
             if (!this.isDrawing) {
                this.startPoint = currentPos;
                const poleHeight = 12;
                const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
                this.temporaryPole = new THREE.Mesh(poleGeo, poleMat);
                this.temporaryPole.position.copy(this.startPoint);
                this.temporaryPole.position.y = poleHeight / 2;
                this.scene.add(this.temporaryPole);
                this.isDrawing = true;
            } else {
                const endPoint = currentPos;
                const distance = this.startPoint.distanceTo(endPoint);
                if (distance > 0) {
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
        else if (this.buildMode === 'road') {
            if (!this.isDrawing) {
                this.startPoint = currentPos;
                this.isDrawing = true;
            } else {
                this.createRoadSegment(this.startPoint, currentPos);
                this.isDrawing = false;
                this.startPoint = null;
            }
        }
        // NOVO: Lógica inicial para estradas curvas (a ser desenvolvida)
        else if (this.buildMode === 'road-curved') {
            console.log("Adicionando ponto para estrada curva em:", currentPos);
            this.currentCurvePoints.push(currentPos);
            // Aqui você adicionaria uma representação visual do ponto
            // E uma lógica para finalizar o desenho (ex: clique duplo, tecla Enter)
            // Ao finalizar, você chamaria uma função como 'createCurvedRoad(this.currentCurvePoints)'
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
        secondPole.position.copy(end);
        secondPole.position.y = poleHeight / 2;
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

        const objectData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 2.5, consumption: 0.2 };
        powerLineGroup.userData = objectData;
        
        powerLineGroup.position.set(0, 0, 0); 
        
        this.scene.add(powerLineGroup);
        this.cityObjects.push(powerLineGroup);
        this.powerConnectors.push(powerLineGroup);
        this.updatePowerGrid();
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
        
        // ATUALIZADO: Armazena os pontos de início/fim e o tipo para uso futuro
        mesh.userData = { 
            type: 'road', 
            startPoint: start.clone(),
            endPoint: end.clone(),
            isPowered: false, 
            powerRadius: this.gridSize * 0.6, 
            consumption: 0.1 
        };
        
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.powerConnectors.push(mesh); // Estradas também podem conduzir energia

        // NOVO: Atualiza o grid lógico com a nova estrada
        this.updateLogicalGridForRoad(mesh);

        this.updatePowerGrid();
    },

    // ATUALIZADO: A validação agora acontece aqui, antes de construir
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        
        const position = this.buildCursor.position.clone();

        // NOVO: Validação de Zoneamento
        if (this.buildMode === 'residential' || this.buildMode === 'commercial') {
            const logicalCoords = this.worldToGridCoords(position);
            // Se a célula no grid não for '2' (zona construível), cancela a construção
            if (!logicalCoords || this.logicalGrid[logicalCoords.x][logicalCoords.z] !== 2) {
                console.log("Construção cancelada: deve ser ao lado de uma estrada.");
                // Você pode adicionar um feedback sonoro ou visual aqui
                return;
            }
        }
        
        let newObject, height = 0;
        let objectData = { isPowered: false, originalColor: 0xffffff };
        
        switch (this.buildMode) {
            case 'residential':
                height = this.gridSize;
                objectData.originalColor = 0x34A853;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor }));
                objectData.type = 'consumer'; objectData.consumption = 5; this.powerConsumers.push(newObject);
                break;
            case 'commercial':
                height = this.gridSize * 1.5;
                objectData.originalColor = 0x4285F4;
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
        
        newObject.position.copy(position);
        newObject.position.y = height / 2;
        newObject.userData = objectData;
        
        this.scene.add(newObject);
        this.cityObjects.push(newObject);
        this.updatePowerGrid();
    },

    // ATUALIZADO: A demolição de estradas agora recalcula as zonas construíveis
    demolishObject: function() {
        const intersects = this.raycaster.intersectObjects(this.cityObjects, true);
        if (intersects.length > 0) {
            let objectToDemolish = intersects[0].object;
            // Garante que estamos demolindo o grupo inteiro (ex: linhas de energia)
            while (objectToDemolish.parent && objectToDemolish.parent !== this.scene) {
                 objectToDemolish = objectToDemolish.parent;
            }
            
            const wasRoad = objectToDemolish.userData.type === 'road';

            this.cityObjects = this.cityObjects.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerProducers = this.powerProducers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== objectToDemolish.uuid);
            
            this.scene.remove(objectToDemolish);
            objectToDemolish.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            
            // Se uma estrada foi demolida, recalcula todo o grid de construção
            if(wasRoad) {
                this.recalculateAllRoadAdjacency();
            }

            this.updatePowerGrid();
        }
    },
    
    // NOVO: Funções para gerenciar o Grid Lógico
    worldToGridCoords: function(worldPos) {
        const gridX = Math.round(worldPos.x / this.gridSize) + (this.gridCells / 2);
        const gridZ = Math.round(worldPos.z / this.gridSize) + (this.gridCells / 2);
        if (gridX >= 0 && gridX < this.gridCells && gridZ >= 0 && gridZ < this.gridCells) {
            return { x: gridX, z: gridZ };
        }
        return null;
    },

    updateLogicalGridForRoad: function(roadMesh) {
        const start = roadMesh.userData.startPoint;
        const end = roadMesh.userData.endPoint;
        const distance = start.distanceTo(end);
        const segments = distance / (this.gridSize / 2); // Verifica a cada meio grid
        const path = new THREE.Vector3().subVectors(end, start);
        
        for (let i = 0; i <= segments; i++) {
            const point = start.clone().add(path.clone().multiplyScalar(i / segments));
            const coords = this.worldToGridCoords(point);
            if (coords) {
                // Marca a célula da estrada como '1'
                this.logicalGrid[coords.x][coords.z] = 1;
                
                // Marca as células adjacentes como '2' (construível)
                const neighbors = [{x:0,z:1}, {x:0,z:-1}, {x:1,z:0}, {x:-1,z:0}];
                neighbors.forEach(n => {
                    const nx = coords.x + n.x;
                    const nz = coords.z + n.z;
                    if(nx >= 0 && nx < this.gridCells && nz >= 0 && nz < this.gridCells && this.logicalGrid[nx][nz] === 0) {
                        this.logicalGrid[nx][nz] = 2;
                    }
                });
            }
        }
    },

    recalculateAllRoadAdjacency: function() {
        // 1. Reseta todo o grid relacionado a estradas
        this.initializeLogicalGrid();
        // 2. Itera sobre todos os objetos da cidade e re-aplica a lógica para cada estrada existente
        this.cityObjects.forEach(obj => {
            if (obj.userData.type === 'road') {
                this.updateLogicalGridForRoad(obj);
            }
        });
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
                sourcePositions.push(currentPowered.children[0].position);
                sourcePositions.push(currentPowered.children[1].position);
            } else {
                sourcePositions.push(currentPowered.position);
            }

            sourcePositions.forEach(sourcePos => {
                allPowerObjects.forEach(otherObj => {
                    if (!otherObj.userData.isPowered) {
                        let isConnected = false;
                        if (otherObj.isGroup && otherObj.userData.type === 'connector') {
                            const pole1Pos = otherObj.children[0].position;
                            const pole2Pos = otherObj.children[1].position;
                            if (sourcePos.distanceTo(pole1Pos) < radius || sourcePos.distanceTo(pole2Pos) < radius) {
                                isConnected = true;
                            }
                        } else {
                            if (sourcePos.distanceTo(otherObj.position) < radius) {
                                isConnected = true;
                            }
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
                    overlayPositions.push(poweredObj.children[0].position);
                    overlayPositions.push(poweredObj.children[1].position);
                } else {
                    overlayPositions.push(poweredObj.position);
                }
                overlayPositions.forEach(pos => {
                    const circleGeo = new THREE.CircleGeometry(radius, 32);
                    const circleMesh = new THREE.Mesh(circleGeo, circleMat);
                    circleMesh.position.copy(pos);
                    circleMesh.position.y = 0.1;
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
                this.cameraPivot.translateX(x * this.moveSpeed); this.cameraPivot.translateZ(z * this.moveSpeed);
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
