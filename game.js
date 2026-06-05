import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Basic Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205); // Very dark night sky
scene.fog = new THREE.FogExp2(0x020205, 0.03); // Dense horror fog

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5); // Starting position (Porch of the cabin)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows
document.body.appendChild(renderer.domElement);

// 2. Lighting (Horror Ambient + High Brightness Flashlight)
const ambientLight = new THREE.AmbientLight(0x111122, 0.2); // Dim moonlight
scene.add(ambientLight);

// Flashlight (Torch) attached to Camera - INCREASED BRIGHTNESS & CLARITY
const flashLight = new THREE.SpotLight(0xffffff, 15, 150, Math.PI / 5, 0.2, 1);
flashLight.castShadow = true;
flashLight.position.set(0, 0, 0);
flashLight.target.position.set(0, 0, -1);
camera.add(flashLight);
camera.add(flashLight.target);
scene.add(camera);

// 3. Controls (First Person)
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    instructions.style.display = 'block';
});

// 4. Ground
const planeGeometry = new THREE.PlaneGeometry(500, 500);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 1 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// 5. Load 3D Models
const loader = new GLTFLoader();

// A. Load Cabin (Starting point)
loader.load('assets/models/cabin.glb', (gltf) => {
    const cabin = gltf.scene;
    cabin.position.set(0, 0, 0);
    cabin.scale.set(1.5, 1.5, 1.5); // Adjust scale if needed
    cabin.traverse((child) => { if (child.isMesh) child.receiveShadow = true; });
    scene.add(cabin);
});

// B. Load Radio Tower (Destination)
loader.load('assets/models/tower.glb', (gltf) => {
    const tower = gltf.scene;
    tower.position.set(80, 0, -120); // Far away in the forest
    tower.scale.set(2, 2, 2);
    scene.add(tower);
});

// C. Load Siren Head (The Monster)
loader.load('assets/models/siren_head.glb', (gltf) => {
    const sirenHead = gltf.scene;
    sirenHead.position.set(40, 0, -60); // Lurking in the woods
    sirenHead.scale.set(0.5, 0.5, 0.5); // Adjust based on model size
    sirenHead.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    scene.add(sirenHead);
});

// D. Load Tree and Clone 300 times
loader.load('assets/models/tree.glb', (gltf) => {
    const originalTree = gltf.scene;
    originalTree.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    for (let i = 0; i < 300; i++) {
        const clonedTree = originalTree.clone();
        let x = (Math.random() - 0.5) * 300;
        let z = (Math.random() - 0.5) * 300;
        
        // Prevent trees from blocking the cabin spawn area
        if (Math.abs(x) < 15 && Math.abs(z) < 15) {
            x += 20; 
        }

        clonedTree.position.set(x, 0, z);
        const randomScale = 0.8 + Math.random() * 0.7;
        clonedTree.scale.set(randomScale, randomScale, randomScale);
        clonedTree.rotation.y = Math.random() * Math.PI;
        scene.add(clonedTree);
    }
});

// 6. Movement Logic
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
});

// 7. Game Loop
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); 

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

animate();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
