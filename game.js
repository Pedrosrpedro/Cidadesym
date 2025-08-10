// game.js

const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10,
    
    // Novas variáveis para desenhar estradas
    isDrawingRoad: false,
    roadStartPoint: null,

    init: function() {
        if (this.isInitialized) return;
        this.setupScene();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate();
        this.isInitialized = true;
    },
    
    setupScene: function() { /* ... código sem alterações ... */ },

    setBuildMode: function(mode) {
        this.buildMode = mode;
        this.buildCursor.visible = (mode !== 'select');
        this.isDrawingRoad = false; // Reseta o desenho de estrada
        this.roadStartPoint = null;
        console.log("Modo de construção: ", mode);
    },

    setupControls: function() {
        // ... (código do joystick e botão de modo de câmera sem alterações) ...
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousemove', (e) => this.updateCursor(e.clientX, e.clientY));
        canvas.addEventListener('touchmove', (e) => { if (e.touches.length > 0) this.updateCursor(e.touches[0].clientX, e.touches[0].clientY); });
        
        // O clique agora chama uma função de "ação" mais inteligente
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
        if (this.buildMode.startsWith('road')) {
            this.handleRoadPlacement();
        } else {
            this.placeObject();
        }
    },

    handleRoadPlacement: function() {
        if (!this.isDrawingRoad) {
            // Primeiro clique: define o ponto inicial
            this.roadStartPoint = this.buildCursor.position.clone();
            this.isDrawingRoad = true;
            console.log("Início da estrada definido em:", this.roadStartPoint);
        } else {
            // Segundo clique: define o ponto final e cria a estrada
            const endPoint = this.buildCursor.position.clone();
            console.log("Fim da estrada definido em:", endPoint);
            this.createRoadSegment(this.roadStartPoint, endPoint);
            this.isDrawingRoad = false;
            this.roadStartPoint = null;
        }
    },

    createRoadSegment: function(start, end) {
        const roadPath = new THREE.Vector3().subVectors(end, start);
        const roadLength = roadPath.length();
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        
        // Usamos uma caixa comprida para simular a estrada
        const roadGeometry = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, roadLength);
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

        // Posiciona a estrada no meio do caminho entre o início e o fim
        roadMesh.position.copy(start).add(roadPath.multiplyScalar(0.5));
        
        // Orienta a estrada para apontar do início ao fim
        roadMesh.lookAt(end);
        
        this.scene.add(roadMesh);
    },
    
    placeObject: function() {
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0;
        switch (this.buildMode) {
            case 'residential':
            case 'commercial':
                // ... (código de colocar casas e comércio sem alterações) ...
                break;
            // Novos casos para usinas elétricas
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
    
    animate: function() { /* ... código sem alterações ... */ }
};
