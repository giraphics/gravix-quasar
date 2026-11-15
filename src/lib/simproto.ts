/**
 * Just enough protobuf to speak to gravix-sim-backend, with no dependency.
 *
 * The contract is proto/gravix/sim/v1/sim.proto in that repository. Only the
 * fields this viewer needs are read; unknown fields are skipped, so the
 * backend can add fields without breaking this decoder.
 *
 * Wire types used: 0 varint, 1 fixed64 (double), 2 length-delimited, 5 fixed32
 * (float). proto3 leaves out fields that hold their default (0), so every
 * value starts at 0.
 */

export interface SimMap {
  kind: 'map';
  /** Junction positions in metres: x east, y north. Index = junction id. */
  nodeX: Float32Array;
  nodeY: Float32Array;
  /** One-way roads as pairs of junction ids. */
  edgeFrom: Uint32Array;
  edgeTo: Uint32Array;
}

export interface SimSnapshot {
  kind: 'snapshot';
  tick: number;
  simTimeS: number;
  /** Sender's wall clock, microseconds since the Unix epoch. */
  sentAtMicros: number;
  count: number;
  x: Float32Array;
  y: Float32Array;
  heading: Float32Array;
  speed: Float32Array;
}

export type SimMessage = SimMap | SimSnapshot;

export const COMMAND_PAUSE = 1;
export const COMMAND_RESUME = 2;

/** Reads a varint as a JavaScript number (exact up to 2^53). */
function varint(bytes: Uint8Array, at: { pos: number }): number {
  let result = 0;
  let scale = 1;
  for (;;) {
    if (at.pos >= bytes.length) throw new Error('truncated varint');
    const b = bytes[at.pos++];
    result += (b & 0x7f) * scale;
    if ((b & 0x80) === 0) return result;
    scale *= 128;
    if (scale > 2 ** 70) throw new Error('varint too long');
  }
}

/** Skips a field of the given wire type. */
function skip(bytes: Uint8Array, at: { pos: number }, wire: number): void {
  switch (wire) {
    case 0:
      varint(bytes, at);
      break;
    case 1:
      at.pos += 8;
      break;
    case 2: {
      // Read the length first: `at.pos += varint(...)` would add to the
      // position from before the length byte was consumed.
      const length = varint(bytes, at);
      at.pos += length;
      break;
    }
    case 5:
      at.pos += 4;
      break;
    default:
      throw new Error(`unsupported wire type ${wire}`);
  }
  if (at.pos > bytes.length) throw new Error('truncated field');
}

/** Visits every field of a message occupying bytes[start, end). */
function fields(
  bytes: Uint8Array,
  start: number,
  end: number,
  visit: (field: number, wire: number, at: { pos: number }) => boolean,
): void {
  const at = { pos: start };
  while (at.pos < end) {
    const tag = varint(bytes, at);
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (!visit(field, wire, at)) skip(bytes, at, wire);
  }
  if (at.pos !== end) throw new Error('field ran past its message');
}

function lengthDelimited(bytes: Uint8Array, at: { pos: number }): [number, number] {
  const length = varint(bytes, at);
  const start = at.pos;
  at.pos += length;
  if (at.pos > bytes.length) throw new Error('truncated message');
  return [start, at.pos];
}

export function decodeServerMessage(bytes: Uint8Array): SimMessage | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result: SimMessage | null = null;
  fields(bytes, 0, bytes.length, (field, wire, at) => {
    if (wire !== 2) return false;
    if (field === 1) {
      const [s, e] = lengthDelimited(bytes, at);
      result = decodeMap(bytes, view, s, e);
      return true;
    }
    if (field === 2) {
      const [s, e] = lengthDelimited(bytes, at);
      result = decodeSnapshot(bytes, view, s, e);
      return true;
    }
    return false;
  });
  return result;
}

function decodeMap(bytes: Uint8Array, view: DataView, start: number, end: number): SimMap {
  const nodes: Array<[number, number, number]> = [];
  const edges: Array<[number, number]> = [];
  fields(bytes, start, end, (field, wire, at) => {
    if (wire !== 2 || (field !== 1 && field !== 2)) return false;
    const [s, e] = lengthDelimited(bytes, at);
    if (field === 1) {
      let id = 0;
      let x = 0;
      let y = 0;
      fields(bytes, s, e, (f, w, p) => {
        if (f === 1 && w === 0) id = varint(bytes, p);
        else if (f === 2 && w === 5) {
          x = view.getFloat32(p.pos, true);
          p.pos += 4;
        } else if (f === 3 && w === 5) {
          y = view.getFloat32(p.pos, true);
          p.pos += 4;
        } else return false;
        return true;
      });
      nodes.push([id, x, y]);
    } else {
      let from = 0;
      let to = 0;
      fields(bytes, s, e, (f, w, p) => {
        if (f === 1 && w === 0) from = varint(bytes, p);
        else if (f === 2 && w === 0) to = varint(bytes, p);
        else return false;
        return true;
      });
      edges.push([from, to]);
    }
    return true;
  });

  const size = nodes.reduce((m, n) => Math.max(m, n[0] + 1), 0);
  const nodeX = new Float32Array(size);
  const nodeY = new Float32Array(size);
  for (const [id, x, y] of nodes) {
    nodeX[id] = x;
    nodeY[id] = y;
  }
  return {
    kind: 'map',
    nodeX,
    nodeY,
    edgeFrom: Uint32Array.from(edges, (e) => e[0]),
    edgeTo: Uint32Array.from(edges, (e) => e[1]),
  };
}

function decodeSnapshot(bytes: Uint8Array, view: DataView, start: number, end: number): SimSnapshot {
  let tick = 0;
  let simTimeS = 0;
  let sentAtMicros = 0;
  const spans: Array<[number, number]> = [];
  fields(bytes, start, end, (field, wire, at) => {
    if (field === 1 && wire === 0) tick = varint(bytes, at);
    else if (field === 2 && wire === 1) {
      simTimeS = view.getFloat64(at.pos, true);
      at.pos += 8;
    } else if (field === 3 && wire === 0) sentAtMicros = varint(bytes, at);
    else if (field === 4 && wire === 2) spans.push(lengthDelimited(bytes, at));
    else return false;
    return true;
  });

  const count = spans.length;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const heading = new Float32Array(count);
  const speed = new Float32Array(count);
  spans.forEach(([s, e], i) => {
    fields(bytes, s, e, (f, w, p) => {
      if (w !== 5) return false;
      const value = view.getFloat32(p.pos, true);
      if (f === 2) x[i] = value;
      else if (f === 3) y[i] = value;
      else if (f === 4) heading[i] = value;
      else if (f === 5) speed[i] = value;
      else return false;
      p.pos += 4;
      return true;
    });
    // Vehicle id (field 1) is skipped: the viewer draws by position.
  });
  return { kind: 'snapshot', tick, simTimeS, sentAtMicros, count, x, y, heading, speed };
}

/** A Control message: field 1 (command) as a varint. */
export function encodeControl(command: number): Uint8Array {
  return command === 0 ? new Uint8Array(0) : Uint8Array.of(0x08, command);
}
