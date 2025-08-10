// game.js (Completo com Lógica de Construção)

const Game = {
    // Flags e Variáveis de Estado
    isInitialized: false,
    buildMode: 'select', // 'select', 'road', 'residential', etc.
    cameraMode: 'move',

    // Objetos Three.js
    scene: null,
    camera: null,
    renderer: null,
    cameraPivot: null,
    mapPlane: null,
    buildCursor: null, // O cursor 3D que mostra onde vamos construir
    raycaster: new THREE.Raycaster(),

    // Controles e Movimento
    joystick: null,
    moveDirection: { x: 0, z: 0 },
    mouse: new THREE.Vector2(),
    moveSpeed: 0.5,
    rotateSpeed: 0.02,
    pinchStartDistance: 0,
    zoomSpeed: 0.1,
    gridSize: 10,

    init: function() {
        if (this.isInitialized) return;
        DebugConsole.log("Game.init: Iniciando ambiente 3D...");

        if (typeof THREE === 'undefined' || typeof nipplejs === 'undefined') {
            DebugConsole.error("Game.init: ERRO CRÍTICO! Bibliotecas (Three.js ou NippleJS) não encontradas.");
            return;
        }

        try {
            // 1. Configuração da Cena e Renderizador
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB);
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            document.getElementById('game-container').appendChild(this.renderer.domElement);

            // 2. Configuração da Câmera
            this.cameraPivot = new THREE.Object3D();
            this.scene.add(this.cameraPivot);
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 50, 50);
            this.camera.lookAt(this.cameraPivot.position);
            this.cameraPivot.add(this.camera);

            // 3. Luzes
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(50, 100, 25);
            this.scene.add(dirLight);

            // 4. Mapa (aumentamos o tamanho para mais espaço)
            this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x228B22 }));
            this.mapPlane.rotation.x = -Math.PI / 2;
            this.scene.add(this.mapPlane);
            
            // 5. Cursor de Construção
            const cursorGeometry = new THREE.BoxGeometry(this.gridSize, 1, this.gridSize);
            const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
            this.buildCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
            this.buildCursor.visible = false; // Começa invisível
            this.scene.add(this.buildCursor);
            
            // 6. Configura Controles e Inicia Loop
            this.setupControls();
            this.animate = this.animate.bind(this);
            this.animate();
            window.addEventListener('resize', () => this.onWindowResize());
            
            this.isInitialized = true;
            UI.showGameUI(true); // Mostra a barra de ferramentas inferior
            DebugConsole.log("Game.init: Inicialização concluída com sucesso.");
        } catch (err) {
            DebugConsole.error("Game.init: ERRO CRÍTICO DURANTE A INICIALIZAÇÃO: " + err.stack);
        }
    },
    
    setBuildMode: function(mode) {
        this.buildMode = mode;
        // O cursor deve ser visível para qualquer modo de construção, exceto seleção.
        this.buildCursor.visible = (mode !== 'select');
        DebugConsole.log(`Modo de construção alterado para: ${mode}`);
    },

    setupControls: function() {
        // --- Joystick e Botão de Modo de Câmera (sem alterações) ---
        // ... (código existente)

        // --- Controles de Construção no Canvas ---
        const canvas = this.renderer.domElement;
        
        // Listener para mover o cursor
        const updateCursorAction = (x, y) => {
            if (!this.buildCursor.visible) return;
            
            this.mouse.x = (x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(y / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            const intersects = this.raycaster.intersectObject(this.mapPlane);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                // "Cola" o cursor na grade
                this.buildCursor.position.x = Math.round(point.x / this.gridSize) * this.gridSize;
                this.buildCursor.position.y = 0.5; // Um pouco acima do chão para não "brigar" com a estrada
                this.buildCursor.position.z = Math.round(point.z / this.gridSize) * this.gridSize;
            }
        };

        canvas.addEventListener('mousemove', (e) => updateCursorAction(e.clientX, e.clientY));
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) updateCursorAction(e.touches[0].clientX, e.touches[0].clientY);
        });

        // Listener para colocar o objeto
        const placeObjectAction = () => {
            if (!this.buildCursor.visible || this.buildMode === 'select') return;
        
            DebugConsole.log(`Tentando construir '${this.buildMode}' na posição ${this.buildCursor.position.x}, ${this.buildCursor.position.z}`);
            let newObject;
            let objectHeight = 0;
            
            switch (this.buildMode) {
                case 'road':
                    newObject = new THREE.Mesh(
                        new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize),
                        new THREE.MeshLambertMaterial({ color: 0x444444 })
                    );
                    objectHeight = 0.1; // Metade da altura, para ficar sobre o chão
                    break;
                case 'residential':
                    objectHeight = this.gridSize; // Altura total
                    newObject = new THREE.Mesh(
                        new THREE.BoxGeometry(this.gridSize, objectHeight, this.gridSize),
                        new THREE.MeshLambertMaterial({ color: 0x00cc00 }) // Casa verde
                    );
                    break;
                case 'commercial':
                    objectHeight = this.gridSize * 1.5; // Altura total
                    newObject = new THREE.Mesh(
                        new THREE.BoxGeometry(this.gridSize, objectHeight, this.gridSize),
                        new THREE.MeshLambertMaterial({ color: 0x0000cc }) // Comércio azul
                    );
                    break;
                case 'demolish':
                     // A lógica de demolir será mais complexa (precisaremos de uma lista de objetos)
                     DebugConsole.log("Modo de demolição ainda não implementado.");
                     return;
                default:
                    return;
            }
            
            newObject.position.copy(this.buildCursor.position);
            // Levanta o objeto para que sua base toque o chão
            if(this.buildMode !== 'road') {
                newObject.position.y = objectHeight / 2;
            }
            
            this.scene.add(newObject);
        };
        
        canvas.addEventListener('click', placeObjectAction);
        canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0 && e.changedTouches.length === 1) placeObjectAction();
        });
    },
    
    animate: function() {
        requestAnimationFrame(this.animate);

        // Lógica de movimento da câmera com o joystick
        const moveX = this.moveDirection.x;
        const moveZ = this.moveDirection.z;

        if (this.cameraMode === 'move' && (moveX !== 0 || moveZ !== 0)) {
            this.cameraPivot.translateX(moveX * this.moveSpeed);
            this.cameraPivot.translateZ(moveZ * this.moveSpeed);
        } else if (this.cameraMode === 'rotate' && (moveX !== 0 || moveZ !== 0)) {
            this.cameraPivot.rotateY(-moveX * this.rotateSpeed);
            const newRotationX = this.camera.rotation.x - moveZ * this.rotateSpeed;
            if (newRotationX > -1.2 && newRotationX < 1.2) {
                 this.camera.rotation.x = newRotationX;
            }
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },
    
    onWindowResize: function() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        DebugConsole.log("Janela redimensionada.");
    }
};
