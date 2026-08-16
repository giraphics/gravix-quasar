<template>
  <q-card class="bg-grey-10">
    <canvas ref="canvas" class="gravix-canvas" />
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div>Visible</div>
        <q-toggle v-model="visible" dense @update:model-value="applyVisible" />
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
} from '@giraphics/gravix-engine';
import { onUnmounted, ref, shallowRef } from 'vue';

import { readLaunchOptions } from '../lib/options';
import { useGravixEngine } from '../lib/useGravixEngine';

const canvas = ref<HTMLCanvasElement | null>(null);
const visible = ref(true);
const animate = ref(true);
const percent = ref(100);
const count = ref(0);
const capacity = ref(0);
const eid = ref<number | null>(null);
const stats = ref('starting…');
const simulation = new PointCloudSimulationSystem({ halfExtent: 6, maxSpeed: 1.5 });
const record = shallowRef<{ count: number; capacity: number } | null>(null);

const { engine } = useGravixEngine(
  canvas,
  async (next: GravixEngine) => {
    next.createCamera({
      name: 'cloud-camera',
      fov: Math.PI / 4,
      nearPlane: 0.1,
      farPlane: 500,
      position: [16, 10, 16],
      target: [0, 0, 0],
    });
    const { pointCapacity } = readLaunchOptions();
    const entity = next.world.entities.create('cloud');
    const created = addPointCloud(next.world, entity, {
      capacity: pointCapacity,
      pointSize: 1,
      randomFill: 6,
    });
    record.value = created;
    eid.value = entity.eid;
    capacity.value = created.capacity;
    count.value = created.count;
  },
  {
    clearColor: [0.03, 0.06, 0.07, 1],
    sceneName: 'cloud',
    systems: [simulation],
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
  if (!rec) {
    return;
  }
  rec.count = Math.round(rec.capacity * (next / 100));
  count.value = rec.count;
}

function onAnimate(checked: boolean): void {
  simulation.enabled = checked;
}
</script>
