// Agrupamos a lógica do jogo em um objeto para manter o código organizado
const Game = {
    // Variáveis da cena 3D
    scene: null,
    camera: null,
    renderer: null,
    mapPlane: null,

    // Função de inicialização
    init: function() {
        // --- 1. Cena (Scene) ---
        // A cena é o container que guarda todos os objetos, luzes e câmeras.
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Cor de céu azul

        // --- 2. Câmera (Camera) ---
        // A câmera define o que será visto na cena.
        // PerspectiveCamera(ângulo de visão, proporção da tela, perto, longe)
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 50, 50); // Posição inicial da câmera
        this.camera.lookAt(0, 0, 0); // Fazer a câmera olhar para o centro da cena

        // --- 3. Renderizador (Renderer) ---
        // O renderizador "desenha" a cena na tela.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // --- 4. Luzes (Lights) ---
        // Sem luz, os objetos ficariam pretos.
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Luz ambiente, ilumina tudo igualmente
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luz direcional, como o sol
        directionalLight.position.set(50, 100, 25);
        this.scene.add(directionalLight);

        // --- 5. O Mapa (um Plano) ---
        // Criamos a forma (Geometria) e a aparência (Material).
        const mapGeometry = new THREE.PlaneGeometry(100, 100); // Um plano de 100x100 unidades
        const mapMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Material verde que reage à luz
        this.mapPlane = new THREE.Mesh(mapGeometry, mapMaterial);
        this.mapPlane.rotation.x = -Math.PI / 2; // Rotacionar para que fique deitado no "chão"
        this.scene.add(this.mapPlane);

        // Inicia o loop de animação
        this.animate();

        // Ajustar a tela se a janela do navegador for redimensionada
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    },

    // --- 6. Loop de Animação (Animate) ---
    // Esta função é chamada repetidamente (cerca de 60 vezes por segundo)
    animate: function() {
        requestAnimationFrame(() => this.animate()); // Pede ao navegador para chamar a função de novo na próxima frame

        // Aqui podemos adicionar animações no futuro (ex: girar a câmera)
        
        // Renderiza a cena a partir da perspectiva da câmera
        this.renderer.render(this.scene, this.camera);
    }
};
