<template>
  <q-card class="bg-grey-10">
    <canvas ref="canvas" class="gravix-canvas" />
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div>Visible</div>
        <q-toggle v-model="visible" dense @update:model-value="applyVisible" />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Draw count {{ drawn }} / {{ indexCount || '—' }}</div>
        <q-slider v-model="percent" :min="0" :max="100" class="q-ml-md" style="width: 190px" @update:model-value="applyDraw" />
      </div>
      <div class="stats">{{ stats }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { GravixEngine } from '@giraphics/gravix-engine';
import { computed, onUnmounted, ref, shallowRef } from 'vue';

import { TERRAIN_TOPOLOGY, buildTerrain } from '../lib/geometry';
import { spawnDynamicMesh } from '../lib/mesh';
import { useGravixEngine } from '../lib/useGravixEngine';

const canvas = ref<HTMLCanvasElement | null>(null);
const visible = ref(true);
const percent = ref(100);
const indexCount = ref(0);
const eid = ref<number | null>(null);
const mesh = shallowRef<{ setDrawCount(count: number): void } | null>(null);
const stats = ref('starting…');

const drawn = computed(() => Math.round(indexCount.value * (percent.value / 100)));

const { engine } = useGravixEngine(
  canvas,
  async (next: GravixEngine) => {
    next.createCamera({
      name: 'terrain-camera',
      fov: Math.PI / 4,
      nearPlane: 0.5,
      farPlane: 5000,
      position: [120, 72, 120],
      target: [0, 0, 0],
    });
    const geometry = buildTerrain(48, 60);
    const spawned = spawnDynamicMesh(next, 'terrain-layer', geometry, TERRAIN_TOPOLOGY);
    mesh.value = spawned.mesh;
    indexCount.value = geometry.indexCount;
    eid.value = spawned.entity.eid;
    spawned.mesh.setDrawCount(geometry.indexCount);
  },
  { clearColor: [0.04, 0.05, 0.09, 1], sceneName: 'terrain' },
);

let timer = 0;
timer = window.setInterval(() => {
  const live = engine.value;
  if (!live) {
    return;
  }
  const s = live.getStats();
  stats.value = `backend ${live.backendKind} · fps ${s.fps.toFixed(0)} · frame ${live.world.time.frame} · verts ${indexCount.value.toLocaleString()} · resources ${live.world.resources.size()}`;
}, 250);

onUnmounted(() => window.clearInterval(timer));

function applyVisible(checked: boolean): void {
  const live = engine.value;
  if (live && eid.value !== null) {
    live.world.components.Renderable.visible[eid.value] = checked ? 1 : 0;
  }
}

function applyDraw(value: number | null): void {
  const next = value ?? 0;
  percent.value = next;
  mesh.value?.setDrawCount(Math.round(indexCount.value * (next / 100)));
}
</script>
