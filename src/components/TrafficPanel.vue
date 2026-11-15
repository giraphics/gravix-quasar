<template>
  <q-card class="bg-grey-10">
    <canvas ref="canvas" class="gravix-canvas" />
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div>Simulator</div>
        <input
          v-model="address"
          class="address-input"
          type="text"
          spellcheck="false"
          placeholder="ws://127.0.0.1:8081"
          :disabled="live"
          @keyup.enter="connect"
        />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Scenario</div>
        <select v-model="scenario" class="demo-select" :disabled="live">
          <option v-for="name in SCENARIOS" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Vehicles</div>
        <select v-model.number="vehicles" class="demo-select" :disabled="live">
          <option v-for="n in VEHICLE_CHOICES" :key="n" :value="n">{{ n.toLocaleString() }}</option>
        </select>
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Vehicle size {{ size }}</div>
        <q-slider
          v-model="size"
          :min="1"
          :max="6"
          :step="1"
          snap
          class="q-ml-md"
          style="width: 190px"
          @update:model-value="onSize"
        />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Paused</div>
        <q-toggle
          v-model="paused"
          dense
          :disable="status !== 'connected'"
          @update:model-value="onPaused"
        />
      </div>
      <div class="row items-center justify-between q-mb-sm">
        <div>Status: {{ status }}<span v-if="message"> — {{ message }}</span></div>
        <q-btn
          v-if="live"
          dense
          unelevated
          color="grey-8"
          label="Disconnect"
          @click="disconnect"
        />
        <q-btn v-else dense unelevated color="primary" label="Connect" @click="connect" />
      </div>
      <div class="stats">{{ stats }}</div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { GravixEngine } from '@giraphics/gravix-engine';
import { computed, onUnmounted, ref } from 'vue';

import { readLaunchOptions } from '../lib/options';
import { createTraffic, type TrafficWorld } from '../lib/traffic';
import { useGravixEngine } from '../lib/useGravixEngine';

const SCENARIOS = ['grid-small', 'grid-city', 'grid-stress'];
const VEHICLE_CHOICES = [20, 200, 1000, 5000];

const canvas = ref<HTMLCanvasElement | null>(null);
const launch = readLaunchOptions();
const address = ref(launch.sim || 'ws://127.0.0.1:8081');
const scenario = ref('grid-city');
const vehicles = ref(200);
const size = ref(3);
const paused = ref(false);
const status = ref('disconnected');
const message = ref('');
const stats = ref('starting…');
const live = computed(() => status.value === 'connected' || status.value === 'connecting');

let world: TrafficWorld | null = null;

const { engine } = useGravixEngine(
  canvas,
  (next: GravixEngine) => {
    world = createTraffic(
      next,
      launch.sim ? { url: launch.sim, scenario: scenario.value, vehicles: vehicles.value } : null,
    );
  },
  { clearColor: [0.03, 0.05, 0.06, 1], sceneName: 'traffic' },
);

const timer = window.setInterval(() => {
  const live = engine.value;
  if (!live || !world) {
    return;
  }
  const s = world.snapshot() as Record<string, number | string | boolean>;
  status.value = String(s.status);
  message.value = String(s.message ?? '');
  paused.value = s.paused === true;
  const e = live.getStats();
  const base = `backend ${live.backendKind} · fps ${e.fps.toFixed(0)} · frame ${live.world.time.frame} · verts ${Number(s.verts).toLocaleString()} · resources ${live.world.resources.size()}`;
  stats.value =
    s.status === 'connected'
      ? `${base} · sim ${Number(s.streamFps).toFixed(1)} Hz · tick ${Number(s.tick).toLocaleString()} · ${Number(s.vehicles).toLocaleString()} vehicles · latency ${Number(s.latencyMs).toFixed(1)} ms`
      : `${base} · sim ${s.status}`;
}, 250);

onUnmounted(() => {
  window.clearInterval(timer);
  world?.dispose();
  world = null;
});

function connect(): void {
  world?.invoke('connect', [address.value.trim(), scenario.value, vehicles.value, 1]);
}

function disconnect(): void {
  world?.invoke('disconnect', []);
}

function onPaused(value: boolean): void {
  world?.invoke('setPaused', [value]);
}

function onSize(value: number | null): void {
  world?.invoke('setVehicleSize', [value ?? 3]);
}
</script>
