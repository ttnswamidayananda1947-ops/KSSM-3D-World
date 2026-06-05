/**
 * Siren Head: Mobile Version with Touch Joystick, Shoot Button and Flashlight Toggle.
 * Name: game.js
 */

let scene, camera, renderer;
let moveForward = 0, moveBackward = 0, moveLeft = 0, moveRight = 0;
let prevTime = performance.now();
const velocity = new THREE.Vector3();

// UI and Game States
let gameStarted = false;
let isGameOver = false;
let isFlashlightOn = true;
let flashlight;
let sirenHead;
let train;

// Mobile Rotation State
let touchStartX = 0, touchStartY = 0;
const lon = 0, lat = 0;
const phi = 0, theta = 0;
const cameraTarget = new THREE.Vector3(0, 0, -1);
let targetRotationX = 0;
let targetRotationY = 0;

// HTML Elements
const blocker = document.getElementById('blocker');
const mobileUI = document.getElementById('mobile-ui');
const flashlightBtn = document.getElementById('flashlight-btn');

function init() {
    // Scene & Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010103);
    scene.fog = new THREE.FogExp2(0x010103, 0.04);

    // Camera Look setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Fullscreen and Lock Trigger (வெள்ளை கோடை நீக்க உதவும் பகுதி)
    blocker.addEventListener('pointerdown', function () {
        if (!gameStarted) {
            // Request Fullscreen to hide Android status/navigation bar
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen(); // Safari/Chrome Mobile
            }
            
            blocker.style.display = 'none';
            mobileUI.style.display = 'block';
            flashlightBtn.style.display = 'flex';
            gameStarted = true;
        }
    });

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0x050510);
    scene.add(ambientLight);

    // Flashlight (SpotLight) Setup
    flashlight = new THREE.SpotLight(0xfff5d7, 3, 35, Math.PI / 6, 0.5, 1);
    camera.add(flashlight);
    flashlight.position.set(0, 0, 0);
    const targetObject = new THREE.Object3D();
    targetObject.position.set(0, 0, -1);
    camera.add(targetObject);
    flashlight.target = targetObject;
    scene.add(camera);

    // Setup All Controls
    setupJoystick();
    setupRightSideLook();
    setupFlashlightToggle();
    setupShootButton();

    // Create World Assets
    createWorld();

    window.addEventListener('resize', onWindowResize);
    animate();
}

// --- 1. Flashlight Button Toggle Logic ---
function setupFlashlightToggle() {
    flashlightBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // Prevent camera movement
        isFlashlightOn = !isFlashlightOn;
        flashlight.visible = isFlashlightOn;
        flashlightBtn.querySelector('.text').innerText = isFlashlightOn ? "FLASHLIGHT: ON" : "FLASHLIGHT: OFF";
    });
}

// --- 2. Left Side Joystick Movement Logic ---
function setupJoystick() {
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const maxRadius = 35; // Maximum stick movement distance

    base.addEventListener('pointerdown', (e) => {
        base.setPointerCapture(e.pointerId);
        updateJoystick(e);
    });

    base.addEventListener('pointermove', (e) => {
        if (base.hasPointerCapture(e.pointerId)) {
            updateJoystick(e);
        }
    });

    base.addEventListener('pointerup', (e) => {
        base.releasePointerCapture(e.pointerId);
        stick.style.transform = `translate(0px, 0px)`;
        // Reset Movements
        moveForward = 0;
        moveBackward = 0;
        moveLeft = 0;
        moveRight = 0;
    });

    function updateJoystick(e) {
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let deltaX = e.clientX - centerX;
        let deltaY = e.clientY - centerY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > maxRadius) {
            deltaX = (deltaX / distance) * maxRadius;
            deltaY = (deltaY / distance) * maxRadius;
        }
        
        stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        // Convert Joystick values to W, A, S, D intensity (0 to 1)
        const normX = deltaX / maxRadius;
        const normY = deltaY / maxRadius;

        moveForward = normY < -0.2 ? -normY : 0;
        moveBackward = normY > 0.2 ? normY : 0;
        moveLeft = normX < -0.2 ? -normX : 0;
        moveRight = normX > 0.2 ? normX : 0;
    }
}

// --- 3. Right Side Look Around Logic (Swipe Screen to Turn Camera) ---
function setupRightSideLook() {
    window.addEventListener('pointerdown', (e) => {
        // Only trigger look around on the right 60% of the screen
        if (e.clientX > window.innerWidth * 0.4 && gameStarted && !isGameOver) {
            touchStartX = e.clientX;
            touchStartY = e.clientY;
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (e.clientX > window.innerWidth * 0.4 && gameStarted && !isGameOver && e.buttons > 0) {
            const deltaX = e.clientX - touchStartX;
            const deltaY = e.clientY - touchStartY;

            targetRotationY -= deltaX * 0.005;
            targetRotationX -= deltaY * 0.005;
            
            // Lock look up and down look limits
            targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

            touchStartX = e.clientX;
            touchStartY = e.clientY;
        }
    });
}

// --- 4. Right Side Shoot Button ---
function setupShootButton() {
    const shootBtn = document.getElementById('shoot-btn');
    shootBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        // Shoot trigger logic can go here (Flash effect or bullet trace)
        console.log("Player Shot!");
    });
}

// --- 5. Environment & Model Loader ---
function createWorld() {
    // Ground
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x050d05, roughness: 1.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // GLTF Model Loader (உங்களுடைய டவுன்லோட் பைல்களை இங்குதான் லோடு செய்யும்)
    const loader = new THREE.GLTFLoader();

    // Load Siren Head Model
    loader.load('assets/models/siren_head.glb', (gltf) => {
        sirenHead = gltf.scene;
        sirenHead.position.set(0, 0, -40);
        sirenHead.scale.set(1, 1, 1); // Adjust scale based on downloaded size
        scene.add(sirenHead);
    }, undefined, (error) => {
        // If file not found yet, create temporary cylinder shape
        console.warn("Siren Head model file not found in assets/models/. Creating box shape.");
        sirenHead = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10), new THREE.MeshStandardMaterial({color: 0x111}));
        sirenHead.position.set(0, 5, -40);
        scene.add(sirenHead);
    });

    // Load Train Model
    loader.load('assets/models/train.glb', (gltf) => {
        train = gltf.scene;
        train.position.set(0, 0, -10);
        scene.add(train);
    }, undefined, (error) => {
        console.warn("Train model file not found. Creating box shape.");
        train = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 20), new THREE.MeshStandardMaterial({color: 0x331111}));
        train.position.set(0, 2.5, -10);
        scene.add(train);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- 6. Main Render/Game Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !isGameOver) {
        const time = performance.now();
        const delta = (time - prevTime) / 1000;

        // Apply smooth camera rotation
        camera.rotation.order = 'YXZ';
        camera.rotation.y = targetRotationY;
        camera.rotation.x = targetRotationX;

        // Calculate Mobile Movement Vectors
        const speed = 8.0;
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forwardVector.y = 0; // lock to floor
        forwardVector.normalize();

        const sideVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        sideVector.y = 0;
        sideVector.normalize();

        // Move player based on joystick values
        if (moveForward > 0) camera.position.addScaledVector(forwardVector, speed * moveForward * delta);
        if (moveBackward > 0) camera.position.addScaledVector(forwardVector, -speed * moveBackward * delta);
        if (moveLeft > 0) camera.position.addScaledVector(sideVector, -speed * moveLeft * delta);
        if (moveRight > 0) camera.position.addScaledVector(sideVector, speed * moveRight * delta);

        // Simple Siren Head chase AI
        if (sirenHead) {
            const shPos = sirenHead.position;
            const targetDir = new THREE.Vector3().subVectors(camera.position, shPos);
            targetDir.y = 0;
            targetDir.normalize();
            shPos.addScaledVector(targetDir, 2.0 * delta); // Siren head movement speed
            sirenHead.lookAt(camera.position.x, shPos.y, camera.position.z);
        }

        prevTime = time;
    }

    renderer.render(scene, camera);
}

window.onload = init;
