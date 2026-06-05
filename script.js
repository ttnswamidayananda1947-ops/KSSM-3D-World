import * as THREE from "three";

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth/window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias:true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(renderer.domElement);

setTimeout(()=>{
    document.getElementById("loading").style.display="none";
},1500);

/* LIGHT */

const light = new THREE.DirectionalLight(
    0xffffff,
    3
);

light.position.set(20,30,20);

scene.add(light);

const ambient = new THREE.AmbientLight(
    0xffffff,
    1
);

scene.add(ambient);

/* GROUND */

const groundGeometry =
new THREE.PlaneGeometry(200,200);

const groundMaterial =
new THREE.MeshStandardMaterial({
    color:0x22aa22
});

const ground =
new THREE.Mesh(
    groundGeometry,
    groundMaterial
);

ground.rotation.x = -Math.PI/2;

scene.add(ground);

/* PLAYER */

const playerGeometry =
new THREE.BoxGeometry(2,2,2);

const playerMaterial =
new THREE.MeshStandardMaterial({
    color:0x0000ff
});

const player =
new THREE.Mesh(
    playerGeometry,
    playerMaterial
);

player.position.y = 1;

scene.add(player);

/* TREES */

for(let i=0;i<100;i++){

    const trunk =
    new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.3,
            0.3,
            3
        ),
        new THREE.MeshStandardMaterial({
            color:0x8B4513
        })
    );

    trunk.position.set(
        Math.random()*180-90,
        1.5,
        Math.random()*180-90
    );

    scene.add(trunk);

    const leaves =
    new THREE.Mesh(
        new THREE.SphereGeometry(
            1.5,
            16,
            16
        ),
        new THREE.MeshStandardMaterial({
            color:0x00aa00
        })
    );

    leaves.position.set(
        trunk.position.x,
        4,
        trunk.position.z
    );

    scene.add(leaves);
}

/* CONTROLS */

const keys = {};

window.addEventListener("keydown",(e)=>{
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup",(e)=>{
    keys[e.key.toLowerCase()] = false;
});

/* CAMERA */

camera.position.set(
    0,
    8,
    10
);

function updatePlayer(){

    const speed = 0.15;

    if(keys["w"]){
        player.position.z -= speed;
    }

    if(keys["s"]){
        player.position.z += speed;
    }

    if(keys["a"]){
        player.position.x -= speed;
    }

    if(keys["d"]){
        player.position.x += speed;
    }

    camera.position.x =
        player.position.x;

    camera.position.z =
        player.position.z + 10;

    camera.lookAt(
        player.position
    );
}

/* ANIMATION */

function animate(){

    requestAnimationFrame(
        animate
    );

    updatePlayer();

    renderer.render(
        scene,
        camera
    );
}

animate();

/* RESIZE */

window.addEventListener(
"resize",
()=>{

camera.aspect =
window.innerWidth/
window.innerHeight;

camera.updateProjectionMatrix();

renderer.setSize(
window.innerWidth,
window.innerHeight
);

});
