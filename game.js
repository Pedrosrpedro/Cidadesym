const Game = {
    isInitialized: false, // Flag para não inicializar duas vezes
    scene: null, camera: null, renderer: null, cameraPivot: null,
    joystick: null, cameraMode: 'move',
    moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    pinchStartDistance: 0, zoomSpeed: 0.1,

    init: function() {
        if (this.isInitialized) return;
        DebugConsole.log("Game.init: Iniciando ambiente 3D.");

        try {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB);
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            document.getElementById('game-container').appendChild(this.renderer.domElement);

            this.cameraPivot = new THREE.Object3D();
            this.scene.add(this.cameraPivot);
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 50, 50);
            this.camera.lookAt(this.cameraPivot.position);
            this.cameraPivot.add(this.camera);

            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(50, 100, 25);
            this.scene.add(dirLight);
            const mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 10, 10), new THREE.MeshLambertMaterial({ color: 0x228B22 }));
            mapPlane.rotation.x = -Math.PI / 2;
            this.scene.add(mapPlane);

            this.setupControls();
            this.animate();
            window.addEventListener('resize', () => this.onWindowResize());
            this.isInitialized = true;
            DebugConsole.log("Game.init: Finalizado com sucesso.");
        } catch (err) {
            DebugConsole.error("ERRO CRÍTICO em Game.init: " + err.stack);
        }
    },
    
    setupControls: function() { /* ... código igual ao anterior, sem mudanças ... */ },
    animate: function() { /* ... código igual ao anterior, sem mudanças ... */ },
    onWindowResize: function() { /* ... código igual ao anterior, sem mudanças ... */ }
};
