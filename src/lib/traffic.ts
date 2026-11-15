/**
 * The "traffic" world: a live view of a gravix-sim-backend run.
 *
 * It opens a WebSocket to the simulator, draws the road graph from the first
 * frame as line segments, and draws every vehicle from each snapshot as one
 * point in a point cloud. The contract is proto/gravix/sim/v1/sim.proto in
 * gravix-sim-backend; src/lib/simproto.ts reads it.
 *
 * Coordinates arrive in metres (x east, y north). They are centred and scaled
 * to fit the camera, with north kept up on screen.
 */
import {
  GeometryAccumulator,
  addPointCloud,
  estimateIndexCapacity,
  type GravixEngine,
  type PointCloudRecord,
} from '@giraphics/gravix-engine';

import { RINGS_TOPOLOGY } from './geometry';
import { spawnDynamicMesh } from './mesh';
import {
  COMMAND_PAUSE,
  COMMAND_RESUME,
  decodeServerMessage,
  encodeControl,
  type SimMap,
  type SimSnapshot,
} from './simproto';

export type TrafficStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TrafficWorld {
  snapshot(): Record<string, unknown>;
  invoke(action: string, args: unknown[]): void;
  dispose(): void;
}

/** Half the width of the drawn map, in engine units. */
const HALF_EXTENT = 45;
const VEHICLE_HEIGHT = 0.4;
/**
 * Every vehicle is drawn as a block of points, not one. WebGPU has no point
 * size, so a single point is one pixel there and the traffic is nearly
 * invisible. A 3 by 3 block stays readable on both backends.
 */
const BLOCK = 3;
const POINTS_PER_VEHICLE = BLOCK * BLOCK;
/** Gap between neighbouring points in a block, in engine units, per size step. */
const SPACING_PER_STEP = 0.12;
const SIZE_MIN = 1;
const SIZE_MAX = 6;
const SIZE_DEFAULT = 3;
/** The simulator gives vehicles 8 to 16 m/s; colour runs across that range. */
const SPEED_LO = 8;
const SPEED_HI = 16;
const SAMPLES = 40;

/** Builds the WebSocket address for a run. Exported so it can be tested. */
export function runUrl(base: string, scenario: string, vehicles: number, seed: number): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  if (!/^wss?:\/\//i.test(trimmed)) {
    throw new Error('the address must start with ws:// or wss://');
  }
  const query = new URLSearchParams();
  if (scenario) query.set('scenario', scenario);
  if (Number.isFinite(vehicles) && vehicles > 0) query.set('vehicles', String(Math.floor(vehicles)));
  if (Number.isFinite(seed) && seed >= 0) query.set('seed', String(Math.floor(seed)));
  const q = query.toString();
  return `${trimmed}/ws${q ? `?${q}` : ''}`;
}

export function createTraffic(
  engine: GravixEngine,
  autoConnect: { url: string; scenario: string; vehicles: number } | null,
): TrafficWorld {
  engine.createCamera({
    name: 'traffic-camera',
    fov: Math.PI / 4,
    nearPlane: 0.1,
    farPlane: 1000,
    position: [0, 95, 80],
    target: [0, 0, 0],
  });

  let socket: WebSocket | null = null;
  let status: TrafficStatus = 'disconnected';
  let message = '';
  let url = '';
  let paused = false;

  // The map transform, set when the road graph arrives.
  let centreX = 0;
  let centreY = 0;
  let scale = 0.05;
  let roadEid: number | null = null;
  let roadSegments = 0;

  let cloudEid: number | null = null;
  let cloud: PointCloudRecord | null = null;
  let vehicleSize = SIZE_DEFAULT;
  let lastSnapshot: SimSnapshot | null = null;

  let tick = 0;
  let simTimeS = 0;
  let vehicles = 0;
  let decodeErrors = 0;
  let arrivals: number[] = [];
  let latencies: number[] = [];

  const destroy = (eid: number | null): void => {
    if (eid === null) return;
    const entity = engine.world.entities.wrap(eid);
    if (entity.isValid()) entity.destroy();
  };

  const resetStream = (): void => {
    tick = 0;
    simTimeS = 0;
    arrivals = [];
    latencies = [];
    decodeErrors = 0;
    paused = false;
  };

  const drawMap = (map: SimMap): void => {
    destroy(roadEid);
    roadEid = null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < map.nodeX.length; i++) {
      minX = Math.min(minX, map.nodeX[i]);
      maxX = Math.max(maxX, map.nodeX[i]);
      minY = Math.min(minY, map.nodeY[i]);
      maxY = Math.max(maxY, map.nodeY[i]);
    }
    if (!Number.isFinite(minX)) return;
    centreX = (minX + maxX) / 2;
    centreY = (minY + maxY) / 2;
    scale = HALF_EXTENT / Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1);

    // Each two-way street is stored as two one-way roads; draw it once.
    const seen = new Set<number>();
    const pairs: Array<[number, number]> = [];
    const n = map.nodeX.length;
    for (let i = 0; i < map.edgeFrom.length; i++) {
      const a = Math.min(map.edgeFrom[i], map.edgeTo[i]);
      const b = Math.max(map.edgeFrom[i], map.edgeTo[i]);
      const key = a * n + b;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b]);
    }
    roadSegments = pairs.length;
    if (roadSegments === 0) return;

    const vertexCount = roadSegments * 2;
    const accumulator = new GeometryAccumulator({
      vertexCapacity: vertexCount,
      indexCapacity: estimateIndexCapacity({
        vertexCount,
        featureCount: roadSegments,
        triangulated: false,
        usesPrimitiveRestart: true,
      }),
      usesPrimitiveRestart: true,
      label: 'roads',
    });
    const segment = new Float32Array(6);
    for (const [a, b] of pairs) {
      segment[0] = (map.nodeX[a] - centreX) * scale;
      segment[1] = 0;
      segment[2] = -(map.nodeY[a] - centreY) * scale;
      segment[3] = (map.nodeX[b] - centreX) * scale;
      segment[4] = 0;
      segment[5] = -(map.nodeY[b] - centreY) * scale;
      if (!accumulator.addVertices(segment, [0.32, 0.38, 0.5, 1])) {
        throw new Error('road graph does not fit in the geometry buffer');
      }
      accumulator.commitFeature();
    }
    roadEid = spawnDynamicMesh(engine, 'roads', accumulator, RINGS_TOPOLOGY).entity.eid;
  };

  const drawVehicles = (snap: SimSnapshot): void => {
    if (snap.count === 0) return;
    lastSnapshot = snap;
    const capacity = snap.count * POINTS_PER_VEHICLE;
    if (!cloud || cloud.capacity !== capacity) {
      destroy(cloudEid);
      const entity = engine.world.entities.create('vehicles');
      cloudEid = entity.eid;
      cloud = addPointCloud(engine.world, entity, { capacity, pointSize: 3 });
    }
    const { positions, colors } = cloud;
    const spacing = SPACING_PER_STEP * vehicleSize;
    const middle = (BLOCK - 1) / 2;
    for (let i = 0; i < snap.count; i++) {
      const cx = (snap.x[i] - centreX) * scale;
      const cz = -(snap.y[i] - centreY) * scale;
      const t = Math.min(1, Math.max(0, (snap.speed[i] - SPEED_LO) / (SPEED_HI - SPEED_LO)));
      const r = 0.3 + 0.7 * t;
      const g = 0.75 - 0.2 * t;
      const b = 1 - 0.8 * t;
      for (let j = 0; j < POINTS_PER_VEHICLE; j++) {
        const n = i * POINTS_PER_VEHICLE + j;
        const p = n * 3;
        positions[p] = cx + ((j % BLOCK) - middle) * spacing;
        positions[p + 1] = VEHICLE_HEIGHT;
        positions[p + 2] = cz + (Math.floor(j / BLOCK) - middle) * spacing;
        const c = n * 4;
        colors[c] = r;
        colors[c + 1] = g;
        colors[c + 2] = b;
        colors[c + 3] = 1;
      }
    }
    cloud.count = capacity;
    cloud.dirty = true;
  };

  const onFrame = (data: ArrayBuffer): void => {
    let msg;
    try {
      msg = decodeServerMessage(new Uint8Array(data));
    } catch {
      decodeErrors += 1;
      return;
    }
    if (msg === null) return;
    if (msg.kind === 'map') {
      drawMap(msg);
      return;
    }
    const now = performance.now();
    arrivals.push(now);
    if (arrivals.length > SAMPLES) arrivals.shift();
    if (msg.sentAtMicros > 0) {
      latencies.push(Math.max(0, (Date.now() * 1000 - msg.sentAtMicros) / 1000));
      if (latencies.length > SAMPLES) latencies.shift();
    }
    tick = msg.tick;
    simTimeS = msg.simTimeS;
    vehicles = msg.count;
    drawVehicles(msg);
  };

  const disconnect = (next: TrafficStatus = 'disconnected', why = ''): void => {
    const old = socket;
    socket = null;
    if (old) {
      old.onopen = old.onmessage = old.onerror = old.onclose = null;
      try {
        old.close(1000);
      } catch {
        /* already closed */
      }
    }
    status = next;
    message = why;
  };

  const connect = (base: string, scenario: string, count: number, seed: number): void => {
    disconnect();
    resetStream();
    try {
      url = runUrl(base, scenario, count, seed);
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : String(e);
      return;
    }
    status = 'connecting';
    message = '';
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : String(e);
      return;
    }
    ws.binaryType = 'arraybuffer';
    socket = ws;
    ws.onopen = () => {
      if (socket === ws) status = 'connected';
    };
    ws.onmessage = (event) => {
      if (socket === ws && event.data instanceof ArrayBuffer) onFrame(event.data);
    };
    ws.onerror = () => {
      if (socket !== ws) return;
      status = 'error';
      message = `could not reach ${url}`;
    };
    ws.onclose = (event) => {
      if (socket !== ws) return;
      socket = null;
      if (status === 'connected') {
        status = 'disconnected';
        message = `closed by the server (code ${event.code})`;
      } else if (status !== 'error') {
        status = 'error';
        message = `could not reach ${url}`;
      }
    };
  };

  if (autoConnect) connect(autoConnect.url, autoConnect.scenario, autoConnect.vehicles, 1);

  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  return {
    snapshot() {
      const span = arrivals.length > 1 ? arrivals[arrivals.length - 1] - arrivals[0] : 0;
      return {
        status,
        message,
        url,
        paused,
        tick,
        simTimeS,
        vehicles,
        roads: roadSegments,
        streamFps: span > 0 ? ((arrivals.length - 1) * 1000) / span : 0,
        latencyMs: median(latencies),
        decodeErrors,
        vehicleSize,
        verts: vehicles * POINTS_PER_VEHICLE + roadSegments * 2,
      };
    },
    invoke(action, args) {
      switch (action) {
        case 'connect':
          connect(String(args[0] ?? ''), String(args[1] ?? ''), Number(args[2] ?? 0), Number(args[3] ?? 1));
          break;
        case 'disconnect':
          disconnect();
          break;
        case 'setVehicleSize':
          vehicleSize = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(Number(args[0]) || SIZE_DEFAULT)));
          if (lastSnapshot) drawVehicles(lastSnapshot);
          break;
        case 'setPaused':
          paused = args[0] === true;
          if (socket && status === 'connected') {
            socket.send(encodeControl(paused ? COMMAND_PAUSE : COMMAND_RESUME));
          }
          break;
      }
    },
    dispose() {
      disconnect();
    },
  };
}
