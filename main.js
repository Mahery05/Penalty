import * as THREE from 'https://esm.sh/three@0.150.1';
import { OrbitControls } from 'https://esm.sh/three@0.150.1/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer;
let ball, player, goal;
let ballVelocity = new THREE.Vector3();
let hasScored = false;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1, 0);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 7.5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 30),
    new THREE.MeshPhongMaterial({ color: 0x228B22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const goalGeom = new THREE.BoxGeometry(6, 3, 0.2);
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  goal = new THREE.Mesh(goalGeom, goalMat);
  goal.position.set(0, 1.5, -13.5);
  scene.add(goal);

  const ballGeom = new THREE.SphereGeometry(0.3, 32, 32);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  ball = new THREE.Mesh(ballGeom, ballMat);
  ball.position.set(0, 0.3, 0);
  scene.add(ball);

  const playerGeom = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  player = new THREE.Mesh(playerGeom, playerMat);
  player.position.set(0, 1, 2);
  scene.add(player);

  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', onWindowResize);
}

function handleKey(e) {
  if (e.code === 'Space' && ballVelocity.length() === 0) {
    ballVelocity.set(0, 0, -0.4);
  }
}

function animate() {
  requestAnimationFrame(animate);

  if (ballVelocity.length() > 0.001) {
    ball.position.add(ballVelocity);
    ballVelocity.multiplyScalar(0.99);

    if (!hasScored && ball.position.z < -12.5 && Math.abs(ball.position.x) < 3) {
      hasScored = true;
      celebrate();
    }
  }

  renderer.render(scene, camera);
}

function celebrate() {
  const duration = 60;
  let frame = 0;
  const anim = () => {
    if (frame < duration) {
      player.rotation.y += 0.2;
      player.position.y = 1 + 0.5 * Math.sin((frame / duration) * Math.PI * 2);
      frame++;
      requestAnimationFrame(anim);
    } else {
      player.rotation.y = 0;
      player.position.y = 1;
      reset();
    }
  };
  anim();
}

function reset() {
  ball.position.set(0, 0.3, 0);
  ballVelocity.set(0, 0, 0);
  hasScored = false;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
