# Our Home Folder — iOS shell

Capacitor wrapper that ships the production web app (`https://ourhomefolder.com`)
in the App Store. Remote-URL mode: the shell loads the live site and injects the
native bridge, so site deploys reach the app instantly — no App Store release
needed for web changes. Native releases are only needed when the shell itself
changes (plugins, icons, permissions).

**Rulings (2026-08-05):** account-based app — no purchase flow, no checkout
links, no IAP (Apple 3.1.1). Capacitor over native. iPhone + iPad at v1.

## Layout

- `capacitor.config.ts` — app id `com.jbranllc.ourhomefolder`, remote URL,
  allowed navigation (ourhomefolder.com, Supabase auth).
- `shell/` — offline fallback page only; the real UI is the deployed site.
- `ios/` — generated Xcode project (`ios/App/App.xcworkspace`). Pods and build
  output are git-ignored; `Info.plist` carries the camera / Face ID / photo
  usage strings and the export-compliance flag.

The web-side counterpart lives in `apps/web`: `lib/native.ts` (bridge helpers),
`components/NativeShell.tsx` (Face ID app lock + settings card), and shell
gating in `pricing.tsx`, `pro.tsx`, `portfolio.tsx`, `sign-in.tsx`,
`sign-up.tsx`.

## Working on the shell

```bash
corepack pnpm install --filter @home-folder/mobile   # from repo root
cd apps/mobile
npx cap sync ios          # after changing config or plugins
npx cap open ios          # opens Xcode
```

CocoaPods is installed via Homebrew. If `pod install` crashes with a Unicode
error, export `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first (the repo path
contains a space and CocoaPods' Ruby needs a UTF-8 locale).

## One-time setup that needs the Apple Developer account

1. **Xcode signing** — open the workspace, select the App target → Signing &
   Capabilities → team = JBran LLC. Add capability “Sign in with Apple”.
2. **Supabase Apple provider** — Authentication → Providers → Apple: create the
   Services ID + key at developer.apple.com, and add
   `com.jbranllc.ourhomefolder` to **Authorized Client IDs** (the native flow
   exchanges the identity token via `signInWithIdToken`).
3. **Show the Apple button** — set `NEXT_PUBLIC_OAUTH_PROVIDERS=google,apple`
   on the Worker build once (2) is live. Until then the button stays hidden by
   the same both-sides gate Google uses.
4. **Push notifications (deferred)** — needs an APNs key; registration helpers
   exist in `lib/native.ts` but no UI ships in v1.

## Behavior differences inside the shell

- Purchase/checkout CTAs are hidden (pricing, pro, portfolio) with truthful
  in-app copy; plans bought on the web work in full.
- Google sign-in button is hidden — Google refuses OAuth in embedded webviews
  (`disallowed_useragent`). Apple + email remain.
- Optional Face ID app lock (Settings → App lock), per-device, re-locks after
  30s in the background.
- Photo capture uses the native camera sheet via the existing
  `<input capture>` elements — no plugin call needed.
