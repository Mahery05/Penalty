import * as THREE from 'https://esm.sh/three@0.150.1';
import { GLTFLoader } from 'https://esm.sh/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer;
let ball, goal, cursor, cursorX = 0;
let ballVelocity = new THREE.Vector3();
let state = 'aim';
let score = { team1: 0, team2: 0 };
let currentTeam = 'team1';
let attempts = 0;

let playerMixer, goalieMixer;
let playerModel, goalieModel;
let playerIdleAnim, playerKickAnim;
let goalieLeft, goalieRight, goalieIdle;

const clock = new THREE.Clock();

window.addEventListener('DOMContentLoaded', () => {
  createUI();
  init();
  animate();
});

function createUI() {
  const ui = document.createElement('div');
  ui.id = 'scoreboard';
  ui.innerHTML = `
    <style>
      #scoreboard {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-family: sans-serif;
        color: white;
        text-align: center;
      }
      .team {
        margin: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: grey;
        display: inline-block;
      }
      .dot.scored { background: lime; }
      .dot.missed { background: red; }
    </style>
    <div class="team" id="team1">
      <strong>Modena</strong>
      ${'<span class="dot"></span>'.repeat(5)}
    </div>
    <div class="team" id="team2">
      <strong>Juventus</strong>
      ${'<span class="dot"></span>'.repeat(5)}
    </div>
  `;
  document.body.appendChild(ui);
}

function updateUI(success) {
  const teamDots = document.querySelectorAll(`#${currentTeam} .dot`);
  if (teamDots[attempts % 5]) {
    teamDots[attempts % 5].classList.add(success ? 'scored' : 'missed');
  }
  if (success) score[currentTeam]++;
  if ((attempts + 1) % 5 === 0) {
    currentTeam = currentTeam === 'team1' ? 'team2' : 'team1';
  }
  attempts++;
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(2, 3, 10);
  camera.lookAt(0, 1.5, -15);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x404040));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 50),
    new THREE.MeshStandardMaterial({ color: 0x228B22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  goal = new THREE.Mesh(
    new THREE.BoxGeometry(8, 3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  goal.position.set(0, 1.5, -20);
  scene.add(goal);

  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  ball.position.set(0, 0.2, 5);
  ball.scale.set(0.3, 0.3, 0.3);
  scene.add(ball);

  cursor = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  cursor.rotation.x = Math.PI / 2;
  cursor.position.set(0, 1.5, -19.9);
  scene.add(cursor);

  const loader = new GLTFLoader();

  loader.load('models/Soccer Penalty Kick.glb', gltf => {
    playerModel = gltf.scene;
    playerModel.position.set(0, 0, 6); // aligné avec la balle
    playerModel.rotation.y = Math.PI;
    scene.add(playerModel);
    playerMixer = new THREE.AnimationMixer(playerModel);
    playerKickAnim = playerMixer.clipAction(gltf.animations[0]);
    playerKickAnim.setLoop(THREE.LoopOnce);
    playerKickAnim.clampWhenFinished = true;
  });

  loader.load('models/Goalkeeper Idle.glb', gltf => {
    goalieModel = gltf.scene;
    goalieModel.position.set(0, 0, -19.9);
    scene.add(goalieModel);
    goalieMixer = new THREE.AnimationMixer(goalieModel);
    goalieIdle = goalieMixer.clipAction(gltf.animations[0]);
    goalieIdle.play();
  });

  loader.load('models/Goalkeeper Diving Save Left.glb', gltf => {
    goalieLeft = gltf.animations[0];
  });

  loader.load('models/Goalkeeper Diving Save Right.glb', gltf => {
    goalieRight = gltf.animations[0];
  });

  window.addEventListener('keydown', e => {
    if (state === 'aim') {
      if (e.code === 'ArrowLeft') cursorX = Math.max(-3, cursorX - 0.5);
      if (e.code === 'ArrowRight') cursorX = Math.min(3, cursorX + 0.5);
      if (e.code === 'Space') playKick();
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

  if (playerKickAnim && playerMixer) {
    playerMixer.stopAllAction();
    playerKickAnim.reset().play();

    // Délai pour que le tir parte pile à l'impact (700ms approx)
    setTimeout(() => {
      launchBall();
    }, 700);
  }

  const diveDir = ['left', 'center', 'right'][Math.floor(Math.random() * 3)];
  if (diveDir !== 'center') playGoalieDive(diveDir);
  else {
    goalieMixer.stopAllAction();
    goalieIdle?.reset().play();
  }
}

function launchBall() {
  ballVelocity.set((cursorX - ball.position.x) * 0.1, 0.1, -0.4);
}

function playGoalieDive(dir) {
  if (!goalieMixer) return;
  goalieMixer.stopAllAction();
  const anim = dir === 'left' ? goalieLeft : goalieRight;
  if (anim) {
    const action = goalieMixer.clipAction(anim);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.reset().play();
  }
}

function reset(success) {
  updateUI(success);
  setTimeout(() => {
    ball.position.set(0, 0.2, 5);
    ballVelocity.set(0, 0, 0);
    cursorX = 0;
    cursor.visible = true;
    state = 'aim';
    if (goalieIdle) {
      goalieMixer.stopAllAction();
      goalieIdle.reset().play();
    }
  }, 1500);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (playerMixer) playerMixer.update(delta);
  if (goalieMixer) goalieMixer.update(delta);

  if (ballVelocity.lengthSq() > 0.0001) {
    ball.position.add(ballVelocity);
    ballVelocity.multiplyScalar(0.98);
    if (ball.position.z < -19.5) {
      const hitX = ball.position.x;
      const goalieX = goalieModel?.position?.x || 0;
      const blocked = Math.abs(hitX - goalieX) < 1;
      reset(!blocked);
      state = 'reset';
    }
  }

  cursor.position.x = cursorX;
  renderer.render(scene, camera);
}