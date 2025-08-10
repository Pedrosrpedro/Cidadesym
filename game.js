const Game = {
    // Variáveis da cena
    scene: null,
    camera: null,
    renderer: null,
    mapPlane: null,

    // NOVO: Variáveis para o movimento
    joystick: null,
    moveDirection: { x: 0, z: 0 }, // Armazena a direção do movimento
    moveSpeed: 0.5, // Velocidade do movimento da câmera

    init: function() {
        // --- Configuração da Cena, Câmera, Renderizador e Luzes (igual ao anterior) ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 50);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 25);
        this.scene.add(directionalLight);

        // --- Configuração do Mapa (igual ao anterior) ---
        const mapGeometry = new THREE.PlaneGeometry(100, 100);
        const mapMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        this.mapPlane = new THREE.Mesh(mapGeometry, mapMaterial);
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this.mapPlane);

        // --- NOVO: Inicialização do Joystick ---
        this.setupJoystick();

        // Inicia o loop de animação
        this.animate();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    },
    
    // NOVO: Função para configurar o joystick
    setupJoystick: function() {
        const options = {
            zone: document.getElementById('joystick-zone'),
            mode: 'static', // O joystick fica fixo
            position: { left: '50%', top: '50%' },
            color: 'cyan',
            size: 150
        };

        this.joystick = nipplejs.create(options);

        // Adiciona listeners para os eventos do joystick
        this.joystick.on('move', (evt, data) => {
            // O ângulo é em graus, convertemos para radianos
            const angle = data.angle.radian;
            // A força nos diz quão longe o joystick foi movido (de 0 a 1)
            const force = data.force;

            // Calculamos a direção do movimento
            this.moveDirection.x = Math.cos(angle) * force;
            this.moveDirection.z = -Math.sin(angle) * force; // Z é negativo para "cima" ser "para frente"
        });

        this.joystick.on('end', () => {
            // Quando soltamos o joystick, a câmera para
            this.moveDirection.x = 0;
            this.moveDirection.z = 0;
        });
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());

        // --- NOVO: Lógica de Movimento da Câmera ---
        if (this.moveDirection.x !== 0 || this.moveDirection.z !== 0) {
            // Move a câmera nas direções X e Z do mundo
            this.camera.position.x += this.moveDirection.x * this.moveSpeed;
            this.camera.position.z += this.moveDirection.z * this.moveSpeed;
        }

        // Renderiza a cena
        this.renderer.render(this.scene, this.camera);
    }
};
