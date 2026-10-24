// Talk to the arm. Primary path is Web Serial to the Raspberry Pi / microcontroller (Chrome only,
// needs a user click). The Pi reads one line per waypoint: "base,elbow,tilt,pressure". There's
// also a download so you always have the angle stream even without a connection.

let port = null, writer = null;

export function supported() { return "serial" in navigator; }

export async function connect(baud = 115200) {
  if (!supported()) throw new Error("Web Serial not supported (use Chrome, over https or localhost).");
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  writer = port.writable.getWriter();
  return true;
}

export async function disconnect() {
  try { writer && writer.releaseLock(); await port && port.close(); } catch (e) {}
  port = writer = null;
}

export function connected() { return !!writer; }

// Stream the angle path. onProgress(i, n) fires per waypoint. Lines: base,elbow,tilt,pressure
export async function send(path, { onProgress } = {}) {
  if (!writer) throw new Error("Arm not connected.");
  const enc = new TextEncoder();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const line = p.out_of_reach ? "SKIP\n" : `${p.base},${p.elbow},${p.tilt},${p.pressure}\n`;
    await writer.write(enc.encode(line));
    onProgress && onProgress(i + 1, path.length);
  }
  await writer.write(enc.encode("HOME\n"));
}

export function download(streamObj, name = "clock-arm.json") {
  const blob = new Blob([JSON.stringify(streamObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
