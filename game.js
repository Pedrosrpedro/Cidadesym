// game.js
const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,

    // Gerenciamento da cidade e da rede elétrica
    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    // Gerenciamento de Carga
    powerAvailable: 0,
    powerNeeded: 0,

    init: function() {
        if (this.isInitialized) return;
        this.setupScene();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate();
        this.isInitialized = true;
        this.updatePowerUI(); // Atualiza a UI de energia no início
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

        this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x55902A }));
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.mapPlane.userData.isGround = true; // Identifica o chão
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
        this.isDrawing = false; this.startPoint = null;
        this.buildCursor.material.color.set(mode === 'demolish' ? 0xff0000 : 0xffffff);
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
    
    updateCursor: function(x, y) {
        if (!this.buildCursor.visible) return;
        this.mouse.x = (x / window.innerWidth) * 2 - 1; this.mouse.y = -(y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.mapPlane);
        if (intersects.length > 0) {
            const pos = intersects[0].point;
            this.buildCursor.position.set(Math.round(pos.x / this.gridSize) * this.gridSize, 0.5, Math.round(pos.z / this.gridSize) * this.gridSize);
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
        if (!this.isDrawing) {
            this.startPoint = this.buildCursor.position.clone();
            this.isDrawing = true;
        } else {
            this.createLineSegment(this.startPoint, this.buildCursor.position.clone());
            this.isDrawing = false; this.startPoint = null;
        }
    },

    createLineSegment: function(start, end) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        if(length === 0) return;

        let geo, mat;
        const objectData = { isPowered: false, type: 'connector' };

        if (this.buildMode.startsWith('road')) {
            geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
            mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            objectData.powerRadius = this.gridSize * 0.6; // Ruas também conduzem um pouco
            objectData.consumption = 0.1;
        } else { // power-line
            geo = new THREE.CylinderGeometry(0.5, 0.5, length, 6);
            mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            objectData.powerRadius = this.gridSize * 1.5; // Postes conduzem mais longe
            objectData.consumption = 0.2;
        }
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start).add(path.multiplyScalar(0.5));
        mesh.lookAt(end);
        mesh.userData = objectData;
        
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.powerConnectors.push(mesh);
        
        this.updatePowerGrid();
    },
    
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0;
        let objectData = { isPowered: false, originalColor: 0xffffff };
        const position = this.buildCursor.position.clone();
        
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

    demolishObject: function() {
        const intersects = this.raycaster.intersectObjects(this.cityObjects);
        if (intersects.length > 0) {
            const objectToDemolish = intersects[0].object;
            
            // Remove dos arrays de gerenciamento
            this.cityObjects = this.cityObjects.filter(o => o !== objectToDemolish);
            this.powerProducers = this.powerProducers.filter(o => o !== objectToDemolish);
            this.powerConsumers = this.powerConsumers.filter(o => o !== objectToDemolish);
            this.powerConnectors = this.powerConnectors.filter(o => o !== objectToDemolish);
            
            // Remove da cena 3D e libera memória
            this.scene.remove(objectToDemolish);
            if (objectToDemolish.geometry) objectToDemolish.geometry.dispose();
            if (objectToDemolish.material) objectToDemolish.material.dispose();

            this.updatePowerGrid();
        }
    },

    updatePowerGrid: function() {
        const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors];
        
        // 1. Resetar todos
        allPowerObjects.forEach(obj => { obj.userData.isPowered = false; });
        this.powerOverlay.clear();
        this.powerAvailable = 0;
        this.powerNeeded = 0;

        // 2. Energizar a partir das usinas (os pontos de partida)
        const poweredQueue = [];
        this.powerProducers.forEach(producer => {
            this.powerAvailable += producer.userData.production;
            producer.userData.isPowered = true;
            poweredQueue.push(producer);

            const radius = producer.userData.powerRadius;
            const circleGeo = new THREE.CircleGeometry(radius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 });
            const circleMesh = new THREE.Mesh(circleGeo, circleMat);
            circleMesh.position.copy(producer.position);
            circleMesh.position.y = 0.1;
            circleMesh.rotation.x = -Math.PI / 2;
            this.powerOverlay.add(circleMesh);
        });

        // 3. Propagar energia pela rede (algoritmo de "flood fill")
        let head = 0;
        while(head < poweredQueue.length) {
            const currentPowered = poweredQueue[head++];
            const radius = currentPowered.userData.powerRadius || 0;

            allPowerObjects.forEach(otherObj => {
                if (!otherObj.userData.isPowered) { // Se o objeto ainda não tem energia
                    const distance = currentPowered.position.distanceTo(otherObj.position);
                    // Se o objeto está no raio do objeto energizado atual
                    if (distance < radius) {
                        otherObj.userData.isPowered = true;
                        poweredQueue.push(otherObj); // Adiciona na fila para propagar a partir dele
                    }
                }
            });
        }
        
        // 4. Calcular o consumo total e verificar se há energia suficiente
        this.powerConsumers.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        this.powerConnectors.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        const hasEnoughPower = this.powerAvailable >= this.powerNeeded;

        // 5. Atualizar as cores e ícones dos consumidores com base no status final
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
            // Reutiliza uma única textura para todos os ícones para economizar memória
            if (!this.noPowerTexture) {
                this.noPowerTexture = new THREE.TextureLoader().load('https://i.imgur.com/Y32mG2S.png');
            }
            const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 });
            icon = new THREE.Sprite(material);
            icon.name = "noPowerIcon";
            icon.scale.set(8, 8, 8);
            icon.position.y = building.geometry.parameters.height + 5; // Posição acima do prédio
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
