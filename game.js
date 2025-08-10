const Game = {
    // Variáveis
    scene: null, camera: null, renderer: null, mapPlane: null,
    joystick: null, cameraPivot: null, cameraMode: 'move',
    moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    pinchStartDistance: 0, zoomSpeed: 0.1,
    isInitialized: false, // Flag para não inicializar duas vezes

    init: function() {
        if (this.isInitialized) {
            DebugConsole.error("Game.init() chamado mais de uma vez. Abortando.");
            return;
        }
        DebugConsole.log("Game.init: Iniciando ambiente 3D.");

        // Cena e Renderizador
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Câmera com Pivô
        this.cameraPivot = new THREE.Object3D();
        this.scene.add(this.cameraPivot);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 50);
        this.camera.lookAt(this.cameraPivot.position);
        this.cameraPivot.add(this.camera);

        // Luzes e Mapa
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 25);
        this.scene.add(dirLight);
        this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 10, 10), new THREE.MeshLambertMaterial({ color: 0x228B22 }));
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this.mapPlane);
        DebugConsole.log("Game.init: Objetos da cena criados.");

        this.setupControls();
        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());
        this.isInitialized = true;
        DebugConsole.log("Game.init: Finalizado com sucesso.");
    },
    
    setupControls: function() {
        DebugConsole.log("setupControls: Iniciando configuração de controles.");
        
        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone) {
             const options = { zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 150 };
             this.joystick = nipplejs.create(options);
             this.joystick.on('move', (evt, data) => {
                 const angle = data.angle.radian;
                 this.moveDirection.x = Math.cos(angle);
                 this.moveDirection.z = -Math.sin(angle);
             }).on('end', () => {
                 this.moveDirection.x = 0;
                 this.moveDirection.z = 0;
             });
             DebugConsole.log("setupControls: Joystick configurado.");
        } else {
            DebugConsole.error("setupControls: Zona do joystick ('joystick-zone') não encontrada!");
        }
        
        // Botão de alternar modo
        const modeBtn = document.getElementById('camera-mode-btn');
        if (modeBtn) {
            const toggleMode = (e) => {
                e.preventDefault();
                this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move';
                modeBtn.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]';
                DebugConsole.log(`Modo da câmera alterado para: ${this.cameraMode}`);
            };
            modeBtn.addEventListener('click', toggleMode);
            modeBtn.addEventListener('touchstart', toggleMode, { passive: false });
            DebugConsole.log("setupControls: Botão de modo de câmera configurado.");
        } else {
            DebugConsole.error("setupControls: Botão 'camera-mode-btn' não encontrado!");
        }

        // Pinch-to-Zoom
        const gameCanvas = this.renderer.domElement;
        gameCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                this.pinchStartDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            }
        }, { passive: false });
        gameCanvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                const delta = this.pinchStartDistance - currentDistance;
                this.camera.translateZ(delta * this.zoomSpeed);
                this.pinchStartDistance = currentDistance;
            }
        }, { passive: false });
        DebugConsole.log("setupControls: Listeners de Pinch-to-Zoom configurados.");
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());
        const moveX = this.moveDirection.x;
        const moveZ = this.moveDirection.z;
        if (this.cameraMode === 'move') {
            this.cameraPivot.translateX(moveX * this.moveSpeed);
            this.cameraPivot.translateZ(moveZ * this.moveSpeed);
        } else {
            this.cameraPivot.rotateY(-moveX * this.rotateSpeed);
            const newRotationX = this.camera.rotation.x - moveZ * this.rotateSpeed;
            if (newRotationX > -1.2 && newRotationX < 1.2) {
                 this.camera.rotation.x = newRotationX;
            }
        }
        this.renderer.render(this.scene, this.camera);
    },
    
    onWindowResize: function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        DebugConsole.log("Janela redimensionada.");
    }
};
