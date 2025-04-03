import * as THREE from 'https://esm.sh/three@0.150.1';
import { GLTFLoader } from 'https://esm.sh/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://esm.sh/three@0.150.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.150.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.150.1/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, controls, composer;
let ball, glowBall, ballVelocity = new THREE.Vector3();
let playerModel, goalieModel;
let playerMixer, goalieMixer;
let kickAnim, celebrateAnim, playerIdleAnim, goalieIdleAnim, goalieLeftAnim, goalieRightAnim;
let state = 'aim';
let cursorX = 0;
let hasCelebrated = false;
let timeUniform = { value: 0 };

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb3e0ff);

  camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(6, 2, 36.5);
  camera.lookAt(0, 1.6, 36.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.4, 0.85);
  composer.addPass(bloomPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1.6, 36.5);
  controls.update();

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  scene.add(ambient, dirLight);

  const gltfLoader = new GLTFLoader();
  gltfLoader.load('models/football_field.glb', gltf => {
    const field = gltf.scene;
    field.position.set(0, -0.01, 0);
    field.rotation.y = Math.PI;
    field.traverse(obj => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    scene.add(field);
  });

  const ballTex = textureLoader.load('textures/ballon.png');
  const bumpMap = textureLoader.load('textures/ballon_bump.jpg');
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 32),
    new THREE.MeshStandardMaterial({ map: ballTex, bumpMap: bumpMap, bumpScale: 0.05 })
  );
  ball.position.set(-17.3, -2.5, 36.2);
  ball.castShadow = true;
  scene.add(ball);

  const glowShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: timeUniform
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
        float pulse = 0.5 + 0.5 * sin(time * 3.0);
        gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0) * intensity * pulse;
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  glowBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 32, 32),
    glowShaderMaterial
  );
  glowBall.position.copy(ball.position);
  scene.add(glowBall);

  const loader = new GLTFLoader();
  loader.load('models/Soccer Penalty Kick.glb', gltf => {
    playerModel = gltf.scene;
    playerModel.position.set(-15, -2.9, 37);
    playerModel.rotation.y = -Math.PI / 2;
    playerModel.traverse(o => o.castShadow = true);
    scene.add(playerModel);
    playerMixer = new THREE.AnimationMixer(playerModel);
    kickAnim = playerMixer.clipAction(gltf.animations[0]);
    celebrateAnim = playerMixer.clipAction(gltf.animations[1] || gltf.animations[0]);
    celebrateAnim.setLoop(THREE.LoopOnce);
    celebrateAnim.clampWhenFinished = true;
  });

  loader.load('models/Soccer Idle.glb', gltf => {
    const idleAnim = gltf.animations[0];
    if (idleAnim) {
      playerIdleAnim = playerMixer.clipAction(idleAnim);
      playerIdleAnim.play();
    }
  });

  loader.load('models/Goalkeeper Idle.glb', gltf => {
    goalieModel = gltf.scene;
    goalieModel.position.set(-22, -2.9, 36.5);
    goalieModel.rotation.y = Math.PI / 2;
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
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}

function playKick() {
  if (state !== 'aim') return;
  state = 'shooting';
  hasCelebrated = false;

  if (playerIdleAnim) {
    playerIdleAnim.stop();
  }

  if (kickAnim && playerMixer) {
    playerMixer.stopAllAction();
    kickAnim.reset().play();

    setTimeout(() => {
      if (state === 'shooting') {
        ballVelocity.set(-1.5, 0.02, -cursorX * 0.05);
      }
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
  ball.position.set(-17.3, -2.5, 36.2);
  glowBall.position.copy(ball.position);
  ball.rotation.set(0, 0, 0);
  cursorX = 0;
  state = 'aim';
  hasCelebrated = false;
  goalieMixer.stopAllAction();
  goalieIdleAnim?.reset().play();
  if (playerIdleAnim) {
    playerIdleAnim.reset().play();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  timeUniform.value += delta;

  if (playerMixer) playerMixer.update(delta);
  if (goalieMixer) goalieMixer.update(delta);

  if (state === 'shooting') {
    ball.position.add(ballVelocity);
    glowBall.position.copy(ball.position);
    ballVelocity.multiplyScalar(0.98);
    const rotationSpeed = 30;
    ball.rotation.x += ballVelocity.length() * delta * rotationSpeed;
    ball.rotation.y += ballVelocity.z * delta * rotationSpeed;

    if (ball.position.x < -21.8 && ballVelocity.x < 0) {
      ballVelocity.x *= -0.2;
      ballVelocity.y = 0.03;
      ballVelocity.z += (Math.random() - 0.5) * 0.1;
    }

    if (ball.position.x > -12.8 && ballVelocity.x > 0) {
      ballVelocity.x *= -0.2;
      ballVelocity.y = 0.03;
      ballVelocity.z += (Math.random() - 0.5) * 0.1;
    }

    if (ball.position.y < -2.5 && ballVelocity.y < 0) {
      ballVelocity.y *= -0.4;
    }
  }

  composer.render();
}