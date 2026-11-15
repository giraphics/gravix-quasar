<template>
  <div class="panel-grid">
    <TerrainPanel />
    <PointCloudPanel />
    <HierarchyPanel />
    <TrafficPanel />
  </div>
</template>

<script setup lang="ts">
import HierarchyPanel from '@/components/HierarchyPanel.vue';
import PointCloudPanel from '@/components/PointCloudPanel.vue';
import TerrainPanel from '@/components/TerrainPanel.vue';
import TrafficPanel from '@/components/TrafficPanel.vue';
</script>
