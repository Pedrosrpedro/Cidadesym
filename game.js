// game.js
const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    cityObjects: [], powerProducers: [], powerConsumers: [], powerLines: [],
    powerOverlay: null,
    
    init: function() {
        if (this.isInitialized) return;
        DebugConsole.log("Game.init: Iniciando...");
        if (typeof THREE === 'undefined') { DebugConsole.error("Game.init: Three.js NÃO carregado!"); return; }
        DebugConsole.log("Game.init: Three.js OK.");
        if (typeof nipplejs === 'undefined') { DebugConsole.error("Game.init: NippleJS NÃO carregado!"); return; }
        DebugConsole.log("Game.init: NippleJS OK.");

        try {
            this.setupScene();
            this.setupControls();
            this.animate = this.animate.bind(this);
            this.animate();
            this.isInitialized = true;
            DebugConsole.log("Game.init: JOGO INICIADO COM SUCESSO!");
        } catch (err) {
            DebugConsole.error("Game.init: ERRO CRÍTICO: " + err.stack);
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

        this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x55902A }));
        this.mapPlane.rotation.x = -Math.PI / 2; this.scene.add(this.mapPlane);
        
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 1, this.gridSize);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
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
        if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) {
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
        if (this.buildMode.startsWith('road')) {
            geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
            mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        } else {
            geo = new THREE.CylinderGeometry(0.5, 0.5, length, 6);
            mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        }
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start).add(path.multiplyScalar(0.5));
        mesh.lookAt(end);
        
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        if (this.buildMode === 'power-line') this.powerLines.push(mesh);
        
        this.updatePowerGrid();
    },
    
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0, objectData = { isPowered: false };
        const position = this.buildCursor.position.clone();
        
        switch (this.buildMode) {
            case 'residential':
                height = this.gridSize;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x34A853 }));
                objectData.type = 'consumer'; this.powerConsumers.push(newObject);
                break;
            case 'commercial':
                height = this.gridSize * 1.5;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x4285F4 }));
                objectData.type = 'consumer'; this.powerConsumers.push(newObject);
                break;
            case 'power-wind':
                height = this.gridSize * 2.5;
                newObject = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                objectData.type = 'producer'; objectData.powerRadius = 40; this.powerProducers.push(newObject);
                break;
            case 'power-coal':
                height = this.gridSize * 1.2;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*1.5), new THREE.MeshLambertMaterial({ color: 0x555555 }));
                objectData.type = 'producer'; objectData.powerRadius = 75; this.powerProducers.push(newObject);
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

    updatePowerGrid: function() {
        this.powerConsumers.forEach(c => { c.userData.isPowered = false; c.material.color.set(0x808080); });
        this.powerLines.forEach(l => { l.userData.isPowered = false; });
        this.powerOverlay.clear();
        
        this.powerProducers.forEach(producer => {
            const radius = producer.userData.powerRadius;
            const circleGeo = new THREE.CircleGeometry(radius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 });
            const circleMesh = new THREE.Mesh(circleGeo, circleMat);
            circleMesh.position.copy(producer.position);
            circleMesh.position.y = 0.1;
            circleMesh.rotation.x = -Math.PI / 2;
            this.powerOverlay.add(circleMesh);

            [...this.powerConsumers, ...this.powerLines].forEach(obj => {
                if (obj.position.distanceTo(producer.position) < radius) {
                    obj.userData.isPowered = true;
                }
            });
        });
        
        this.powerConsumers.forEach(c => {
            if (c.userData.isPowered) {
                if(c.userData.type === 'consumer' && c.material.color.getHexString() === '808080') {
                    // Restaura a cor original
                    if (this.powerConsumers.includes(c)) c.material.color.set(c.userData.originalColor || (this.buildMode === 'residential' ? 0x34A853 : 0x4285F4));
                }
            }
        });
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
