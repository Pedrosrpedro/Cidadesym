const Game = {
    isInitialized: false, buildMode: 'select', cameraMode: 'move',
    scene: null, camera: null, renderer: null, mapPlane: null,
    buildCursor: null, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    joystick: null, moveDirection: { x: 0, z: 0 }, moveSpeed: 0.5, rotateSpeed: 0.02,
    gridSize: 10, isDrawing: false, startPoint: null,
    
    // NOVO: Armazena o primeiro poste durante a construção da linha de energia
    temporaryPole: null, 

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
        this.updatePowerUI();
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
        this.mapPlane.userData.isGround = true;
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
        this.isDrawing = false; 
        this.startPoint = null;
        // Se o usuário trocar de modo, cancela a construção de postes
        if (this.temporaryPole) {
            this.scene.remove(this.temporaryPole);
            this.temporaryPole = null;
        }
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

    // ALTERADO: Lógica de construção de linha refeita
    handleLinePlacement: function() {
        const currentPos = this.buildCursor.position.clone();

        // Lógica específica para POSTES DE ENERGIA (duas etapas)
        if (this.buildMode.startsWith('power-line')) {
            if (!this.isDrawing) {
                // 1º Clique: Cria e posiciona o primeiro poste
                this.startPoint = currentPos;
                const poleHeight = 12;
                const poleGeo = new THREE.CylinderGeometry(0.4, 0.6, poleHeight, 8);
                const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
                this.temporaryPole = new THREE.Mesh(poleGeo, poleMat);
                this.temporaryPole.position.copy(this.startPoint);
                this.temporaryPole.position.y = poleHeight / 2;
                this.scene.add(this.temporaryPole);
                this.isDrawing = true;
            } else {
                // 2º Clique: Cria o segundo poste e finaliza a linha
                const endPoint = currentPos;
                const distance = this.startPoint.distanceTo(endPoint);
                if (distance > 0) {
                    // Remove o poste temporário da cena para adicioná-lo ao grupo final
                    this.scene.remove(this.temporaryPole); 
                    this.createPowerLineObject(this.startPoint, endPoint, this.temporaryPole);
                } else {
                    // Se clicou no mesmo lugar, cancela a operação
                    this.scene.remove(this.temporaryPole);
                }
                this.isDrawing = false;
                this.startPoint = null;
                this.temporaryPole = null;
            }
        } 
        // Lógica para ESTRADAS (continua a mesma)
        else if (this.buildMode.startsWith('road')) {
            if (!this.isDrawing) {
                this.startPoint = currentPos;
                this.isDrawing = true;
            } else {
                this.createRoadSegment(this.startPoint, currentPos);
                this.isDrawing = false;
                this.startPoint = null;
            }
        }
    },
    
    // NOVO: Função dedicada para criar o objeto completo da linha de energia
    createPowerLineObject: function(start, end, firstPole) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        const poleHeight = 12;

        const powerLineGroup = new THREE.Group();
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const crossarmGeo = new THREE.BoxGeometry(4, 0.4, 0.4);
        
        // Adiciona o primeiro poste (já criado) ao grupo
        powerLineGroup.add(firstPole);

        // Cria e adiciona o segundo poste
        const secondPole = firstPole.clone();
        secondPole.position.copy(end);
        secondPole.position.y = poleHeight / 2;
        powerLineGroup.add(secondPole);

        // Cria as vigas (cruzetas) para ambos os postes
        const crossarm1 = new THREE.Mesh(crossarmGeo, poleMat);
        crossarm1.position.copy(start).y = poleHeight - 1.5;
        crossarm1.rotation.y = Math.atan2(path.x, path.z) + Math.PI / 2;
        powerLineGroup.add(crossarm1);

        const crossarm2 = crossarm1.clone();
        crossarm2.position.copy(end).y = poleHeight - 1.5;
        powerLineGroup.add(crossarm2);

        // Cria o fio
        const wireGeo = new THREE.BoxGeometry(0.2, 0.2, length);
        const wireMat = new THREE.MeshLambertMaterial({ color: 0x303030 });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.copy(start).add(path.clone().multiplyScalar(0.5));
        wire.position.y = poleHeight - 1.7;
        wire.lookAt(end);
        powerLineGroup.add(wire);

        // Define os dados do grupo
        const objectData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 2.5, consumption: 0.2 };
        powerLineGroup.userData = objectData;
        
        // A posição do grupo em si fica na origem, pois os filhos estão em coordenadas do mundo
        powerLineGroup.position.set(0, 0, 0); 
        
        this.scene.add(powerLineGroup);
        this.cityObjects.push(powerLineGroup);
        this.powerConnectors.push(powerLineGroup);
        this.updatePowerGrid();
    },
    
    // ALTERADO: Função simplificada para cuidar apenas das estradas
    createRoadSegment: function(start, end) {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        if(length === 0) return;

        const geo = new THREE.BoxGeometry(this.gridSize * 0.8, 0.2, length);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.copy(start).add(path.multiplyScalar(0.5));
        mesh.rotation.y = Math.atan2(path.x, path.z);
        
        mesh.userData = { isPowered: false, type: 'connector', powerRadius: this.gridSize * 0.6, consumption: 0.1 };
        
        this.scene.add(mesh);
        this.cityObjects.push(mesh);
        this.powerConnectors.push(mesh);
        this.updatePowerGrid();
    },

    placeObject: function() {
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
        const intersects = this.raycaster.intersectObjects(this.cityObjects, true);
        if (intersects.length > 0) {
            let objectToDemolish = intersects[0].object;
            while (objectToDemolish.parent && objectToDemolish.parent !== this.scene) {
                 objectToDemolish = objectToDemolish.parent;
            }
            
            this.cityObjects = this.cityObjects.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerProducers = this.powerProducers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConsumers = this.powerConsumers.filter(o => o.uuid !== objectToDemolish.uuid);
            this.powerConnectors = this.powerConnectors.filter(o => o.uuid !== objectToDemolish.uuid);
            
            this.scene.remove(objectToDemolish);
            objectToDemolish.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });

            this.updatePowerGrid();
        }
    },

// Encontre a função updatePowerGrid no seu game.js e substitua-a por esta:

updatePowerGrid: function() {
    const allPowerObjects = [...this.powerProducers, ...this.powerConsumers, ...this.powerConnectors];
    
    // 1. Resetar tudo
    this.powerOverlay.clear();
    allPowerObjects.forEach(obj => { obj.userData.isPowered = false; });
    this.powerAvailable = 0;
    this.powerNeeded = 0;

    // 2. Iniciar a fila com as usinas (fontes primárias)
    const poweredQueue = [];
    this.powerProducers.forEach(producer => {
        this.powerAvailable += producer.userData.production;
        producer.userData.isPowered = true;
        poweredQueue.push(producer);
    });

    // 3. Propagar energia pela rede (Algoritmo de Flood Fill APRIMORADO)
    let head = 0;
    while(head < poweredQueue.length) {
        const currentPowered = poweredQueue[head++];
        const radius = currentPowered.userData.powerRadius || 0;
        const currentPos = currentPowered.position;

        allPowerObjects.forEach(otherObj => {
            if (!otherObj.userData.isPowered) { // Apenas verifica objetos ainda sem energia
                let isConnected = false;

                // LÓGICA APRIMORADA: Verifica a conexão de maneira diferente para cada tipo de objeto
                if (otherObj.isGroup && otherObj.userData.type === 'connector') {
                    // Se for uma LINHA DE ENERGIA (um grupo), verifica a distância até CADA POSTE.
                    // Isso garante que a conexão pelas pontas funcione.
                    const pole1Pos = otherObj.children[0].position;
                    const pole2Pos = otherObj.children[1].position;
                    if (currentPos.distanceTo(pole1Pos) < radius || currentPos.distanceTo(pole2Pos) < radius) {
                        isConnected = true;
                    }
                } else {
                    // Para todos os outros objetos (prédios, estradas, usinas), usa a posição central.
                    if (currentPos.distanceTo(otherObj.position) < radius) {
                        isConnected = true;
                    }
                }

                if (isConnected) {
                    otherObj.userData.isPowered = true;
                    poweredQueue.push(otherObj); // Adiciona na fila para propagar a partir dele
                }
            }
        });
    }
    
    // 4. Desenhar o overlay de energia para todos os objetos que ficaram energizados
    poweredQueue.forEach(poweredObj => {
        if (poweredObj.userData.powerRadius) {
            const radius = poweredObj.userData.powerRadius;
            const circleGeo = new THREE.CircleGeometry(radius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.2 });
            const circleMesh = new THREE.Mesh(circleGeo, circleMat);
            
            // A posição do overlay para linhas de energia fica no meio, para estética
            let objPosition = poweredObj.position;
            if (poweredObj.isGroup && poweredObj.userData.type === 'connector') {
                objPosition = poweredObj.children[0].position.clone().add(poweredObj.children[1].position).multiplyScalar(0.5);
            }

            circleMesh.position.copy(objPosition);
            circleMesh.position.y = 0.1;
            circleMesh.rotation.x = -Math.PI / 2;
            this.powerOverlay.add(circleMesh);
        }
    });
    
    // 5. Calcular o consumo total e verificar se há energia suficiente
    this.powerConsumers.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
    this.powerConnectors.forEach(c => { if (c.userData.isPowered) this.powerNeeded += c.userData.consumption; });
    const hasEnoughPower = this.powerAvailable >= this.powerNeeded;

    // 6. Atualizar as cores e ícones dos consumidores com base no status final
    this.powerConsumers.forEach(c => {
        const shouldBePowered = c.userData.isPowered && hasEnoughPower;
        c.material.color.set(shouldBePowered ? c.userData.originalColor : 0x808080);
        this.toggleNoPowerIcon(c, !shouldBePowered);
    });

    this.updatePowerUI();
},

    updatePowerUI: function() {
        UI.updatePowerInfo(this.powerAvailable, this.powerNeeded);
    },
    
    toggleNoPowerIcon: function(building, show) {
        let icon = building.getObjectByName("noPowerIcon");
        if (show && !icon) {
            if (!this.noPowerTexture) {
                // ALTERADO: Carrega a imagem da pasta local 'assets'
                this.noPowerTexture = new THREE.TextureLoader().load('assets/no_power_icon.png');
            }
            const material = new THREE.SpriteMaterial({ map: this.noPowerTexture, color: 0xffdd00 });
            icon = new THREE.Sprite(material);
            icon.name = "noPowerIcon";
            icon.scale.set(8, 8, 8);
            icon.position.y = building.geometry.parameters.height + 5;
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
