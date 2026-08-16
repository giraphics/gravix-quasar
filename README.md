# gravix-quasar

Quasar CLI app for map and point-cloud visualisation, built on
[`@giraphics/gravix-engine`](https://www.npmjs.com/package/@giraphics/gravix-engine)
`0.1.0` from npm.

Three independent worlds (terrain, point cloud, parent/child hierarchy). This
repo is the **desktop/mobile** consumer. The React sibling is browser-only.

Electron and Capacitor modes are already added. You do not run `quasar mode add`
for them again.

## Browser (SPA)

```bash
cd C:\dev\giraphics\gravix-quasar
npm install
npm run dev
```

http://localhost:9000

Hash routing is on (required for Electron/Capacitor). Query flags:

| Query | Effect |
|---|---|
| `?backend=webgl` | Force WebGL2 |
| `?failDevice=1` | Fail WebGPU so the WebGL2 fallback is exercised |
| `?points=N` | Point-cloud capacity (default 300000) |

Works as `http://localhost:9000/?backend=webgl` or `http://localhost:9000/#/?backend=webgl`.

If WebGPU fails, use `?backend=webgl`.

## Desktop (Electron)

Already added. Dev window:

```bash
npx quasar dev -m electron
```

Packaged Windows app:

```bash
npx quasar build -m electron
```

Run the exe (portable folder, not an installer):

```
C:\dev\giraphics\gravix-quasar\dist\electron\Packaged\gravix-quasar-win32-x64\gravix-quasar.exe
```

`dist/` is gitignored. Do not commit it. Commit `src-electron/*.ts`, not
`src-electron/node_modules`.

## Mobile (Capacitor / Android)

Already added. App id is **`com.giraphics.gravix`** (not Quasar’s default
`org.capacitor.quasar.app`). Display name is `gravix-quasar`. Do not change the
id after you ship a store build.

### Do you need a phone?

No. On this Windows PC you need **Android Studio** and an **emulator**. A USB
phone is optional.

**iOS cannot be built on Windows.** Skip ` -T ios` here. That needs a Mac,
Xcode, and the iOS Simulator.

### First Android run

1. Android Studio installed, SDK + one Pixel AVD created.
2. From this repo:

   ```bash
   npx quasar dev -m capacitor -T android
   ```

3. **Pick External IP** — choose the **LAN** address (`192.168.x.x`, here
   `192.168.1.4`). Do **not** pick `172.27.x.x` (Hyper-V / WSL). A phone or
   emulator cannot reach that virtual adapter.
4. If Android Studio opens `src-capacitor\android`: that folder is correct.
   Wait until **Gradle import finishes**. Ignore **Add Configuration** until
   then. **No connected devices** means start the AVD from Device Manager
   first, then Run.
5. If the WebView is blank, Windows Firewall is blocking port **9000**. Allow
   Node / Quasar on private networks.

Live-reload talks to the SPA on that IP:9000. The emulator and the Quasar
dev server must stay running together.

### Production Android APK (later)

```bash
npx quasar build -m capacitor -T android
```

Then assemble/sign in Android Studio. Not required to prove the wrap.

## What not to commit

| Keep out of git | Why |
|---|---|
| `dist/` | Packaged Electron / SPA output |
| `src-electron/node_modules` | Electron’s own install |
| `src-capacitor/node_modules` | Capacitor’s own install |
| `src-capacitor/www` | Generated copy of the UI |
| `.quasar/` | CLI cache |

Commit app source, `quasar.config.ts`, `src-electron/*.ts`,
`src-capacitor/capacitor.config.ts`, and the Android project once Gradle has
generated it — not the `build/` intermediates if they appear.

## License

MIT
