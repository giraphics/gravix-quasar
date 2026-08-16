// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app';

export default defineConfig(() => {
  return {
    boot: ['dark'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons'],

    build: {
      typescript: {
        strict: true,
        vueShim: true,
      },

      vueRouterMode: 'hash',

      extendViteConf(viteConf) {
        viteConf.optimizeDeps ??= {};
        viteConf.optimizeDeps.include = [
          ...(viteConf.optimizeDeps.include ?? []),
          '@babylonjs/core',
        ];
        viteConf.optimizeDeps.exclude = [
          ...(viteConf.optimizeDeps.exclude ?? []),
          '@giraphics/gravix-engine',
        ];
      },
    },

    devServer: {
      port: 9000,
      open: false,
    },

    framework: {
      config: {
        dark: true,
      },
      plugins: ['Dark'],
    },

    animations: [],

    ssr: {
      prodPort: 3000,
      middlewares: ['render'],
    },

    pwa: {
      workboxMode: 'GenerateSW',
    },

    capacitor: {
      hideSplashscreen: true,
    },

    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'packager',
      packager: {},
      builder: {
        appId: 'gravix-quasar',
      },
    },

    bex: {
      extraScripts: [],
    },
  };
});
