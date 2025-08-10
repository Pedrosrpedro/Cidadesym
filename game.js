const Game = {
    // Variáveis da cena
    scene: null, camera: null, renderer: null, mapPlane: null,
    
    // Variáveis de controle
    joystick: null,
    cameraPivot: null, // NOVO: Um "pivô" para rotacionar a câmera
    cameraMode: 'move', // NOVO: 'move' ou 'rotate'
    moveDirection: { x: 0, y: 0, z: 0 }, // Eixos para movimento e rotação
    moveSpeed: 0.5,
    rotateSpeed: 0.02,
    
    // Variáveis do Pinch-to-Zoom
    pinchStartDistance: 0,
    zoomSpeed: 0.1,

    init: function() {
        // Configuração da Cena e Renderizador... (igual)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // NOVO: Configuração da Câmera com Pivô
        this.cameraPivot = new THREE.Object3D(); // O pivô fica no centro
        this.scene.add(this.cameraPivot);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 50);
        this.camera.lookAt(this.cameraPivot.position); // Câmera olha para o pivô
        this.cameraPivot.add(this.camera); // Anexa a câmera ao pivô
        
        // Luzes e Mapa... (igual)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 25);
        this.scene.add(directionalLight);
        const mapGeometry = new THREE.PlaneGeometry(100, 100, 10, 10);
        const mapMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        this.mapPlane = new THREE.Mesh(mapGeometry, mapMaterial);
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this.mapPlane);

        // Configura todos os controles
        this.setupControls();
        
        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());
    },
    
    setupControls: function() {
        // Joystick
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone) {
             const options = { zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' }, color: 'cyan', size: 150 };
             this.joystick = nipplejs.create(options);
             this.joystick.on('move', (evt, data) => {
                 const angle = data.angle.radian;
                 this.moveDirection.x = Math.cos(angle);
                 this.moveDirection.z = -Math.sin(angle); // Z é negativo para frente
             });
             this.joystick.on('end', () => {
                 this.moveDirection.x = 0;
                 this.moveDirection.z = 0;
             });
        }
        
        // Botão de alternar modo
        const modeBtn = document.getElementById('camera-mode-btn');
        modeBtn.addEventListener('touchstart', (e) => { // Usar touchstart para mobile
            e.preventDefault();
            if (this.cameraMode === 'move') {
                this.cameraMode = 'rotate';
                modeBtn.textContent = '[Rotar]'; // Peça um ícone de rotação aqui!
            } else {
                this.cameraMode = 'move';
                modeBtn.textContent = '[Mover]'; // Peça um ícone de movimento aqui!
            }
        });

        // Pinch-to-Zoom
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.pinchStartDistance = this.getDistance(e.touches[0], e.touches[1]);
            }
        });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const delta = this.pinchStartDistance - currentDistance;
                this.camera.translateZ(delta * this.zoomSpeed);
                this.pinchStartDistance = currentDistance;
            }
        });
    },
    
    getDistance: function(p1, p2) {
        return Math.sqrt(Math.pow(p2.pageX - p1.pageX, 2) + Math.pow(p2.pageY - p1.pageY, 2));
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());

        const moveX = this.moveDirection.x * this.moveSpeed;
        const moveZ = this.moveDirection.z * this.moveSpeed;
        
        if (this.cameraMode === 'move') {
            // Mover o PIVÔ, e a câmera se move junto
            this.cameraPivot.translateX(moveX);
            this.cameraPivot.translateZ(moveZ);
        } else { // Modo 'rotate'
            // Rotacionar o PIVÔ
            this.cameraPivot.rotateY(-this.moveDirection.x * this.rotateSpeed);
            // Rotacionar a câmera para cima e para baixo (com limites)
            const newRotationX = this.camera.rotation.x - this.moveDirection.z * this.rotateSpeed;
            if (newRotationX > -1.2 && newRotationX < 1.2) { // Limites para não virar de cabeça pra baixo
                 this.camera.rotation.x = newRotationX;
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    },
    
    onWindowResize: function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
};
