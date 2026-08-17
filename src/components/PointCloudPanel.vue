<template>
  <q-card class="bg-grey-10">
    <canvas ref="canvas" class="gravix-canvas" />
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div>Visible</div>
        <q-toggle v-model="visible" dense @update:model-value="applyVisible" />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Demo</div>
        <select class="demo-select" :value="demo" @change="onDemo">
          <option value="lorenz">Lorenz attractor</option>
          <option value="bounce">Bouncing box</option>
        </select>
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Points {{ count.toLocaleString() }} / {{ capacity.toLocaleString() || '—' }}</div>
        <q-slider
          v-model="percent"
          :min="0"
          :max="100"
          class="q-ml-md"
          style="width: 190px"
          @update:model-value="applyCount"
        />
      </div>
      <div v-if="demo === 'lorenz'" class="params">
        <label>a <input v-model.number="a" type="number" min="0.1" step="0.1" @change="onA" /></label>
        <label>b <input v-model.number="b" type="number" min="0.1" step="0.1" @change="onB" /></label>
        <label>r <input v-model.number="r" type="number" min="0.1" step="0.5" @change="onR" /></label>
        <label>
          dt <input v-model.number="dt" type="number" min="0.001" max="0.05" step="0.001" @change="onDt" />
        </label>
        <label>
          α
          <input
            v-model.number="alpha"
            type="number"
            min="0.01"
            max="1"
            step="0.01"
            @change="onAlpha"
          />
        </label>
        <label>Run <button type="button" class="reset-btn" @click="onReset">Reset</button></label>
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Animate</div>
        <q-toggle v-model="animate" dense @update:model-value="onAnimate" />
      </div>
      <div class="stats">{{ stats }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import {
  GravixEngine,
  PointCloudSimulationSystem,
  addPointCloud,
  type PointCloudRecord,
} from '@giraphics/gravix-engine';
import { onUnmounted, ref, shallowRef } from 'vue';

import { LorenzAttractorSystem } from '../lib/lorenz-attractor';
import { readLaunchOptions } from '../lib/options';
import { useGravixEngine } from '../lib/useGravixEngine';

type DemoMode = 'lorenz' | 'bounce';

const canvas = ref<HTMLCanvasElement | null>(null);
const visible = ref(true);
const animate = ref(true);
const demo = ref<DemoMode>('lorenz');
const percent = ref(100);
const count = ref(0);
const capacity = ref(0);
const eid = ref<number | null>(null);
const stats = ref('starting…');
const bounce = new PointCloudSimulationSystem({ halfExtent: 6, maxSpeed: 1.5 });
bounce.enabled = false;
const lorenz = new LorenzAttractorSystem();
const a = ref(lorenz.a);
const b = ref(lorenz.b);
const r = ref(lorenz.r);
const dt = ref(lorenz.dt);
const alpha = ref(lorenz.brightness);
const record = shallowRef<PointCloudRecord | null>(null);

const { engine } = useGravixEngine(
  canvas,
  async (next: GravixEngine) => {
    next.createCamera({
      name: 'cloud-camera',
      fov: Math.PI / 4,
      nearPlane: 0.1,
      farPlane: 500,
      position: [14, 8, 18],
      target: [0, 0, 0],
    });
    const { pointCapacity } = readLaunchOptions();
    const entity = next.world.entities.create('cloud');
    const created = addPointCloud(next.world, entity, {
      capacity: pointCapacity,
      pointSize: 2,
    });
    lorenz.prime(entity.eid, created);
    record.value = created;
    eid.value = entity.eid;
    capacity.value = created.capacity;
    count.value = created.count;
  },
  {
    clearColor: [0, 0, 0, 1],
    sceneName: 'cloud',
    systems: [bounce, lorenz],
  },
);

const timer = window.setInterval(() => {
  const live = engine.value;
  if (!live) {
    return;
  }
  const s = live.getStats();
  stats.value = `backend ${live.backendKind} · fps ${s.fps.toFixed(0)} · frame ${live.world.time.frame} · verts ${count.value.toLocaleString()} · resources ${live.world.resources.size()}`;
}, 250);

onUnmounted(() => window.clearInterval(timer));

function applyVisible(checked: boolean): void {
  const live = engine.value;
  if (live && eid.value !== null) {
    live.world.components.Renderable.visible[eid.value] = checked ? 1 : 0;
  }
}

function applyCount(value: number | null): void {
  const next = value ?? 0;
  percent.value = next;
  const rec = record.value;
  if (!rec || eid.value === null) {
    return;
  }
  rec.count = Math.round(rec.capacity * (next / 100));
  count.value = rec.count;
  if (demo.value === 'lorenz') {
    lorenz.syncDisplay(eid.value, rec);
  }
}

function onDemo(event: Event): void {
  const next = (event.target as HTMLSelectElement).value as DemoMode;
  demo.value = next;
  const rec = record.value;
  if (!rec || eid.value === null) {
    return;
  }
  const running = animate.value;
  if (next === 'lorenz') {
    bounce.enabled = false;
    lorenz.active = true;
    lorenz.enabled = running;
    lorenz.syncDisplay(eid.value, rec);
    lorenz.setBrightness(lorenz.brightness);
  } else {
    lorenz.active = false;
    lorenz.enabled = false;
    bounce.enabled = running;
    fillRandomCloud(rec, 6);
  }
}

function onAnimate(checked: boolean): void {
  if (demo.value === 'lorenz') {
    lorenz.active = true;
    lorenz.enabled = checked;
    bounce.enabled = false;
  } else {
    lorenz.active = false;
    lorenz.enabled = false;
    bounce.enabled = checked;
  }
}

function onA(): void {
  lorenz.a = Number.isFinite(a.value) ? a.value : lorenz.a;
}

function onB(): void {
  lorenz.b = Number.isFinite(b.value) ? b.value : lorenz.b;
}

function onR(): void {
  lorenz.r = Number.isFinite(r.value) ? r.value : lorenz.r;
}

function onDt(): void {
  lorenz.dt = Number.isFinite(dt.value) ? dt.value : lorenz.dt;
}

function onAlpha(): void {
  lorenz.setBrightness(Number.isFinite(alpha.value) ? alpha.value : lorenz.brightness);
}

function onReset(): void {
  if (demo.value === 'lorenz') {
    lorenz.reset();
  } else if (record.value) {
    fillRandomCloud(record.value, 6);
  }
}

function fillRandomCloud(target: PointCloudRecord, halfExtent: number): void {
  const { positions, colors, capacity: cap } = target;
  const extent = halfExtent * 2;
  for (let i = 0; i < cap; i++) {
    const p = i * 3;
    positions[p] = Math.random() * extent - halfExtent;
    positions[p + 1] = Math.random() * extent - halfExtent;
    positions[p + 2] = Math.random() * extent - halfExtent;
    const c = i * 4;
    colors[c] = Math.random();
    colors[c + 1] = Math.random();
    colors[c + 2] = Math.random();
    colors[c + 3] = 1;
  }
  target.dirty = true;
  target.revision += 1;
}
</script>
