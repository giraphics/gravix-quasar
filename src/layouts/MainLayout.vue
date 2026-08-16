<template>
  <q-layout view="hHh lpR fFf" class="bg-dark text-white">
    <q-header class="bg-dark q-px-md q-py-sm" bordered>
      <div class="row items-baseline q-gutter-md">
        <div class="text-subtitle2">gravix-quasar</div>
        <div class="page-hint">
          Three worlds, one npm package. Terrain, a streaming point cloud, and a parent/child
          hierarchy. <code>?backend=webgl</code> forces WebGL2;
          <code>?failDevice=1</code> exercises the fallback; <code>?points=N</code> sets cloud
          capacity.
        </div>
      </div>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts"></script>
