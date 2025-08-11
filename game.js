// game.js
const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,

    // Gerenciamento da cidade e da rede elétrica
    cityObjects: [],
    powerProducers: [],
    powerConsumers: [],
    powerConnectors: [],
    powerOverlay: null,
    
    // Gerenciamento de Carga
    powerAvailable: 0,
    powerNeeded: 0,

    init: function() {
        if (this.isInitialized) return;
        this.setupScene();
        this.setupControls();
        this.animate = this.animate.bind(this);
        this.animate();
        this.isInitialized = true;
        this.updatePowerUI(); // Atualiza a UI de energia no início
    },
    
    setupScene: function() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        this.cameraPivot = new THREE.Object3D(); this.scene.add(this.cameraPivot);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 80, 50); this.camera.lookAt(this.cameraPivot.position);
        this.cameraPivot.add(this.camera);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(50, 100, 25); this.scene.add(dirLight);

        this.mapPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x55902A }));
        this.mapPlane.rotation.x = -Math.PI / 2;
        this.mapPlane.userData.isGround = true; // Identifica o chão
        this.scene.add(this.mapPlane);
        
        const cursorGeo = new THREE.BoxGeometry(this.gridSize, 1, this.gridSize);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, wireframe: true });
        this.buildCursor = new THREE.Mesh(cursorGeo, cursorMat);
        this.buildCursor.visible = false; this.scene.add(this.buildCursor);

        this.powerOverlay = new THREE.Group();
        this.powerOverlay.visible = false;
        this.scene.add(this.powerOverlay);
    },

    setBuildMode: function(mode) {
        this.buildMode = mode;
        this.buildCursor.visible = (mode !== 'select');
        this.isDrawing = false; this.startPoint = null;
        this.buildCursor.material.color.set(mode === 'demolish' ? 0xff0000 : 0xffffff);
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
        if (this.buildMode === 'demolish') {
            this.demolishObject();
        } else if (this.buildMode.startsWith('road') || this.buildMode.startsWith('power-line')) {
            this.handleLinePlacement();
        } else {
            this.placeObject();
        }
    },

    handleLinePlacement: function() {
        if (!this.isDrawing) {
            this.startPoint = this.buildCursor.position.clone();
            this.isDrawing = true;
        } else {
            this.createLineSegment(this.startPoint, this.buildCursor.position.clone());
            this.isDrawing = false; this.startPoint = null;
        }
    },

    // ... (mantenha todo o código de game.js até aqui) ...

    createLineSegment: function(start, end) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        if(length === 0) return;

        let objectToAdd; // Usaremos uma variável genérica para o objeto a ser adicionado
        const objectData = { isPowered: false, type: 'connector' };

        if (this.buildMode.startsWith('road')) {
            const geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
            const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            objectToAdd = new THREE.Mesh(geo, mat);
            objectToAdd.rotation.y = Math.atan2(path.x, path.z); // Alinha a estrada corretamente
            
            objectData.powerRadius = this.gridSize * 0.6; 
            objectData.consumption = 0.1;

        } else if (this.buildMode.startsWith('power-line')) {
            // Cria um grupo para conter todas as partes da linha de energia
            const powerLineGroup = new THREE.Group();
            
            const poleHeight = 12;
            const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Marrom escuro
            const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4); // Viga transversal
            const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length);
            const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 });

            // Poste 1 (início)
            const pole1 = new THREE.Mesh(poleGeo, poleMat);
            pole1.position.copy(start);
            pole1.position.y = poleHeight / 2;
            const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat);
            crossarm1.position.copy(pole1.position).y = poleHeight - 1.5;
            crossarm1.rotation.y = Math.atan2(path.x, path.z); // Alinha a cruzeta

            // Poste 2 (fim)
            const pole2 = new THREE.Mesh(poleGeo, poleMat);
            pole2.position.copy(end);
            pole2.position.y = poleHeight / 2;
            const crossarm2 = new THREE.Mesh(crossarmGeo, poleMat);
            crossarm2.position.copy(pole2.position).y = poleHeight - 1.5;
            crossarm2.rotation.y = Math.atan2(path.x, path.z);

            // Fio
            const wire = new THREE.Mesh(wireGeo, wireMat);
            wire.position.y = poleHeight - 1.7; // Posição do fio um pouco abaixo da cruzeta
            wire.lookAt(end); // Aponta o fio para o final
            
            // Adiciona todas as partes ao grupo
            powerLineGroup.add(pole1, crossarm1, pole2, crossarm2, wire);
            
            // O fio precisa ser reposicionado depois de adicionado ao grupo
            // porque o lookAt funciona com coordenadas globais.
            wire.position.copy(start).add(path.clone().multiplyScalar(0.5));
            wire.position.y = poleHeight - 1.7;

            objectToAdd = powerLineGroup;
            objectData.powerRadius = this.gridSize * 2.5; // Raio de energia do poste
            objectData.consumption = 0.2;

        } else {
            console.error("createLineSegment foi chamada com um modo inválido:", this.buildMode);
            return; 
        }
        
        // Define a posição central do objeto para cálculos de distância
        objectToAdd.position.copy(start).add(path.multiplyScalar(0.5));
        objectToAdd.userData = objectData;
        
        this.scene.add(objectToAdd);
        this.cityObjects.push(objectToAdd);
        if (objectData.type === 'connector') {
            this.powerConnectors.push(objectToAdd);
        }
        
        this.updatePowerGrid();
    },
    
    placeObject: function() {
        // (Esta função não precisa de alterações)
        if (!this.buildCursor.visible || this.buildMode === 'select') return;
        let newObject, height = 0;
        let objectData = { isPowered: false, originalColor: 0xffffff };
        const position = this.buildCursor.position.clone();
        
        switch (this.buildMode) {
            case 'residential':
                height = this.gridSize;
                objectData.originalColor = 0x34A853;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor }));
                objectData.type = 'consumer'; objectData.consumption = 5; this.powerConsumers.push(newObject);
                break;
            case 'commercial':
                height = this.gridSize * 1.5;
                objectData.originalColor = 0x4285F4;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, height, this.gridSize), new THREE.MeshLambertMaterial({ color: objectData.originalColor }));
                objectData.type = 'consumer'; objectData.consumption = 10; this.powerConsumers.push(newObject);
                break;
            case 'power-wind':
                height = this.gridSize * 2.5;
                newObject = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 8), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
                objectData.type = 'producer'; objectData.production = 20; objectData.powerRadius = 50; this.powerProducers.push(newObject);
                break;
            case 'power-coal':
                height = this.gridSize * 1.2;
                newObject = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize*2, height, this.gridSize*1.5), new THREE.MeshLambertMaterial({ color: 0x555555 }));
                objectData.type = 'producer'; objectData.production = 100; objectData.powerRadius = 80; this.powerProducers.push(newObject);
                break;
            default: return;
        }
        
        newObject.position.copy(position);
        newObject.position.y = height / 2;
        newObject.userData = objectData;
        
        this.scene.add(newObject);
        this.cityObjects.push(newObject);
        this.updatePowerGrid();
    },

    demolishObject: function() {
        // ATENÇÃO: A chamada do raycaster foi alterada para `true` para buscar dentro de grupos
        const intersects = this.raycaster.intersectObjects(this.cityObjects, true);
        if (intersects.length > 0) {
            // Pega o objeto pai (o grupo, no caso de linhas de energia)
            let objectToDemolish = intersects[0].object;
            while (objectToDemolish.parent && objectToDemolish.parent !== this.scene) {
                 objectToDemolish = objectToDemolish.parent;
            }
            
            this.cityObjects = this.cityObjects.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerProducers = this.powerProducers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== objectToDemolish.uuid);
            
            this.scene.remove(objectToDemolish);
            // Limpa a memória dos filhos do grupo também
            objectToDemolish.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });

            this.updatePowerGrid();
        }
    },

    updatePowerGrid: function() {
        const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors];
        
        // 1. Resetar todos
        this.powerOverlay.clear(); // Limpa a visualização da rede
        allPowerObjects.forEach(obj => { obj.userData.isPowered = false; });
        this.powerAvailable = 0;
        this.powerNeeded = 0;

        // 2. Energizar a partir das usinas
        const poweredQueue = [];
        this.powerProducers.forEach(producer => {
            this.powerAvailable += producer.userData.production;
            producer.userData.isPowered = true;
            poweredQueue.push(producer);
        });

        // 3. Propagar energia pela rede
        let head = 0;
        while(head < poweredQueue.length) {
            const currentPowered = poweredQueue[head++];
            const radius = currentPowered.userData.powerRadius || 0;

            allPowerObjects.forEach(otherObj => {
                if (!otherObj.userData.isPowered) {
                    const distance = currentPowered.position.distanceTo(otherObj.position);
                    if (distance < radius) {
                        otherObj.userData.isPowered = true;
                        poweredQueue.push(otherObj);
                    }
                }
            });
        }
        
        // NOVO: 3.5. Desenha o raio de energia de TODOS os objetos energizados que têm um
        poweredQueue.forEach(poweredObj => {
            if (poweredObj.userData.powerRadius) {
                const radius = poweredObj.userData.powerRadius;
                const circleGeo = new THREE.CircleGeometry(radius, 32);
                const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 });
                const circleMesh = new THREE.Mesh(circleGeo, circleMat);
                circleMesh.position.copy(poweredObj.position);
                circleMesh.position.y = 0.1;
                circleMesh.rotation.x = -Math.PI / 2;
                this.powerOverlay.add(circleMesh);
            }
        });
        
        // 4. Calcular o consumo
        this.powerConsumers.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        this.powerConnectors.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
        const hasEnoughPower = this.powerAvailable >= this.powerNeeded;

        // 5. Atualizar as cores
        this.powerConsumers.forEach(c => {
            const shouldBePowered = c.userData.isPowered && hasEnoughPower;
            c.material.color.set(shouldBePowered ? c.userData.originalColor : 0x808080);
            this.toggleNoPowerIcon(c, !shouldBePowered);
        });

        this.updatePowerUI();
    },

// ... (o resto do arquivo, de updatePowerUI em diante, pode continuar igual)

    updatePowerUI: function() {
        UI.updatePowerInfo(this.powerAvailable, this.powerNeeded);
    },
    
    toggleNoPowerIcon: function(building, show) {
        let icon = building.getObjectByName("noPowerIcon");
        if (show && !icon) {
            // Reutiliza uma única textura para todos os ícones para economizar memória
            if (!this.noPowerTexture) {
                this.noPowerTexture = new THREE.TextureLoader().load('https://i.imgur.com/Y32mG2S.png');
            }
            const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 });
            icon = new THREE.Sprite(material);
            icon.name = "noPowerIcon";
            icon.scale.set(8, 8, 8);
            icon.position.y = building.geometry.parameters.height + 5; // Posição acima do prédio
            building.add(icon);
        } else if (!show && icon) {
            building.remove(icon);
        }
    },
    
    togglePowerOverlay: function() {
        this.powerOverlay.visible = !this.powerOverlay.visible;
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
        if(this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
};
