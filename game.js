/**
 * Siren Head: The Train Escape - Game Logic
 * Name: game.js
 * Description: Full 3D game logic using Three.js via CDN. Includes First-Person PointerLock controls,
 * night forest environment creation, a train, procedural Siren Head AI, flashlight, and task tracking.
 */

// --- உலகளாவிய மாறிகள் (Global Variables) ---
let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// கேம் பொருள்கள் (Game Objects)
let flashlight;
let trees = [];
let train;
let sirenHead;
let fuelCans = [];

// கேம் நிலைகள் (Game States)
let gameStarted = false;
let tasksCompleted = 0;
const totalTasks = 3;
let sirenHeadSpeed = 0.25;
let isGameOver = false;

// HTML கூறுகள் (HTML Elements)
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const canvas = document.getElementById('gameCanvas');

// --- கேமைத் தொடங்குதல் (Initialization) ---
function init() {
    // 1. சீன் (Scene) உருவாக்கம் - இருட்டான காடு என்பதால் கருப்பு நிறம்
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010103);
    scene.fog = new THREE.FogExp2(0x010103, 0.035); // அடர்ந்த பனிமூட்டம் (Fog)

    // 2. கேமரா (Camera) அமைப்பு - First Person View
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 2; // மனிதனின் கண் உயரத்திற்கு ஏற்ப (Height of 2 units)

    // 3. ரெண்டரர் (Renderer) அமைப்பு
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. பாயிண்டர் லாக் கண்ட்ரோல்ஸ் (First Person Controls)
    controls = new THREE.PointerLockControls(camera, document.body);

    // லாக் செய்யும்போது UI-ஐ கையாளுதல்
    blocker.addEventListener('click', function () {
        if (!isGameOver) {
            controls.lock();
        }
    });

    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        gameStarted = true;
    });

    controls.addEventListener('unlock', function () {
        if (!isGameOver) {
            blocker.style.display = 'flex';
            instructions.style.display = '';
        }
    });

    scene.add(controls.getObject());

    // 5. கீபோர்டு ஈவென்ட்டுகள் (Keyboard Listeners)
    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // 6. விளக்குகள் (Lighting) & பிளேயரின் பிளாஷ்லைட் (Flashlight)
    const ambientLight = new THREE.AmbientLight(0x0a0a1a); // மிக மங்கலான நிலா வெளிச்சம்
    scene.add(ambientLight);

    // பிளாஷ்லைட் (SpotLight) - பிளேயரின் கேமராவுடன் நகரும்
    flashlight = new THREE.SpotLight(0xfff5d7, 2.5, 40, Math.PI / 5, 0.5, 1);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    camera.add(flashlight);
    flashlight.position.set(0, 0, 0);
    // விளக்கு முன்னோக்கி அடிக்க target அமைத்தல்
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -1);
    camera.add(flashlightTarget);
    flashlight.target = flashlightTarget;

    // 7. உலகத்தை உருவாக்குதல் (Environment Setup)
    createEnvironment();

    // 8. சாளரம் மாறும் போது சரி செய்தல் (Window Resize)
    window.addEventListener('resize', onWindowResize);
    
    // அனிமேஷன் லூப்பைத் தொடங்குதல்
    animate();
}

// --- சுற்றுச்சூழல் உருவாக்கம் (Create Environment) ---
function createEnvironment() {
    // தரை தளம் (Ground)
    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a140a, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ரயில் தடம் மற்றும் ரயில் பெட்டி (Procedural Train)
    const trainGroup = new THREE.Group();
    
    // ரயில் உடல் (Body)
    const bodyGeo = new THREE.BoxGeometry(4, 5, 25);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x441111, metalness: 0.7, roughness: 0.4 });
    train = new THREE.Mesh(bodyGeo, bodyMat);
    train.position.set(0, 2.5, 0);
    train.castShadow = true;
    train.receiveShadow = true;
    trainGroup.add(train);

    // ரயில் உட்பகுதி விளக்கு (Interior dim light)
    const interiorLight = new THREE.PointLight(0xff5500, 0.8, 15);
    interiorLight.position.set(0, 3, 0);
    trainGroup.add(interiorLight);

    trainGroup.position.set(0, 0, -10); // பிளேயருக்கு முன்னால் ரயில் இருக்கும்
    scene.add(trainGroup);

    // காடு - மரங்களை உருவாக்குதல் (Procedural Trees)
    const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 8, 5);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x221408, roughness: 0.9 });
    const treeLeavesGeo = new THREE.ConeGeometry(2, 5, 5);
    const treeLeavesMat = new THREE.MeshStandardMaterial({ color: 0x051a05, roughness: 0.8 });

    for (let i = 0; i < 150; i++) {
        const treeGroup = new THREE.Group();
        
        const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
        trunk.position.y = 4;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const leaves = new THREE.Mesh(treeLeavesGeo, treeLeavesMat);
        leaves.position.y = 8;
        leaves.castShadow = true;
        treeGroup.add(leaves);

        // மரங்களை ரயிலைச் சுற்றி எதேச்சையாக (Random) பரப்புதல்
        let x = (Math.random() - 0.5) * 200;
        let z = (Math.random() - 0.5) * 200;

        // மரங்கள் ரயிலுக்குள் வராமல் தடுக்க
        if (Math.abs(x) < 8 && Math.abs(z) < 30) {
            x += 15;
        }

        treeGroup.position.set(x, 0, z);
        scene.add(treeGroup);
        trees.push(treeGroup);
    }

    // சைரன் ஹெட் உருவாக்கம் (Procedural 3D Siren Head Placeholder)
    // குறிப்பு: உங்களிடம் .gltf மாடல் இருந்தால் GLTFLoader மூலம் மாற்றிக் கொள்ளலாம்.
    createSirenHead();

    // டாஸ்க் - எரிபொருள் கேன்கள் (Task: Fuel Cans)
    createTasks();
}

// --- சைரன் ஹெட் உருவம் (Procedural Siren Head) ---
function createSirenHead() {
    sirenHead = new THREE.Group();

    // மிக நீளமான மெலிந்த உடம்பு (Torso)
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.1, 10, 4);
    const material = new THREE.MeshStandardMaterial({ color: 0x1f110b, roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 5;
    body.castShadow = true;
    sirenHead.add(body);

    // நீளமான கைகள் மற்றும் கால்கள் (Placeholder limbs)
    const limbGeo = new THREE.CylinderGeometry(0.08, 0.08, 6, 4);
    
    const leftArm = new THREE.Mesh(limbGeo, material);
    leftArm.position.set(-1, 7, 0);
    leftArm.rotation.z = Math.PI / 12;
    sirenHead.add(leftArm);

    const rightArm = new THREE.Mesh(limbGeo, material);
    rightArm.position.set(1, 7, 0);
    rightArm.rotation.z = -Math.PI / 12;
    sirenHead.add(rightArm);

    // தலைப்பகுதியில் உள்ள இரண்டு சைரன்கள் (Sirens)
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 4);
    const pole = new THREE.Mesh(poleGeo, material);
    pole.position.y = 10.5;
    sirenHead.add(pole);

    const sirenGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
    const sirenMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.8 });
    
    const leftSiren = new THREE.Mesh(sirenGeo, sirenMat);
    leftSiren.position.set(-0.5, 11, 0);
    leftSiren.rotation.z = Math.PI / 3;
    sirenHead.add(leftSiren);

    const rightSiren = new THREE.Mesh(sirenGeo, sirenMat);
    rightSiren.position.set(0.5, 11, 0);
    rightSiren.rotation.z = -Math.PI / 3;
    sirenHead.add(rightSiren);

    // ஆரம்ப இடம் (ரயிலில் இருந்து 60 யூனிட் தள்ளி மரங்களுக்குள் இருக்கும்)
    sirenHead.position.set(35, 0, -50);
    scene.add(sirenHead);
}

// --- டாஸ்க்குகள் அமைத்தல் (Create Fuel Cans for Escape) ---
function createTasks() {
    const canGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
    const canMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.5 }); // பிரகாசமான மஞ்சள் கேன்

    for (let i = 0; i < totalTasks; i++) {
        const can = new THREE.Mesh(canGeo, canMat);
        can.castShadow = true;
        
        // வெவ்வேறு இடங்களில் கேன்களை ஒளித்து வைத்தல்
        let x = (Math.random() - 0.5) * 80;
        let z = (Math.random() - 0.5) * 80;
        
        // ரயிலுக்கு மிக அருகில் வராமல் தள்ளி வைக்க
        if(Math.abs(x) < 10) x += 20;

        can.position.set(x, 0.4, z);
        scene.add(can);
        fuelCans.push(can);
    }
}

// --- விண்டோ ரீசைஸ் (Handle Resize) ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- கேம் ஓவர் ஸ்கிரீன் (Game Over UI) ---
function triggerGameOver(success) {
    isGameOver = true;
    controls.unlock();
    blocker.style.display = 'flex';
    
    if (success) {
        instructions.innerHTML = `
            <h1 style="color: #00ff00; font-size: 35px;">YOU ESCAPED!</h1>
            <p style="font-size: 20px; color: #fff;">நீங்கள் ரயிலை இயக்கி சைரன் ஹெட்டிடம் இருந்து தப்பித்து விட்டீர்கள்!</p>
            <p style="font-size: 16px; margin-top:15px; color: #aaa;">மீண்டும் விளையாட பக்கத்தை Refresh செய்யவும்.</p>
        `;
    } else {
        instructions.innerHTML = `
            <h1 style="color: #ff0000; font-size: 45px; text-shadow: 0 0 20px #ff0000;">DIED</h1>
            <p style="font-size: 20px; color: #fff;">சைரன் ஹெட் உங்களை பிடித்துவிட்டது!</p>
            <p style="font-size: 16px; margin-top:15px; color: #aaa;">மீண்டும் முயற்சிக்க பக்கத்தை Refresh செய்யவும்.</p>
        `;
    }
}

// --- முதன்மை கேம் லூப் (Main Animation Loop - 60 FPS) ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !isGameOver) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // 1. பிளேயர் நகர்வு (Player Movement Calculation)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // வேகம் அமைத்தல்
        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // பிளேயர் எல்லையை தாண்டி வெளியே போகாமல் தடுக்க (Map Bounds)
        const playerPos = controls.getObject().position;
        if (Math.abs(playerPos.x) > 140) playerPos.x = Math.sign(playerPos.x) * 140;
        if (Math.abs(playerPos.z) > 140) playerPos.z = Math.sign(playerPos.z) * 140;

        // 2. டாஸ்க் கண்டறிதல் (Task / Collision Detection with Fuel Cans)
        for (let i = fuelCans.length - 1; i >= 0; i--) {
            const can = fuelCans[i];
            const dist = playerPos.distanceTo(can.position);

            // பிளேயர் கேனின் அருகில் சென்றால் அது சேகரிக்கப்படும்
            if (dist < 2.0) {
                scene.remove(can);
                fuelCans.splice(i, 1);
                tasksCompleted++;
                
                // சைரன் ஹெட் வேகம் அதிகரிக்கும் (கோபம் அடைகிறது)
                sirenHeadSpeed += 0.15; 
                
                console.log("Tasks: " + tasksCompleted + " / " + totalTasks);
            }
        }

        // அனைத்து டாஸ்க்கும் முடிந்து பிளேயர் ரயிலை அடைந்தால் வெற்றி
        if (tasksCompleted === totalTasks) {
            const distToTrain = playerPos.distanceTo(train.position);
            if (distToTrain < 4.0) {
                triggerGameOver(true); // வெற்றி!
            }
        }

        // 3. சைரன் ஹெட் AI மூவ்மென்ட் (Siren Head AI Chasing)
        if (sirenHead) {
            const shPos = sirenHead.position;
            
            // பிளேயரை நோக்கி நகரும் திசையைக் கணக்கிடுதல்
            const targetDir = new THREE.Vector3().subVectors(playerPos, shPos);
            targetDir.y = 0; // பறக்கக் கூடாது, தரையில் நடக்க வேண்டும்
            targetDir.normalize();

            // பிளேயரை நோக்கி மெதுவாக நகரும்
            shPos.addScaledVector(targetDir, sirenHeadSpeed * 10 * delta);
            
            // பிளேயரை எப்போதும் நோக்கியவாறு திரும்பும்
            sirenHead.lookAt(playerPos.x, shPos.y, playerPos.z);

            // சைரன் ஹெட் பிளேயரை பிடித்துவிட்டால் (Jumpscare / Game Over)
            const distToPlayer = playerPos.distanceTo(shPos);
            if (distToPlayer < 3.5) {
                triggerGameOver(false); // தோல்வி!
            }
        }

        prevTime = time;
    }

    // 3D காட்சியைத் திரையில் காட்டுதல்
    renderer.render(scene, camera);
}

// கேமைத் தொடங்க அழைப்பு
window.onload = init;
