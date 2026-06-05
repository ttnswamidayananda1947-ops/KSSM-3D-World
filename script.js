let scene, camera, renderer;
let player, playerLight;
let gameActive = false;

let health = 100;
let coins = 0;
let score = 0;
const targetCoins = 10;
let activeEnemiesCount = 0;

let environmentObjects = [];
let coinEntities = [];
let enemyEntities = [];

const gravity = -0.006;
let playerVelocityY = 0;
let isJumping = false;
let attackActive = false;
let attackTimer = 0;
let damageCooldown = 0;

let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickCurrent = { x: 0, y: 0 };
let moveVector = new THREE.Vector2(0, 0);
let keyboardState = {};

let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'coin') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'jump') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'attack') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.2);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.22);
        } else if (type === 'damage') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, now);
            osc.frequency.linearRampToValueAtTime(30, now + 0.25);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);
            osc.start(now);
            osc.stop(now + 0.26);
        } else if (type === 'victory') {
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, index) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(freq, now + index * 0.1);
                g.gain.setValueAtTime(0.15, now + index * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.4);
                o.start(now + index * 0.1);
                o.stop(now + index * 0.1 + 0.4);
            });
        }
    } catch (e) {}
}

function init() {
    const container = document.getElementById('game-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05050f);
    scene.fog = new THREE.FogExp2(0x05050f, 0.045);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x111122, 0.6);
    scene.add(ambientLight);

    const moonlight = new THREE.DirectionalLight(0x334466, 0.5);
    moonlight.position.set(30, 50, 20);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.width = 1024;
    moonlight.shadow.mapSize.height = 1024;
    moonlight.shadow.camera.near = 0.5;
    moonlight.shadow.camera.far = 150;
    const d = 40;
    moonlight.shadow.camera.left = -d;
    moonlight.shadow.camera.right = d;
    moonlight.shadow.camera.top = d;
    moonlight.shadow.camera.bottom = -d;
    scene.add(moonlight);

    createWorld();
    createPlayerCharacter();
    setupInputListeners();
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function createWorld() {
    const groundGeo = new THREE.PlaneGeometry(160, 160, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111611, roughness: 0.9, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const boundaryGeo = new THREE.BoxGeometry(160, 4, 2);
    const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x0a0505 });
    
    for(let i=0; i<4; i++) {
        const b = new THREE.Mesh(boundaryGeo, boundaryMat);
        if(i===0) b.position.set(0, 1, -80);
        if(i===1) b.position.set(0, 1, 80);
        if(i===2) { b.position.set(-80, 1, 0); b.rotation.y = Math.PI/2; }
        if(i===3) { b.position.set(80, 1, 0); b.rotation.y = Math.PI/2; }
        scene.add(b);
    }

    generateScenery();
    generateTargetCollectibles();
    generateHostileEntities();
}

function generateScenery() {
    for (let i = 0; i < 45; i++) {
        const x = (Math.random() - 0.5) * 140;
        const z = (Math.random() - 0.5) * 140;
        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, 0, z);

        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 4, 5);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const foliageGeo = new THREE.ConeGeometry(1.5, 3, 4);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e221a, roughness: 0.8 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 4.5;
        foliage.castShadow = true;
        treeGroup.add(foliage);

        scene.add(treeGroup);
        environmentObjects.push(trunk);
    }

    for (let i = 0; i < 25; i++) {
        const x = (Math.random() - 0.5) * 130;
        const z = (Math.random() - 0.5) * 130;
        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

        const rScaleX = 1 + Math.random() * 2;
        const rScaleY = 1 + Math.random() * 3;
        const rScaleZ = 1 + Math.random() * 2;

        const rockGeo = new THREE.DodecahedronGeometry(1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.9 });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.scale.set(rScaleX, rScaleY, rScaleZ);
        rock.position.set(x, rScaleY / 2, z);
        rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
        rock.castShadow = true;
        rock.receiveShadow = true;

        scene.add(rock);
        environmentObjects.push(rock);
    }

    for (let i = 0; i < 5; i++) {
        const x = (i === 0) ? -25 : (i === 1) ? 25 : (i === 2) ? -35 : (i === 3) ? 35 : 0;
        const z = (i === 0) ? -25 : (i === 1) ? 25 : (i === 2) ? 35 : (i === 3) ? -35 : -50;

        const house = new THREE.Group();
        house.position.set(x, 0, z);

        const baseGeo = new THREE.BoxGeometry(6, 4, 6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x2b221f, roughness: 0.7 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 2;
        base.castShadow = true;
        base.receiveShadow = true;
        house.add(base);

        const roofGeo = new THREE.ConeGeometry(5.2, 3, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d1111, roughness: 0.6 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 5.5;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        house.add(roof);

        const doorGeo = new THREE.PlaneGeometry(1.2, 2.2);
        const doorMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.1, 3.01);
        house.add(door);

        scene.add(house);
        environmentObjects.push(base);
    }
}

function generateTargetCollectibles() {
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 120;
        const z = (Math.random() - 0.5) * 120;
        if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;

        const coinGeo = new THREE.TorusGeometry(0.4, 0.1, 8, 24);
        const coinMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffcc, 
            emissive: 0x00aa77,
            roughness: 0.2, 
            metalness: 1.0 
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.position.set(x, 0.8, z);
        coin.castShadow = true;
        coin.userData = { bobOffset: Math.random() * Math.PI * 2 };
        scene.add(coin);
        coinEntities.push(coin);
    }
}

function generateHostileEntities() {
    const count = 7;
    activeEnemiesCount = count;
    
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 110;
        const z = (Math.random() - 0.5) * 110;
        if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(x, 1.2, z);

        const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0055, 
            emissive: 0x330011,
            transparent: true,
            opacity: 0.85
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        ghostGroup.add(body);

        const tailGeo = new THREE.ConeGeometry(0.7, 1.4, 16, 1, true);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.y = -0.8;
        tail.rotation.x = Math.PI;
        ghostGroup.add(tail);

        const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.25, 0.1, 0.55);
        ghostGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.25, 0.1, 0.55);
        ghostGroup.add(rightEye);

        ghostGroup.userData = {
            startX: x,
            startZ: z,
            patrolRadius: 15 + Math.random() * 15,
            angle: Math.random() * Math.PI * 2,
            speed: 0.02 + Math.random() * 0.02,
            state: 'patrol',
            health: 1
        };

        scene.add(ghostGroup);
        enemyEntities.push(ghostGroup);
    }
}

function createPlayerCharacter() {
    player = new THREE.Group();
    player.position.set(0, 0.9, 0);

    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.3, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    player.add(body);

    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xddbb99, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.95;
    head.castShadow = true;
    player.add(head);

    const weaponGroup = new THREE.Group();
    weaponGroup.name = "weaponArm";
    weaponGroup.position.set(0.6, 0.2, 0.2);

    const bladeGeo = new THREE.BoxGeometry(0.1, 0.1, 1.1);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x004433, metalness: 0.8 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.z = 0.4;
    blade.castShadow = true;
    weaponGroup.add(blade);
    
    player.add(weaponGroup);

    playerLight = new THREE.PointLight(0xffeedd, 1.4, 18);
    playerLight.position.set(0, 1.2, 0.5);
    playerLight.castShadow = true;
    player.add(playerLight);

    scene.add(player);
}

function setupInputListeners() {
    window.addEventListener('keydown', (e) => {
        keyboardState[e.code] = true;
        handleKeyboardActionTrigger(e.code);
    });
    window.addEventListener('keyup', (e) => {
        keyboardState[e.code] = false;
    });

    const boundary = document.getElementById('joystick-boundary');
    const knob = document.getElementById('joystick-knob');

    boundary.addEventListener('touchstart', (e) => {
        initAudio();
        joystickActive = true;
        const touch = e.touches[0];
        const rect = boundary.getBoundingClientRect();
        joystickStart = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        
        let targetTouch = null;
        for(let i=0; i<e.touches.length; i++) {
            if(e.touches[i].clientX < window.innerWidth / 2) {
                targetTouch = e.touches[i];
                break;
            }
        }
        if(!targetTouch) return;

        joystickCurrent = { x: targetTouch.clientX, y: targetTouch.clientY };
        
        let deltaX = joystickCurrent.x - joystickStart.x;
        let deltaY = joystickCurrent.y - joystickStart.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        const maxRadius = boundary.clientWidth / 2;
        if (distance > maxRadius) {
            deltaX = (deltaX / distance) * maxRadius;
            deltaY = (deltaY / distance) * maxRadius;
        }

        knob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

        moveVector.x = deltaX / maxRadius;
        moveVector.y = -deltaY / maxRadius;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        let leftTouchActive = false;
        for(let i=0; i<e.touches.length; i++) {
            if(e.touches[i].clientX < window.innerWidth / 2) leftTouchActive = true;
        }
        
        if(!leftTouchActive) {
            joystickActive = false;
            moveVector.set(0, 0);
            knob.style.transform = 'translate(-50%, -50%)';
        }
    }, { passive: true });

    document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
        triggerPlayerJumpAction();
    });

    document.getElementById('btn-attack').addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
        triggerPlayerAttackAction();
    });

    document.getElementById('btn-start').addEventListener('click', () => {
        initAudio();
        resetGameMetrics();
        document.getElementById('overlay').className = 'overlay-hidden';
        gameActive = true;
    });
}

function handleKeyboardActionTrigger(code) {
    if (!gameActive) return;
    if (code === 'Space') triggerPlayerJumpAction();
    if (code === 'KeyF' || code === 'E') triggerPlayerAttackAction();
}

function triggerPlayerJumpAction() {
    if (!isJumping && gameActive) {
        isJumping = true;
        playerVelocityY = 0.14;
        playSound('jump');
    }
}

function triggerPlayerAttackAction() {
    if (!attackActive && gameActive) {
        attackActive = true;
        attackTimer = 0;
        playSound('attack');
        executeHitRegistrationScan();
    }
}

function executeHitRegistrationScan() {
    const attackRange = 2.8;
    for (let i = enemyEntities.length - 1; i >= 0; i--) {
        const enemy = enemyEntities[i];
        const dist = player.position.distanceTo(enemy.position);
        
        if (dist <= attackRange) {
            scene.remove(enemy);
            enemyEntities.splice(i, 1);
            score += 150;
            activeEnemiesCount--;
            playSound('coin');
            updateHUDDisplay();
            evaluateMissionProgressionStatus();
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        processCoreMovementCalculations();
        processPhysicsGravityCalculations();
        processHostileEntitiesBehavior();
        processEntityAnimationSweeps();
        processCollisionScanningLoops();
        processCameraTrackingVectors();
    }

    renderer.render(scene, camera);
}

function processCoreMovementCalculations() {
    let inputX = moveVector.x;
    let inputY = moveVector.y;

    if (keyboardState['KeyW'] || keyboardState['ArrowUp']) inputY = 1.0;
    if (keyboardState['KeyS'] || keyboardState['ArrowDown']) inputY = -1.0;
    if (keyboardState['KeyA'] || keyboardState['ArrowLeft']) inputX = -1.0;
    if (keyboardState['KeyD'] || keyboardState['ArrowRight']) inputX = 1.0;

    if (Math.abs(inputX) > 0.05 || Math.abs(inputY) > 0.05) {
        const speedMultiplier = 0.095;
        const targetAngle = Math.atan2(inputX, inputY);
        player.rotation.y = targetAngle;

        const nextX = player.position.x + Math.sin(targetAngle) * speedMultiplier;
        const nextZ = player.position.z + Math.cos(targetAngle) * speedMultiplier;

        if (Math.abs(nextX) < 78) player.position.x = nextX;
        if (Math.abs(nextZ) < 78) player.position.z = nextZ;
    }
}

function processPhysicsGravityCalculations() {
    if (isJumping) {
        playerVelocityY += gravity;
        player.position.y += playerVelocityY;

        if (player.position.y <= 0.9) {
            player.position.y = 0.9;
            isJumping = false;
            playerVelocityY = 0;
        }
    }
}

function processHostileEntitiesBehavior() {
    if(damageCooldown > 0) damageCooldown--;

    enemyEntities.forEach((enemy) => {
        const ud = enemy.userData;
        const distToPlayer = enemy.position.distanceTo(player.position);
        
        if (distToPlayer < 12.0) {
            ud.state = 'chase';
        } else {
            ud.state = 'patrol';
        }

        if (ud.state === 'chase') {
            const angle = Math.atan2(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
            enemy.rotation.y = angle;
            enemy.position.x += Math.sin(angle) * (ud.speed * 1.35);
            enemy.position.z += Math.cos(angle) * (ud.speed * 1.35);
        } else {
            ud.angle += ud.speed * 0.5;
            const targetX = ud.startX + Math.sin(ud.angle) * ud.patrolRadius;
            const targetZ = ud.startZ + Math.cos(ud.angle) * ud.patrolRadius;
            const faceAngle = Math.atan2(targetX - enemy.position.x, targetZ - enemy.position.z);
            enemy.rotation.y = faceAngle;
            enemy.position.x = targetX;
            enemy.position.z = targetZ;
        }

        enemy.position.y = 1.1 + Math.sin(Date.now() * 0.003 + ud.startX) * 0.25;
    });
}

function processEntityAnimationSweeps() {
    coinEntities.forEach((coin) => {
        coin.rotation.z += 0.02;
        coin.rotation.y += 0.01;
        coin.position.y = 0.8 + Math.sin(Date.now() * 0.002 + coin.userData.bobOffset) * 0.15;
    });

    if (attackActive) {
        attackTimer += 0.08;
        const arm = player.getObjectByName("weaponArm");
        if (arm) arm.rotation.y = Math.sin(attackTimer * Math.PI) * 1.4;
        if (attackTimer >= 1.0) {
            attackActive = false;
            if (arm) arm.rotation.y = 0;
        }
    }
}

function processCollisionScanningLoops() {
    const pPos = player.position;

    for (let i = coinEntities.length - 1; i >= 0; i--) {
        const coin = coinEntities[i];
        if (pPos.distanceTo(coin.position) < 1.3) {
            scene.remove(coin);
            coinEntities.splice(i, 1);
            coins++;
            score += 100;
            playSound('coin');
            updateHUDDisplay();
            evaluateMissionProgressionStatus();
        }
    }

    for (let i = 0; i < enemyEntities.length; i++) {
        const enemy = enemyEntities[i];
        if (pPos.distanceTo(enemy.position) < 1.2) {
            if (damageCooldown === 0) {
                health -= 20;
                damageCooldown = 45;
                playSound('damage');
                updateHUDDisplay();
                if (health <= 0) triggerGameOverSequence(false);
            }
        }
    }
}

function processCameraTrackingVectors() {
    const relativeCameraOffset = new THREE.Vector3(0, 5.5, -9.5);
    const cameraOffset = relativeCameraOffset.applyMatrix4(player.matrixWorld);

    camera.position.x += (cameraOffset.x - camera.position.x) * 0.08;
    camera.position.y += (cameraOffset.y - camera.position.y) * 0.08;
    camera.position.z += (cameraOffset.z - camera.position.z) * 0.08;

    const lookTarget = new THREE.Vector3(player.position.x, player.position.y + 0.5, player.position.z);
    camera.lookAt(lookTarget);
}

function evaluateMissionProgressionStatus() {
    if (coins >= targetCoins && activeEnemiesCount <= 0) {
        triggerGameOverSequence(true);
    } else if (coins >= targetCoins) {
        document.getElementById('mission-status').innerText = "லட்சியம்: அனைத்துப் பேய்களையும் அழித்து வெற்றியைப் பெறுங்கள்!";
        document.getElementById('mission-status').className = "mission-urgent";
    }
}

function updateHUDDisplay() {
    document.getElementById('health-bar').style.width = `${Math.max(0, health)}%`;
    document.getElementById('coin-count').innerText = coins;
    document.getElementById('score-value').innerText = score;
}

function triggerGameOverSequence(isVictory) {
    gameActive = false;
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    const subtitle = document.getElementById('overlay-subtitle');
    const startBtn = document.getElementById('btn-start');
    
    document.getElementById('final-coins').innerText = coins;
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-stats').classList.remove('hidden');

    if (isVictory) {
        title.innerText = "வெற்றி பெற்றீர்கள்!";
        title.style.color = "#00ffcc";
        subtitle.innerText = "இருளை வென்று சாதனை படைத்துவிட்டீர்கள்!";
        startBtn.innerText = "மீண்டும் விளையாடு (PLAY AGAIN)";
        playSound('victory');
    } else {
        title.innerText = "விளையாட்டு முடிந்தது";
        title.style.color = "#ff3333";
        subtitle.innerText = "பேய்கள் உங்களை ஆட்கொண்டுவிட்டன...";
        startBtn.innerText = "மறுபடி முயற்சி செய் (RESTART)";
    }
    overlay.className = 'overlay-visible';
}

function resetGameMetrics() {
    health = 100;
    coins = 0;
    score = 0;
    isJumping = false;
    attackActive = false;
    playerVelocityY = 0;
    damageCooldown = 0;
    moveVector.set(0, 0);

    updateHUDDisplay();
    document.getElementById('mission-status').innerText = "லட்சியம்: 10 ஆன்மாக்களைச் சேகரித்து பேய்களை அழிக்கவும்!";
    
    if (player) {
        player.position.set(0, 0.9, 0);
        player.rotation.set(0, 0, 0);
    }

    coinEntities.forEach(c => scene.remove(c));
    enemyEntities.forEach(e => scene.remove(e));
    coinEntities = [];
    enemyEntities = [];

    generateTargetCollectibles();
    generateHostileEntities();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
