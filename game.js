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
    
    // NOVO: Gerenciamento de Carga
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
        this.isDrawing = false; this.startPoint = null;
        this.buildCursor.material.color.set(mode === 'demolish' ? 0xff0000 : 0xffffff);
    },

    setupControls: function() { /* ... código sem alterações ... */ },
    
    updateCursor: function(x, y) { /* ... código sem alterações ... */ },
    
    handleMapClick: function() {
        if (this.buildMode === 'demolish') this.demolishObject();
        else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) this.handleLinePlacement();
        else this.placeObject();
    },

    handleLinePlacement: function() { /* ... código sem alterações ... */ },

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
        // CORREÇÃO AQUI: Adicionamos o mesh ao array DEPOIS de ele ter sido criado.
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

    demolishObject: function() { /* ... código sem alterações ... */ },

    updatePowerGrid: function() {
        const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors];
        allPowerObjects.forEach(obj => { obj.userData.isPowered = false; });
        this.powerOverlay.clear();
        this.powerAvailable = 0;
        this.powerNeeded = 0;

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

        let head = 0;
        while(head < poweredQueue.length) {
            const currentPowered = poweredQueue[head++];
            const radius = currentPowered.userData.powerRadius || 0;
            allPowerObjects.forEach(otherObj => {
                if (!otherObj.userData.isPowered) {
                    const distance = currentPowered.position.distanceTo(otherObj.position);
                    if (distance < radius) {
                        otherObj.userData.isPowered = true;
                        poweredQueue.push(otherObj);
                    }
                }
            });
        }
        
        this.powerConsumers.forEach(c => {
            if (c.userData.isPowered) this.powerNeeded += c.userData.consumption;
        });
        this.powerConnectors.forEach(c => {
            if (c.userData.isPowered) this.powerNeeded += c.userData.consumption;
        });
        
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
            const map = new THREE.TextureLoader().load('https://i.imgur.com/Y32mG2S.png'); // Ícone de raio
            const material = new THREE.SpriteMaterial({ map: map, color: 0xffdd00 });
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
    
    animate: function() { /* ... código sem alterações ... */ }
};
