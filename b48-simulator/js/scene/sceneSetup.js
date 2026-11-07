// Scena de atelier: renderer, cameră, OrbitControls, lumini, mediu, podea, stand motor, temă, resize, buclă.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PartBuilder } from './geom.js';
import { materialCache } from './materials.js';
import { FLOOR_Y } from './dims.js';

export const DEFAULT_CAM = { pos: new THREE.Vector3(-8.6, 6.4, 10.2), target: new THREE.Vector3(0, 1.2, 0) };

const THEMES = {
  dark: { bg: 0x15181c, floor: 0x2b2e33, grid1: 0x4a525c, grid2: 0x30363d, line: 0x8a6d1c, hemiSky: 0xcfd8e6, hemiGround: 0x2a241e, env: 0.55 },
  light: { bg: 0xdfe3e8, floor: 0xb6bbc1, grid1: 0x8d949c, grid2: 0xa3a9b0, line: 0xc9a227, hemiSky: 0xffffff, hemiGround: 0x8a8378, env: 0.8 },
};

/** Verifică disponibilitatea WebGL2 (cerută de three.js r170). */
export function assertWebGL() {
  let ok = false;
  try {
    const c = document.createElement('canvas');
    ok = !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { ok = false; }
  if (!ok) throw new Error('WebGL 2 nu este disponibil în acest browser. Activează accelerarea grafică (hardware acceleration) sau folosește o versiune recentă de Chrome, Firefox, Edge ori Safari.');
}

export class Stage {
  constructor(container) {
    this.container = container;
    assertWebGL();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error('Nu s-a putut inițializa WebGL: ' + (e?.message || e));
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.classList.add('ev-canvas');
    Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 250);
    this.camera.position.copy(DEFAULT_CAM.pos);

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 2.5, maxDistance: 45, screenSpacePanning: true, maxPolarAngle: Math.PI * 0.94, rotateSpeed: 0.8 });
    this.controls.target.copy(DEFAULT_CAM.target);
    this.controls.update();

    this._lights();
    this._environment();
    this._floor();
    this._stand();
    // rădăcina motorului (vibrează la funcționare)
    this.engineRoot = new THREE.Group();
    this.engineRoot.name = 'engineRoot';
    this.scene.add(this.engineRoot);
    this.fxRoot = new THREE.Group();
    this.scene.add(this.fxRoot);

    this.setTheme('dark');
    this._resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.width = w; this.height = h;
    };
    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this.clock = new THREE.Clock();
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfd8e6, 0x2a241e, 0.55);
    s.add(this.hemi);
    const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    s.add(key);
    this.key = key;
    const fill = new THREE.DirectionalLight(0xc8dcff, 0.6);
    fill.position.set(9, 5, -7);
    s.add(fill);
    // spoturi de atelier (lămpi de tavan)
    for (const [x, z, c] of [[-5, -5, 0xffe9c8], [6, 6, 0xffffff]]) {
      const sp = new THREE.SpotLight(c, 1.4, 0, 0.5, 0.65, 0);
      sp.position.set(x, 12, z);
      sp.target.position.set(0, 0.5, 0);
      s.add(sp, sp.target);
    }
  }

  _environment() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envMap = pm.fromScene(room, 0.04).texture;
    room.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    pm.dispose();
    this.scene.environment = this.envMap;
  }

  _floor() {
    const s = this.scene;
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.92, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    floor.name = 'floor';
    s.add(floor);
    this.floor = floor;
    this.grid = new THREE.GridHelper(40, 40, 0x4a525c, 0x30363d);
    this.grid.position.y = FLOOR_Y + 0.004;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.grid.material.depthWrite = false;
    s.add(this.grid);
    // linii de delimitare a zonei de lucru
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0x8a6d1c, transparent: true, opacity: 0.55 });
    const lines = new THREE.Group();
    for (const [w, d, x, z] of [[14, 0.12, 0, -6], [14, 0.12, 0, 6], [0.12, 12, -7, 0], [0.12, 12, 7, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, FLOOR_Y + 0.006, z);
      lines.add(m);
    }
    s.add(lines);
    this.floorLines = lines;
  }

  /** Stand de motor simplu, prins de fața spate a blocului (partea cutiei de viteze). */
  _stand() {
    const b = new PartBuilder();
    const P = 'paint';
    b.box(P, [0.25, 0.2, 5.2], [4.2, FLOOR_Y + 0.1, 0]);           // traversă bază
    b.box(P, [4.0, 0.2, 0.25], [3.0, FLOOR_Y + 0.1, -2.4]);
    b.box(P, [4.0, 0.2, 0.25], [3.0, FLOOR_Y + 0.1, 2.4]);
    for (const [x, z] of [[1.1, -2.4], [1.1, 2.4], [4.2, -2.5], [4.2, 2.5]]) {
      b.cyl('toolBlack', 0.13, 0.12, [x, FLOOR_Y + 0.13, z], 'x', 16);
      b.box('steelDark', [0.12, 0.12, 0.08], [x, FLOOR_Y + 0.24, z]);
    }
    b.box(P, [0.3, -FLOOR_Y + 0.15, 0.3], [4.2, (FLOOR_Y + 0.15) / 2, 0]); // coloană
    b.box(P, [1.3, 0.28, 0.28], [3.55, 0, 0]);                      // braț orizontal
    b.cyl('steelDark', 0.3, 0.14, [2.9, 0, 0], 'x', 32);            // cap rotativ
    b.cyl('steel', 0.12, 0.3, [3.05, 0, 0], 'x', 20);
    // patru brațe spre colțurile blocului
    for (const [y, z] of [[1.6, 0.7], [1.6, -0.7], [-0.52, 0.8], [-0.52, -0.8]]) {
      const ang = Math.atan2(y, z);
      const ry = Math.sin(ang) * 1.7, rz = Math.cos(ang) * 1.7;
      b.tube('paint', [[2.85, 0, 0], [2.8, ry * 0.5, rz * 0.5], [2.72, ry, rz]], 0.06, { radial: 8, tension: 0.2 });
      b.tube('paint', [[2.72, ry, rz], [2.2, (ry + y) / 2, (rz + z) / 2], [2.0, y, z]], 0.055, { radial: 8 });
      b.bolt([1.99, y, z], '-x', 0.05);
    }
    this.standMats = materialCache();
    const g = b.build(this.standMats);
    g.name = 'engineStand';
    this.scene.add(g);
    this.stand = g;
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.dark;
    this.theme = THEMES[name] ? name : 'dark';
    this.scene.background = new THREE.Color(t.bg);
    this.scene.fog = new THREE.Fog(t.bg, 32, 85);
    this.floorMat.color.setHex(t.floor);
    this.grid.geometry.dispose();
    this.scene.remove(this.grid);
    this.grid.material.dispose();
    this.grid = new THREE.GridHelper(40, 40, t.grid1, t.grid2);
    this.grid.position.y = FLOOR_Y + 0.004;
    Object.assign(this.grid.material, { transparent: true, opacity: 0.35, depthWrite: false });
    this.scene.add(this.grid);
    this.lineMat.color.setHex(t.line);
    this.hemi.color.setHex(t.hemiSky);
    this.hemi.groundColor.setHex(t.hemiGround);
    this.scene.environmentIntensity = t.env;
  }

  /** Pornește bucla; onFrame(dt, t) e apelată înainte de randare. */
  start(onFrame, afterRender, shouldRender = () => true) {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(0.05, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      onFrame(dt, t);
      this.controls.update();
      // randare la cerere: când scena e statică nu mai desenăm (economie mare pe sisteme fără GPU)
      if (!shouldRender()) return;
      this.renderer.render(this.scene, this.camera);
      afterRender?.(dt, t);
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this._ro?.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh || o.isLine || o.isLineSegments) {
        o.geometry?.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
      }
    });
    this.envMap?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
