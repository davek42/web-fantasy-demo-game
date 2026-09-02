# Deploying Fantasy Realm

Target: the Lightsail box described in
`~/dev/docs/projects/AWS-Lightsail-production/Lightsail_Production.md`
(`ssh market-intel`, Ubuntu 24.04, nginx, 416 MiB RAM).

Fantasy Realm is a **pure static site**: one `index.html`, one JS bundle, one
stylesheet, all produced by `bun run build`. There is no backend, no PM2
process, no API port, and nothing to firewall. On the host it behaves like
`seaworth-games` and `odd-data`, not like the `*-api` apps.

It is mounted as a **subpath of seaworthgames.com**:

    https://www.seaworthgames.com/fantasy-realm/

using the same snippet hook that `/seinfeld/` and `/18royalgorge/` use. That
means no new domain, no new certificate, and no new Lightsail firewall port.

| Item | Value |
|------|-------|
| URL | `https://www.seaworthgames.com/fantasy-realm/` (no-slash form 301s here) |
| Web root on host | `/var/www/fantasy-realm/` (the contents of `dist/`) |
| nginx wiring | `/etc/nginx/snippets/seaworth-extra-fantasy-realm.conf` |
| Source of truth for that snippet | `deploy/nginx-fantasy-realm.conf` in this repo |
| Process manager | none (static) |
| Health check | content check, see Monitoring |

---

## 0. One-time setup (first deploy only)

1. **Create the web root** on the host and make it writable by `ubuntu` so
   later deploys need no sudo:

   ```sh
   ssh market-intel 'sudo mkdir -p /var/www/fantasy-realm && sudo chown ubuntu:www-data /var/www/fantasy-realm'
   ```

2. **Install the nginx snippet.** Before copying, open
   `deploy/nginx-fantasy-realm.conf` and paste the site-wide `add_header`
   lines from `sites-available/seaworth-games` at the two markers. nginx
   replaces, rather than merges, `add_header` in a more specific location, so
   any header you leave out silently disappears for this subpath (the
   production doc's 18royalgorge section explains the trap). Keep this file's
   `Content-Security-Policy` line: the site-wide `script-src 'none'` would
   blank the game. To see what the site currently sends:

   ```sh
   ssh market-intel 'grep -n add_header /etc/nginx/sites-available/seaworth-games /etc/nginx/snippets/seaworth-extra-18royalgorge.conf'
   ```

   Then copy it into place and reload:

   ```sh
   scp deploy/nginx-fantasy-realm.conf market-intel:/tmp/seaworth-extra-fantasy-realm.conf
   ssh market-intel 'sudo mv /tmp/seaworth-extra-fantasy-realm.conf /etc/nginx/snippets/ && sudo nginx -t && sudo systemctl reload nginx'
   ```

   `nginx -t` must pass before the reload; if it fails, nothing has changed
   yet, so fix the snippet and retry.

3. Confirm the include hook exists (it should, both other subpaths rely on it):

   ```sh
   ssh market-intel 'grep -n "seaworth-extra-" /etc/nginx/sites-available/seaworth-games'
   ```

---

## 1. Build

The game must be built with the subpath as its base so asset URLs resolve to
`/fantasy-realm/assets/...`. The dev server is unaffected.

```sh
bun install
bun test                                    # engine tests must be green
bun run build -- --base=/fantasy-realm/
grep -o 'src="[^"]*"' dist/index.html       # expect src="/fantasy-realm/assets/main-....js"
```

Output is `dist/` (about 630 KB, 165 KB gzipped). Asset filenames are
content-hashed, which is why nginx may cache them for a year.

---

## 2. Ship

```sh
rsync -avz --delete dist/ market-intel:/var/www/fantasy-realm/
```

`--delete` removes old hashed bundles so the web root only ever holds the
current release. No nginx reload is needed for a content-only deploy; the
snippet only changes when `deploy/nginx-fantasy-realm.conf` changes (then
repeat step 0.2).

---

## 3. Verify

Status codes are not a health signal on this host: if the snippet is ever
missing, `/fantasy-realm/` falls through to the seaworthgames landing page
with a **200**. Check content.

```sh
# 1 = the game is being served, 0 = fallen through to the landing page
curl -s https://www.seaworthgames.com/fantasy-realm/ | grep -c "Fantasy Realm"

# the bundle must load (200) and be served immutable
curl -sI "https://www.seaworthgames.com$(curl -s https://www.seaworthgames.com/fantasy-realm/ | grep -o '/fantasy-realm/assets/main-[^"]*\.js')" | grep -Ei 'HTTP/|cache-control'

# the slash-less URL must redirect (301) to the canonical one, not fall through
curl -sI https://www.seaworthgames.com/fantasy-realm | grep -Ei 'HTTP/|location:'

# the security headers must still be present on the subpath
curl -sI https://www.seaworthgames.com/fantasy-realm/ | grep -Ei 'content-security-policy|strict-transport|x-frame'

# the rest of the domain must be untouched
curl -s https://www.seaworthgames.com/seinfeld/ | grep -c "About Trivia"
curl -s https://www.seaworthgames.com/18royalgorge/ | grep -c "Table password"
```

Then open the URL in a browser: the board must render with pieces and the
console must show `✅ skirmish ready` and no CSP errors. A CSP violation
shows as a blank dark page with `Refused to load the script` in the console;
that means the snippet's CSP line was lost or overridden.

---

## Rollback

Every release is a git commit, so rollback is a rebuild:

```sh
git checkout <previous-commit-or-tag>
bun run build -- --base=/fantasy-realm/
rsync -avz --delete dist/ market-intel:/var/www/fantasy-realm/
git checkout main
```

Tagging deploys (`git tag deploy-2026-09-02`) makes the previous release easy
to find.

To take the game down entirely, remove the snippet and reload nginx; the
subpath then falls through to the landing page (with a 200, see above).

---

## Monitoring

Add to the Monitoring section of `Lightsail_Production.md`, in the content
checks group:

```sh
# Fantasy Realm (static, subpath): 1 = healthy, 0 = fallen through to the landing page
curl -s https://www.seaworthgames.com/fantasy-realm/ | grep -c "Fantasy Realm"
```

No `pm2 list` change: the count stays at 5. No memory impact: nginx serves
files from disk.

---

## Gotchas

- **Build base.** Forgetting `--base=/fantasy-realm/` produces `src="/assets/..."`,
  which the seaworthgames `location /` will answer with the landing page
  (200), leaving a blank game and no 404 to notice. The `grep` in step 1 is
  the guard.
- **Headers replace, they do not merge.** Both `location` blocks in the
  snippet must carry the full site-wide header list plus this app's CSP.
- **CSP needs `style-src 'unsafe-inline'`.** The HUD sets HP bar widths with
  inline `style` attributes; the module script itself is fine with `'self'`.
- **Assets are cached immutable.** Only hashed files under `/assets/` are;
  `index.html` is not, so a new build is picked up on the next load.
- **Same 200-instead-of-404 trap as the other subpaths.** Monitor on content.
- **Link with the trailing slash.** `location ^~ /fantasy-realm/` does not match
  `/fantasy-realm`; the snippet's `location = /fantasy-realm` 301s it to the
  slash form as a safety net, but links from the landing page should use
  `/fantasy-realm/` directly and skip the round trip.
- **Nothing here touches PM2, php-fpm, certificates, or the firewall.** If a
  deploy seems to need any of those, something is wrong with the plan, not
  the host.
