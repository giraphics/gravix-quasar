<template>
  <q-card class="bg-grey-10">
    <canvas ref="canvas" class="gravix-canvas" />
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div>Parent visible</div>
        <q-toggle v-model="parentVisible" dense @update:model-value="applyParentVisible" />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Child visible</div>
        <q-toggle v-model="childVisible" dense @update:model-value="applyChildVisible" />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Orbit parent</div>
        <q-toggle v-model="orbitOn" dense @update:model-value="onOrbit" />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Lifetime</div>
        <q-btn dense unelevated color="primary" label="Destroy / recreate" @click="recycle" />
      </div>
      <div class="stats">{{ stats }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { GravixEngine } from '@giraphics/gravix-engine';
import { onUnmounted, ref } from 'vue';

import { MARKER_TOPOLOGY, buildMarker } from '../lib/geometry';
import { spawnDynamicMesh } from '../lib/mesh';
import { ParentOrbitSystem } from '../lib/orbit';
import { useGravixEngine } from '../lib/useGravixEngine';

function spawnPair(engine: GravixEngine): { parentEid: number; childEid: number } {
  const parentGeom = buildMarker(4, [0.3, 0.75, 1, 1]);
  const childGeom = buildMarker(2, [1, 0.55, 0.2, 1]);
  const parent = spawnDynamicMesh(engine, 'parent', parentGeom, MARKER_TOPOLOGY, [0, 0, 0]);
  const child = spawnDynamicMesh(engine, 'child', childGeom, MARKER_TOPOLOGY, [6, 0, 0]);
  child.entity.setParent(parent.entity);
  return { parentEid: parent.entity.eid, childEid: child.entity.eid };
}

const canvas = ref<HTMLCanvasElement | null>(null);
const parentVisible = ref(true);
const childVisible = ref(true);
const orbitOn = ref(true);
const parentEid = ref<number | null>(null);
const childEid = ref<number | null>(null);
const cycles = ref(0);
const stats = ref('starting…');
const orbit = new ParentOrbitSystem();

const { engine } = useGravixEngine(
  canvas,
  async (next: GravixEngine) => {
    next.createCamera({
      name: 'hierarchy-camera',
      fov: Math.PI / 4,
      nearPlane: 0.1,
      farPlane: 200,
      position: [14, 10, 14],
      target: [0, 0, 0],
    });
    const ids = spawnPair(next);
    parentEid.value = ids.parentEid;
    childEid.value = ids.childEid;
  },
  {
    clearColor: [0.06, 0.04, 0.08, 1],
    sceneName: 'hierarchy',
    systems: [orbit],
  },
);

const timer = window.setInterval(() => {
  const live = engine.value;
  if (!live) {
    return;
  }
  const s = live.getStats();
  stats.value = `backend ${live.backendKind} · fps ${s.fps.toFixed(0)} · frame ${live.world.time.frame} · verts 6 · resources ${live.world.resources.size()} · cycles ${cycles.value}`;
}, 250);

onUnmounted(() => window.clearInterval(timer));

function applyParentVisible(checked: boolean): void {
  const live = engine.value;
  if (live && parentEid.value !== null && live.world.entities.wrap(parentEid.value).isValid()) {
    live.world.components.Renderable.visible[parentEid.value] = checked ? 1 : 0;
  }
}

function applyChildVisible(checked: boolean): void {
  const live = engine.value;
  if (live && childEid.value !== null && live.world.entities.wrap(childEid.value).isValid()) {
    live.world.components.Renderable.visible[childEid.value] = checked ? 1 : 0;
  }
}

function onOrbit(checked: boolean): void {
  orbit.enabled = checked;
}

function recycle(): void {
  const live = engine.value;
  if (!live || parentEid.value === null) {
    return;
  }
  const parent = live.world.entities.wrap(parentEid.value);
  if (parent.isValid()) {
    parent.destroy();
  }
  const ids = spawnPair(live);
  parentEid.value = ids.parentEid;
  childEid.value = ids.childEid;
  cycles.value += 1;
  live.world.components.Renderable.visible[ids.parentEid] = parentVisible.value ? 1 : 0;
  live.world.components.Renderable.visible[ids.childEid] = childVisible.value ? 1 : 0;
}
</script>
