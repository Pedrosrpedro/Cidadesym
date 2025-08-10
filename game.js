// game.js (Versão à prova de falhas com diagnóstico pesado)

const Game = {
    isInitialized: false,
    scene: null, camera: null, renderer: null, cameraPivot: null,
    joystick: null, cameraMode: 'move',
    moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    pinchStartDistance: 0, zoomSpeed: 0.1,

    init: function() {
        if (this.isInitialized) {
            DebugConsole.log("Game.init: Jogo já inicializado. Ignorando chamada.");
            return;
        }
        DebugConsole.log("Game.init: Começando a inicialização do mundo 3D...");

        // =====================================================================
        // PASSO 1: VERIFICAR SE AS BIBLIOTECAS ESSENCIAIS FORAM CARREGADAS
        // =====================================================================
        if (typeof THREE === 'undefined') {
            DebugConsole.error("Game.init: ERRO CRÍTICO! A biblioteca Three.js (THREE) não foi encontrada. Verifique a conexão com a internet ou o link no index.html.");
            return; // Aborta a inicialização
        }
        if (typeof nipplejs === 'undefined') {
            DebugConsole.error("Game.init: ERRO CRÍTICO! A biblioteca NippleJS (nipplejs) não foi encontrada. Verifique a conexão com a internet ou o link no index.html.");
            return; // Aborta a inicialização
        }
        DebugConsole.log("Game.init: Bibliotecas Three.js e NippleJS encontradas com sucesso.");

        try {
            // =====================================================================
            // PASSO 2: CRIAR OS ELEMENTOS BÁSICOS DA CENA
            // =====================================================================
            DebugConsole.log("Game.init: Criando a cena (Scene)...");
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB); // Cor de céu

            DebugConsole.log("Game.init: Criando o renderizador (WebGLRenderer)...");
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            DebugConsole.log("Game.init: Adicionando o canvas do jogo ao DOM...");
            const gameContainer = document.getElementById('game-container');
            if (!gameContainer) {
                DebugConsole.error("Game.init: ERRO CRÍTICO! O container com id 'game-container' não foi encontrado no HTML.");
                return;
            }
            gameContainer.appendChild(this.renderer.domElement);
            DebugConsole.log("Game.init: Canvas adicionado com sucesso.");

            // =====================================================================
            // PASSO 3: CONFIGURAR A CÂMERA E AS LUZES
            // =====================================================================
            DebugConsole.log("Game.init: Configurando a câmera e o pivô...");
            this.cameraPivot = new THREE.Object3D();
            this.scene.add(this.cameraPivot);
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(0, 50, 50);
            this.camera.lookAt(this.cameraPivot.position);
            this.cameraPivot.add(this.camera);

            DebugConsole.log("Game.init: Adicionando luzes à cena...");
            this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(50, 100, 25);
            this.scene.add(dirLight);

            // =====================================================================
            // PASSO 4: CRIAR O MAPA
            // =====================================================================
            DebugConsole.log("Game.init: Criando o plano do mapa...");
            const mapPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(100, 100, 10, 10),
                new THREE.MeshLambertMaterial({ color: 0x228B22 }) // Verde
            );
            mapPlane.rotation.x = -Math.PI / 2;
            this.scene.add(mapPlane);
            DebugConsole.log("Game.init: Mapa criado.");

            // =====================================================================
            // PASSO 5: CONFIGURAR OS CONTROLES
            // =====================================================================
            this.setupControls();
            
            // =====================================================================
            // PASSO 6: INICIAR O LOOP DE ANIMAÇÃO
            // =====================================================================
            this.animate();
            window.addEventListener('resize', () => this.onWindowResize());
            this.isInitialized = true;
            DebugConsole.log("Game.init: ===== INICIALIZAÇÃO CONCLUÍDA COM SUCESSO! =====");

        } catch (err) {
            DebugConsole.error("Game.init: ERRO CRÍTICO DURANTE A INICIALIZAÇÃO: " + err.stack);
        }
    },
    
    setupControls: function() {
        DebugConsole.log("setupControls: Configurando controles...");
        
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone) {
             const options = { zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 150 };
             this.joystick = nipplejs.create(options);
             this.joystick.on('move', (evt, data) => {
                 const angle = data.angle.radian;
                 this.moveDirection.x = Math.cos(angle);
                 this.moveDirection.z = -Math.sin(angle);
             }).on('end', () => {
                 this.moveDirection.x = 0; this.moveDirection.z = 0;
             });
             DebugConsole.log("setupControls: Joystick criado.");
        } else {
            DebugConsole.error("setupControls: Zona do joystick ('joystick-zone') NÃO encontrada!");
        }
        
        // ... (o resto do setupControls não precisa de mudanças) ...
        const modeBtn = document.getElementById('camera-mode-btn');
        if (modeBtn) {
            // ...
        } else {
            DebugConsole.error("setupControls: Botão 'camera-mode-btn' NÃO encontrado!");
        }

        const gameCanvas = this.renderer.domElement;
        // ...
        DebugConsole.log("setupControls: Controles configurados.");
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());
        // ... (código de animação não precisa de mudanças) ...
        this.renderer.render(this.scene, this.camera);
    },
    
    onWindowResize: function() {
        // ... (código de resize não precisa de mudanças) ...
    }
};
