// The arm in 3D, to scale, to orbit round: the board with the ink the sim has laid, the two links in their plane
// above it, and the marker on the tilt servo, so the tilt and the shaft's height can be seen from any side.
// Same frame as everywhere else: mm, base axis at the origin, x right, y up the board, z out of the board.
import * as THREE from "three";
import { OrbitControls } from "../ui/vendor/OrbitControls.js";
import { fk } from "./ik.js";

const D2R = Math.PI / 180;

export function createView3d(host, inkCanvas) {
  const css = (n) => getComputedStyle(host).getPropertyValue(n).trim() || "#888";
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "cw-3d__canvas";
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(css("--dl-surface-2"));
  const camera = new THREE.PerspectiveCamera(32, 1, 2, 6000);
  camera.up.set(0, 1, 0);
  // orbit controls keep the camera's "up" fixed, so a view with a different up gets fresh controls
  let controls;
  function orbit(up) {
    controls?.dispose(); camera.up.copy(up);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
  }
  orbit(new THREE.Vector3(0, 1, 0));

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b4b7, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-260, 520, 700); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -450, right: 450, top: 450, bottom: -450, near: 10, far: 2000 });
  scene.add(sun, sun.target);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  const M = {
    link: mat(0xd9d6d8), servo: mat(0x2b2a2d), board: mat(0xffffff, { roughness: 0.9 }), frame: mat(0xb7b2b5),
    barrel: mat(0xf4f3f2), nib: mat(css("--dl-accent")), felt: mat(0x8fa9bb), post: mat(0x9c979a), ball: mat(0xcfd2d6, { metalness: 0.4, roughness: 0.3 }),
  };
  const shadowy = (m) => { m.castShadow = true; return m; };

  // the board: white, with the sim's ink on it
  const paint = document.createElement("canvas"), pctx = paint.getContext("2d");
  const tex = new THREE.CanvasTexture(paint); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  M.board.map = tex;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.board); board.receiveShadow = true; scene.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.frame); frame.receiveShadow = true; scene.add(frame);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.frame); stand.receiveShadow = true; scene.add(stand);

  // the arm: base servo, two links, elbow servo, tilt servo, the ball caster on its post
  const box = (m) => shadowy(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
  const baseServo = box(M.servo), elbowServo = box(M.servo), tiltServo = box(M.servo);
  const link1 = box(M.link), link2 = box(M.link);
  const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 16), M.post));
  const ball = shadowy(new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), M.ball));
  scene.add(baseServo, elbowServo, tiltServo, link1, link2, post, ball);

  // the marker: barrel, nib and eraser felt, built along +y and turned into place as one group
  const pen = new THREE.Group(); scene.add(pen);
  const barrel = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), M.barrel));
  const nib = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), M.nib));
  const felt = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), M.felt));
  pen.add(barrel, nib, felt);

  let g = null, built = "";
  function build(geom) {
    g = geom; const key = JSON.stringify([g.boardW, g.board, g.bx, g.by, g.L1, g.L2, g.pen.half, g.pen.height]);
    if (key === built) return; built = key;
    const mx = g.bx + g.boardW / 2, my = g.by + g.board / 2;   // the board's middle
    paint.width = Math.round(g.boardW * 3); paint.height = Math.round(g.board * 3);
    board.scale.set(g.boardW, g.board, 1); board.position.set(mx, my, 0);
    frame.scale.set(g.boardW + 24, g.board + 24, 10); frame.position.set(mx, my, -5.2);
    // the base sits below the board, on a block as tall as the arm's plane
    stand.scale.set(60, 44, g.pen.height - 14); stand.position.set(0, 0, (g.pen.height - 14) / 2 - 10);
    baseServo.scale.set(23, 12.5, 27); elbowServo.scale.set(23, 12.5, 27); tiltServo.scale.set(27, 12.5, 23);
    link1.scale.set(g.L1, 14, 5); link2.scale.set(g.L2, 14, 5);
    // pen parts, along +y: barrel between the shoulders, nib cone below, felt above
    const h = g.pen.half, r = (g.penSpec?.barrel || 17) / 2, t = g.penSpec?.nib || 12;
    barrel.scale.set(r, 2 * h - t - 6, r); barrel.position.y = (-(h - t) + (h - 6)) / 2;
    nib.geometry.dispose(); nib.geometry = new THREE.CylinderGeometry(r * 0.45, r * 0.12, t, 20); nib.position.y = -h + t / 2;
    felt.scale.set(r, 6, r); felt.position.y = h - 3;
    sun.target.position.set(mx, my, 0);
    frameView("three-quarter");
  }

  // place everything for the joint angles now (degrees: base, elbow, tilt from flat)
  const qUp = new THREE.Vector3(0, 1, 0);
  function place(j) {
    if (!g) return;
    const z = g.pen.height, t1 = j.base * D2R, t12 = (j.base + j.elbow) * D2R;
    const f = fk(t1, j.elbow * D2R, g.L1, g.L2);
    const at = (m, x, y, zz, rot) => { m.position.set(x, y, zz); m.rotation.set(0, 0, rot); };
    at(baseServo, 0, 0, z - 16, t1);
    at(link1, f.ex / 2, f.ey / 2, z, t1);
    at(elbowServo, f.ex, f.ey, z - 16, t12);
    at(link2, (f.ex + f.px) / 2, (f.ey + f.py) / 2, z, t12);
    at(tiltServo, f.px - 18 * Math.cos(t12), f.py - 18 * Math.sin(t12), z + 10, t12);
    // ball caster a little back along the forearm, clear of the pen's swing
    const bx = f.px - 24 * Math.cos(t12), by = f.py - 24 * Math.sin(t12);
    post.scale.set(1, z - 12, 1); post.position.set(bx, by, (z + 12) / 2); post.rotation.set(Math.PI / 2, 0, 0);
    ball.position.set(bx, by, 6);
    // the pen lies across the forearm; the tilt turns it about the forearm, nib down to draw
    const side = new THREE.Vector3(-Math.sin(t12), Math.cos(t12), 0), out = new THREE.Vector3(0, 0, 1);
    const tau = j.tilt * D2R, nibDir = side.clone().multiplyScalar(Math.cos(tau)).addScaledVector(out, Math.sin(tau)).normalize();
    pen.position.set(f.px, f.py, z);
    pen.quaternion.setFromUnitVectors(qUp, nibDir.clone().negate());   // the group's -y end is the nib
  }

  function paintBoard() {
    pctx.fillStyle = "#ffffff"; pctx.fillRect(0, 0, paint.width, paint.height);
    if (inkCanvas.width) pctx.drawImage(inkCanvas, 0, 0, paint.width, paint.height);
    tex.needsUpdate = true;
  }

  // camera views: the whole board from three-quarters, square on, from the side, or along the forearm
  let lastJ = null;
  function frameView(kind, j = lastJ) {
    if (!g) return;
    const cx = g.bx + g.boardW / 2, cy = g.by + g.board / 2, span = Math.max(g.board, g.boardW);   // the board's middle
    if (kind === "along" && j) {
      // from just past the forearm's tip, looking back along it, with the board as the floor: the pen's swing
      // is square to the view, like the side view in the pen mount study
      orbit(new THREE.Vector3(0, 0, 1));
      const t12 = (j.base + j.elbow) * D2R, f = fk(j.base * D2R, j.elbow * D2R, g.L1, g.L2);
      controls.target.set(f.px, f.py, g.pen.height * 0.7);
      camera.position.set(f.px + Math.cos(t12) * 520, f.py + Math.sin(t12) * 520, g.pen.height * 0.7 + 20);
    } else {
      orbit(new THREE.Vector3(0, 1, 0));
      controls.target.set(cx, cy - 20, 40);
      const d = span * 2.6;
      if (kind === "front") camera.position.set(cx, cy - 20, d);
      else if (kind === "side") camera.position.set(cx + d, cy - 20, 90);
      else camera.position.set(cx + d * 0.5, cy + d * 0.12, d * 0.85);
    }
    camera.lookAt(controls.target); controls.update();
  }

  let raf = 0, visible = false;
  function size() {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(host);
  function loop() { raf = 0; if (!visible) return; controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }

  return {
    // geom from config.geomFrom(), plus the pen's own measurements for drawing it
    setGeom(geom, penSpec) { build({ ...geom, penSpec }); },
    update(j, inkChanged) { lastJ = j; place(j); if (inkChanged) paintBoard(); },
    show(on) { visible = on; if (on) { size(); paintBoard(); if (!raf) raf = requestAnimationFrame(loop); } },
    view: frameView,
  };
}
