import * as THREE from 'https://esm.sh/three@0.150.1';
import { GLTFLoader } from 'https://esm.sh/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.150.1/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ball, cursor, ballVelocity = new THREE.Vector3();
let playerModel, goalieModel;
let playerMixer, goalieMixer;
let kickAnim, goalieIdleAnim, goalieLeftAnim, goalieRightAnim, celebrateAnim;
let state = 'aim';
let cursorX = 0;
let hasCelebrated = false;

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb3e0ff);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4, 75);
  camera.lookAt(0, 1.5, 60);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1.5, 60);
  controls.update();

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(ambient, dirLight);

  // === Terrain 3D (remplace le sol simple) ===
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('models/football_field.glb', gltf => {
    const field = gltf.scene;
    field.position.set(0, -0.01, 0); // terrain reste centré
    field.rotation.y = Math.PI;
    field.scale.set(1, 1, 1);
    field.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    scene.add(field);
  });

  // === But ===
  const goal = new THREE.Mesh(
    new THREE.BoxGeometry(7, 3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  goal.position.set(0, 1.5, 60);
  scene.add(goal);

  // === Balle ===
  const ballTex = textureLoader.load('textures/ballon.png');
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 32, 32),
    new THREE.MeshStandardMaterial({ map: ballTex })
  );
  ball.position.set(0, 0.2, 65);
  ball.castShadow = true;
  scene.add(ball);

  // === Curseur ===
  cursor = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.4, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
  );
  cursor.position.set(0, 1.5, 60);
  cursor.rotation.x = -Math.PI / 2;
  scene.add(cursor);

  const loader = new GLTFLoader();
  loader.load('models/Soccer Penalty Kick.glb', gltf => {
    playerModel = gltf.scene;
    playerModel.position.set(0, 0, 67);
    playerModel.rotation.y = Math.PI;
    playerModel.traverse(o => o.castShadow = true);
    scene.add(playerModel);
    playerMixer = new THREE.AnimationMixer(playerModel);
    kickAnim = playerMixer.clipAction(gltf.animations[0]);
    celebrateAnim = playerMixer.clipAction(gltf.animations[1] || gltf.animations[0]);
    celebrateAnim.setLoop(THREE.LoopOnce);
    celebrateAnim.clampWhenFinished = true;
  });

  loader.load('models/Goalkeeper Idle.glb', gltf => {
    goalieModel = gltf.scene;
    goalieModel.position.set(0, 0, 60);
    goalieModel.traverse(o => o.castShadow = true);
    scene.add(goalieModel);
    goalieMixer = new THREE.AnimationMixer(goalieModel);
    goalieIdleAnim = goalieMixer.clipAction(gltf.animations[0]);
    goalieIdleAnim.play();
  });

  loader.load('models/Goalkeeper Diving Save Left.glb', gltf => {
    goalieLeftAnim = gltf.animations[0];
  });
  loader.load('models/Goalkeeper Diving Save Right.glb', gltf => {
    goalieRightAnim = gltf.animations[0];
  });

  window.addEventListener('keydown', e => {
    if (state === 'aim') {
      if (e.code === 'ArrowLeft') cursorX = Math.max(-3, cursorX - 0.5);
      if (e.code === 'ArrowRight') cursorX = Math.min(3, cursorX + 0.5);
      if (e.code === 'Space') playKick();
    } else if (state === 'ready') {
      reset();
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function playKick() {
  if (state !== 'aim') return;
  state = 'shooting';
  cursor.visible = false;
  hasCelebrated = false;

  if (kickAnim && playerMixer) {
    playerMixer.stopAllAction();
    kickAnim.reset().play();
    setTimeout(() => {
      ballVelocity.set((cursorX - ball.position.x) * 0.1, 0.02, -0.45);
    }, 700);
  }

  const dive = ['left', 'right', 'center'][Math.floor(Math.random() * 3)];
  if (dive === 'center') {
    goalieMixer.stopAllAction();
    goalieIdleAnim?.reset().play();
  } else {
    const anim = dive === 'left' ? goalieLeftAnim : goalieRightAnim;
    if (anim) {
      const action = goalieMixer.clipAction(anim);
      goalieMixer.stopAllAction();
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
      action.reset().play();
    }
  }
}

function reset() {
  ballVelocity.set(0, 0, 0);
  ball.position.set(0.1, 0.2, 5.9);
  ball.rotation.set(0, 0, 0);
  cursorX = 0;
  cursor.visible = true;
  state = 'aim';
  hasCelebrated = false;
  goalieMixer.stopAllAction();
  goalieIdleAnim?.reset().play();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (playerMixer) playerMixer.update(delta);
  if (goalieMixer) goalieMixer.update(delta);

  if (state === 'shooting') {
    ball.position.add(ballVelocity);
    ballVelocity.multiplyScalar(0.98);

    const rotationSpeed = 30;
    ball.rotation.x += ballVelocity.length() * delta * rotationSpeed;
    ball.rotation.y += ballVelocity.x * delta * rotationSpeed;

    const goalieX = goalieModel?.position?.x || 0;
    const hitX = ball.position.x;
    const blocked = Math.abs(hitX - goalieX) < 1.2;
    const isOnTarget = Math.abs(hitX) <= 3.5 && ball.position.y <= 2.5;

    if (blocked && ball.position.z < -19.2 && ballVelocity.z < 0) {
      ballVelocity.x += (Math.random() - 0.5) * 0.2;
      ballVelocity.y = 0.05;
      ballVelocity.z *= -0.3;
    }

    if (ball.position.z < -19.5 || ball.position.y < -1 || Math.abs(ball.position.x) > 10) {
      ballVelocity.set(0, 0, 0);
      state = 'ready';

      if (!blocked && isOnTarget && !hasCelebrated) {
        hasCelebrated = true;
        playerMixer.stopAllAction();
        celebrateAnim?.reset().play();
      }
    }
  }

  cursor.position.x = cursorX;
  renderer.render(scene, camera);
}