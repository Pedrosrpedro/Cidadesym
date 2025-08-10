// game.js

const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, cameraPivot: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10,

    init: function() {
        if (this.isInitialized) return;
        try {
            this.setupScene();
            this.setupControls();
            this.animate = this.animate.bind(this);
            this.animate();
            this.isInitialized = true;
        } catch (err) { console.error("Falha crítica ao iniciar o jogo:", err); }
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
        canvas.addEventListener('click', () => this.placeObject());
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
    
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0;
        switch (this.buildMode) {
            case 'road':
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x444 }));
                height = 0.1; break;
            case 'residential':
                height = this.gridSize;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x34A853 }));
                break;
            case 'commercial':
                height = this.gridSize * 1.5;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: 0x4285F4 }));
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
