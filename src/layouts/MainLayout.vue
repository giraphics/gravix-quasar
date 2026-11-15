<template>
  <q-layout view="hHh lpR fFf" class="bg-dark text-white">
    <q-header class="bg-dark q-px-md q-py-sm" bordered>
      <div class="row items-baseline q-gutter-md">
        <div class="text-subtitle2">gravix-quasar</div>
        <div class="page-hint">
          Four worlds, one npm package. Terrain, a Lorenz attractor or bouncing box, a
          parent/child hierarchy, and live traffic from gravix-sim-backend. <code>?backend=webgl</code> forces WebGL2;
          <code>?failDevice=1</code> exercises the fallback; <code>?points=N</code> sets cloud
          capacity; <code>?sim=ws://host:8081</code> connects the traffic card. Drag the point canvas to orbit.
        </div>
      </div>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts"></script>
