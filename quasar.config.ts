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
      // Project Pages live at /gravix-quasar/. Hash routing already avoids the
      // history-mode 404 problem; this only prefixes the JS/CSS URLs.
      publicPath: process.env.GITHUB_PAGES === 'true' ? '/gravix-quasar/' : '/',

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
