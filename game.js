// game.js (Versão com correção de eventos e diagnóstico de animação)

const Game = {
    isInitialized: false,
    scene: null, camera: null, renderer: null, cameraPivot: null,
    joystick: null, cameraMode: 'move',
    moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    pinchStartDistance: 0, zoomSpeed: 0.1,
    lastLogTime: 0, // Variável para controlar o spam de logs

    init: function() {
        if (this.isInitialized) return;
        DebugConsole.log("Game.init: Iniciando ambiente 3D...");

        if (typeof THREE === 'undefined') { DebugConsole.error("Game.init: ERRO CRÍTICO! Biblioteca Three.js não encontrada."); return; }
        if (typeof nipplejs === 'undefined') { DebugConsole.error("Game.init: ERRO CRÍTICO! Biblioteca NippleJS não encontrada."); return; }

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

            // Garante que 'this' dentro do animate se refira ao objeto Game
            this.animate = this.animate.bind(this);
            this.animate();
            
            window.addEventListener('resize', () => this.onWindowResize());
            this.isInitialized = true;
            DebugConsole.log("Game.init: Inicialização concluída com sucesso.");
        } catch (err) {
            DebugConsole.error("Game.init: ERRO CRÍTICO DURANTE A INICIALIZAÇÃO: " + err.stack);
        }
    },
    
    setupControls: function() {
        DebugConsole.log("setupControls: Configurando controles...");
        
        // --- Joystick ---
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone) {
             const options = { zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 150 };
             this.joystick = nipplejs.create(options);
             
             this.joystick.on('move', (evt, data) => {
                 const angle = data.angle.radian;
                 const force = data.force;
                 this.moveDirection.x = Math.cos(angle) * force;
                 this.moveDirection.z = -Math.sin(angle) * force;
             }).on('end', () => {
                 this.moveDirection.x = 0;
                 this.moveDirection.z = 0;
             });
        }
        
        // --- Botão de alternar modo (COM COOLDOWN PARA CORRIGIR O BUG) ---
        const modeBtn = document.getElementById('camera-mode-btn');
        if (modeBtn) {
            let modeBtnCooldown = false;
            modeBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (modeBtnCooldown) {
                    DebugConsole.log("Botão de modo em cooldown, ignorando toque.");
                    return;
                }
                
                this.cameraMode = (this.cameraMode === 'move') ? 'rotate' : 'move';
                modeBtn.textContent = this.cameraMode === 'move' ? '[Mover]' : '[Rotar]';
                DebugConsole.log(`MODO DE CÂMERA ALTERADO PARA: ${this.cameraMode}`);

                // Ativa o cooldown
                modeBtnCooldown = true;
                setTimeout(() => { 
                    modeBtnCooldown = false; 
                    DebugConsole.log("Cooldown do botão de modo finalizado.");
                }, 300); // 300ms de tempo de recarga
            }, { passive: false });
        }

        // --- Pinch-to-zoom (sem mudanças) ---
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
    },

    animate: function() {
        requestAnimationFrame(this.animate);

        const now = performance.now();
        // Loga o estado da animação a cada 250ms para não sobrecarregar o console
        if (now - this.lastLogTime > 250) {
            DebugConsole.log(`Animate Loop: mode=${this.cameraMode}, moveX=${this.moveDirection.x.toFixed(2)}, moveZ=${this.moveDirection.z.toFixed(2)}`);
            this.lastLogTime = now;
        }

        const moveX = this.moveDirection.x;
        const moveZ = this.moveDirection.z;

        if (moveX !== 0 || moveZ !== 0) {
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
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },
    
    onWindowResize: function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        DebugConsole.log("Janela redimensionada.");
    }
};
