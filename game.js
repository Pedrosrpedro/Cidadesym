// game.js

const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, cameraPivot: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawingRoad: false, roadStartPoint: null,

    init: function() {
        if (this.isInitialized) return;
        DebugConsole.log("Game.init: Iniciando...");

        if (typeof THREE === 'undefined') { DebugConsole.error("Game.init: Three.js NÃO está carregado!"); return; }
        DebugConsole.log("Game.init: Three.js OK.");
        if (typeof nipplejs === 'undefined') { DebugConsole.error("Game.init: NippleJS NÃO está carregado!"); return; }
        DebugConsole.log("Game.init: NippleJS OK.");

        try {
            DebugConsole.log("Game.init: Chamando setupScene...");
            this.setupScene();
            DebugConsole.log("Game.init: setupScene concluído.");

            DebugConsole.log("Game.init: Chamando setupControls...");
            this.setupControls();
            DebugConsole.log("Game.init: setupControls concluído.");

            this.animate = this.animate.bind(this);
            this.animate();
            
            this.isInitialized = true;
            DebugConsole.log("Game.init: JOGO INICIADO COM SUCESSO!");
        } catch (err) {
            DebugConsole.error("Game.init: ERRO CRÍTICO durante a inicialização: " + err.stack);
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
        this.camera.position.set(0, 50, 50); this.camera.lookAt(this.cameraPivot.position);
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
    },

    setBuildMode: function(mode) {
        this.buildMode = mode;
        this.buildCursor.visible = (mode !== 'select');
        this.isDrawingRoad = false; this.roadStartPoint = null;
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
        canvas.addEventListener('touchmove', (e) => { if (e.touches.length > 0) this.updateCursor(e.touches[0].clientX, e.touches[0].clientY); });
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
        if (this.buildMode.startsWith('road')) this.handleRoadPlacement();
        else this.placeObject();
    },

    handleRoadPlacement: function() {
        if (!this.isDrawingRoad) {
            this.roadStartPoint = this.buildCursor.position.clone();
            this.isDrawingRoad = true;
        } else {
            this.createRoadSegment(this.roadStartPoint, this.buildCursor.position.clone());
            this.isDrawingRoad = false; this.roadStartPoint = null;
        }
    },

    createRoadSegment: function(start, end) {
        const roadPath = new THREE.Vector3().subVectors(end, start);
        const roadLength = roadPath.length();
        if(roadLength === 0) return;
        const roadGeo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, roadLength);
        const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ color: 0x444444 }));
        roadMesh.position.copy(start).add(roadPath.multiplyScalar(0.5));
        roadMesh.lookAt(end);
        this.scene.add(roadMesh);
    },
    
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0;
        switch (this.buildMode) {
            case 'residential':
                height = this.gridSize;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x34A853 }));
                break;
            case 'commercial':
                height = this.gridSize * 1.5;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x4285F4 }));
                break;
            case 'power-wind':
                height = this.gridSize * 2.5;
                newObject = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                break;
            case 'power-coal':
                height = this.gridSize * 1.2;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*1.5), new THREE.MeshLambertMaterial({ color: 0x555555 }));
                break;
            case 'power-solar':
                height = 0.4;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*3, height, this.gridSize*3), new THREE.MeshLambertMaterial({ color: 0x1a237e }));
                break;
            default: return;
        }
        newObject.position.copy(this.buildCursor.position);
        newObject.position.y = height / 2;
        this.scene.add(newObject);
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
        this.renderer.render(this.scene, this.camera);
    }
};
