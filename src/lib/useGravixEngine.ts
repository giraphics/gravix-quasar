import { GravixEngine, type GravixEngineOptions } from '@giraphics/gravix-engine';
import { BabylonBackend } from '@giraphics/gravix-engine/babylon';
import { onBeforeUnmount, onMounted, shallowRef, type Ref, type ShallowRef } from 'vue';

import { readLaunchOptions } from './options';

export function useGravixEngine(
  canvas: Ref<HTMLCanvasElement | null>,
  configure: (engine: GravixEngine) => void | Promise<void>,
  extraOptions?: Pick<GravixEngineOptions, 'clearColor' | 'sceneName' | 'systems'>,
): { engine: ShallowRef<GravixEngine | null> } {
  const engine = shallowRef<GravixEngine | null>(null);
  let cancelled = false;
  let created: GravixEngine | undefined;

  onMounted(() => {
    const el = canvas.value;
    if (!el) {
      return;
    }

    const launch = readLaunchOptions();

    void (async () => {
      const backend = new BabylonBackend();
      const next = await GravixEngine.create(backend, {
        canvas: el,
        preference: launch.preference,
        failDeviceCreation: launch.failDeviceCreation,
        ...extraOptions,
      });
      if (cancelled) {
        next.dispose();
        return;
      }
      await configure(next);
      if (cancelled) {
        next.dispose();
        return;
      }
      created = next;
      next.start();
      engine.value = next;
    })().catch((error: unknown) => {
      console.error('GravixEngine failed to start', error);
    });
  });

  onBeforeUnmount(() => {
    cancelled = true;
    created?.dispose();
    engine.value = null;
  });

  return { engine };
}
