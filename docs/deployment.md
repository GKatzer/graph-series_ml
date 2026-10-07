# Deployment

How the web side of Graph Series is deployed, rewritten from the original (Russian) `RUNBOOK.md`, and checked against `docker-compose.yml`, `nextjs/Dockerfile`, `inference/Dockerfile` and `scripts/`. **Nothing in this file was run in this environment** (no Docker, no private network, no second server); the steps describe what the files do. Placeholders in angle brackets (`<domain>`, `<api-host>`) are values to supply.

**Contents:** [Topology](#topology) · [Services](#services-in-docker-composeyml) · [Configuration](#configuration) · [First-time setup](#first-time-setup) · [Regular operations](#regular-operations) · [Troubleshooting](#troubleshooting) · [Known inconsistencies in the deployment files](#known-inconsistencies-in-the-deployment-files) · [Capturing the media](#capturing-the-media)

## Topology

Two servers on a private network:

| Server | Runs | Source |
|---|---|---|
| **web server** ("VDS2" in the scripts) | Qdrant, the Next.js app, the embedding service, a reverse proxy with TLS | this repository |
| **API server** ("VDS1") | the API and Neo4j | [`graph-series_backend`](https://github.com/GKatzer/graph-series_backend) |

The original setup uses Tailscale as the private network: Qdrant and the embedding service are reachable only over it, and the API server reaches them there. The only ports open to the internet are 80 and 443 (and 22 for SSH). The browser talks to the web server only; the reverse proxy sends `/api/backend/*` to the API server.

## Services in `docker-compose.yml`

| Service | Image / build | Published port | Purpose |
|---|---|---|---|
| `qdrant` | `qdrant/qdrant:v1.9.2` | `${PRIVATE_BIND_IP}:6333` (HTTP), `:6334` (gRPC) | vector index; volumes `qdrant_data`, `qdrant_snapshots`; telemetry disabled |
| `nextjs` | built from `nextjs/Dockerfile` (multi-stage, standalone output, runs as a non-root user), build arg `NEXT_PUBLIC_API_URL=/api/backend` | `127.0.0.1:3001` → container 3000 | the web interface |
| `inference` | built from `inference/Dockerfile` (Python 3.12, CPU `torch`, model downloaded at build time) | `${PRIVATE_BIND_IP}:8004` → container 8000 | `POST /embed`, `GET /health` |

All three share the `internal` bridge network. The private address comes from the variable `PRIVATE_BIND_IP` (read from a `.env` next to the compose file); compose refuses to start while it is unset.

The reverse proxy is **not** a service in this compose file (see [inconsistencies](#known-inconsistencies-in-the-deployment-files)). A minimal sketch of what it has to do, with Caddy as in the original setup (illustrative, **not run**):

```caddyfile
<domain> {
    handle_path /api/backend/* {      # strips the prefix: /api/backend/api/search -> /api/search
        reverse_proxy <api-host>:<api-port>
    }
    reverse_proxy 127.0.0.1:3001      # the nextjs container
}
```

## Configuration

| Name | Where | Meaning | Default |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | build time (`next.config.js`, Docker build arg, `lib/api.ts`) | base URL of the API as the browser sees it; inlined into the bundle | `/api/backend` |
| `PRIVATE_BIND_IP` | `.env` for `docker-compose.yml` | address on which Qdrant (6333, 6334) and the embedding service (8004) are published | none; required |
| `NODE_ENV`, `PORT` | `nextjs/Dockerfile`, compose `environment` | runtime mode and port of the standalone server | `production`, `3000` |
| `HOSTNAME` | `nextjs/Dockerfile` | listen address | `0.0.0.0` |
| `NEXT_TELEMETRY_DISABLED` | `nextjs/Dockerfile` | turns off Next.js telemetry | `1` |
| `QDRANT__SERVICE__HTTP_PORT`, `QDRANT__SERVICE__GRPC_PORT`, `QDRANT__TELEMETRY_DISABLED`, `QDRANT__STORAGE__SNAPSHOTS_PATH` | compose `environment` of `qdrant` | Qdrant settings | `6333`, `6334`, `true`, `/qdrant/snapshots` |
| `COLLECTION` (`graph-series`), `QDRANT_URL`, `BACKUP_DIR`, `KEEP_DAYS` | variables at the top of `scripts/backup_qdrant.sh` | collection name, REST address, backup folder, retention | `graph-series`, `http://localhost:6333`, a path under the install dir, `14` |
| `TAILSCALE_IF`, `QDRANT_PORT`, `QDRANT_GRPC_PORT` | variables at the top of `scripts/setup_tailscale_firewall.sh` | interface and ports for the firewall rules | `tailscale0`, `6333`, `6334` |
| `PROJECT_DIR`, branch argument | `scripts/deploy.sh` | install dir and branch to deploy | a path on the server, `main` |

`.env.example` in the repository root lists only `NEXT_PUBLIC_API_URL`: the earlier variables (`FRONTEND_DOMAIN`, `API_URL`, `QDRANT_COLLECTION`, `TAILSCALE_IP`) were not read by the compose file or by any code in this repository.

## First-time setup

1. **Clone** the repository on the web server into `<install-dir>`.
2. **Install Docker** and enable the service.
3. **Install Tailscale** (or another private network), bring it up, note the address: `tailscale ip -4`.
4. **Firewall.** `scripts/setup_tailscale_firewall.sh` (run as root) denies Qdrant's ports for everyone, allows them on the `tailscale0` interface only, opens 80/tcp, 443/tcp, 443/udp and 22/tcp, and **enables UFW** (`ufw --force enable`). It falls back to iptables rules when UFW is missing (those are not persistent).
5. **Set `PRIVATE_BIND_IP`** in `.env` (copy `.env.example`) to the host's private address, for example the output of `tailscale ip -4`.
6. **Systemd unit (optional).** `scripts/tvkg-vds2.service` is a `oneshot` unit that runs `docker compose up -d --remove-orphans` from the install dir at boot and `docker compose down` on stop. Copy it to `/etc/systemd/system/`, set `WorkingDirectory`, `systemctl daemon-reload`, `systemctl enable`.
7. **Start Qdrant first** (the collection must exist before the app is useful): `docker compose up -d qdrant`; check `curl http://localhost:6333/healthz`.
8. **Create the collection:**
   ```bash
   pip3 install qdrant-client==1.9.2     # must match the server version, see design-decisions.md
   python3 scripts/init_qdrant.py --host localhost            # add --recreate to rebuild
   ```
   It creates `graph-series` (384 dimensions, cosine, HNSW, int8 scalar quantisation) and payload indexes on `tmdb_id` and `name`.
9. **Tell the API server** where Qdrant and the embedding service are (its own `.env`, see the backend repository) and check from there: `curl http://<private-ip>:6333/healthz`.
10. **Load the data** from the machine that ran the ETL, with the private network up: `python qdrant_loader.py --recreate` in `graph-series_ETL` (point id = `tmdb_id`, about 211k points). `--recreate` makes the collection itself, so step 8 can be skipped for a full backfill.
11. **Build and start the app and the embedding service:** `docker compose up -d --build nextjs inference`.
12. **TLS and DNS.** Point the domain's A record at the web server and start the reverse proxy; check the site over HTTPS.

## Regular operations

- **Deploy a new version:** `bash scripts/deploy.sh <branch>`. It runs `git fetch` and **`git reset --hard origin/<branch>`** in the install dir (local changes are lost), rebuilds only the `nextjs` image with `--no-cache`, restarts it with `docker compose up -d --no-deps nextjs`, tries `caddy reload` (`|| true`), waits up to 60 s for a health check, and prunes dangling images. The script says it is meant to be called from GitHub Actions over SSH; no workflow file exists in this repository.
- **Back up Qdrant:** `bash scripts/backup_qdrant.sh` creates a snapshot through the REST API, downloads it into the backup folder, deletes it from Qdrant and removes backups older than 14 days. Suggested schedule: weekly, e.g. `0 3 * * 0` in root's crontab.
- **Logs:** `docker compose logs -f [nextjs|qdrant|inference]`; with the unit installed, `journalctl -u tvkg-vds2 -f`.
- **Restart:** `systemctl restart tvkg-vds2` or `docker compose restart nextjs`.
- **Collection status:** `curl -s http://localhost:6333/collections/graph-series`.

## Troubleshooting

| Symptom | Check |
|---|---|
| no TLS certificate | the domain's A record points at this server; ports 80 and 443 are open (`ufw status`); the reverse proxy's logs |
| API server cannot reach Qdrant | `tailscale status` on both; `curl http://<private-ip>:6333/healthz` from the API server; UFW allows 6333 on `tailscale0` |
| the app does not start | `docker compose logs nextjs`; the usual cause is `NEXT_PUBLIC_API_URL` missing at build time |
| empty collection after loading | `curl -s http://localhost:6333/collections/graph-series` and read `vectors_count` |
| the interface shows `Search failed (HTTP 500), try again` for `structural` or person search | the full-text indexes are missing: re-run `scripts/schema_init.cypher` on the API server (backend repository), check `SHOW INDEXES` for `series_name_idx` and `person_name_idx` in state `ONLINE`; call the API with `curl` to see the status |

## Known inconsistencies in the deployment files

Found while checking the files against each other; the files were not changed.

1. **No reverse-proxy service or config here.** The compose header, the old runbook, `scripts/tvkg-vds2.service` (`ExecReload`) and `scripts/deploy.sh` mention a `caddy` service and a `caddy/Caddyfile`; `docker-compose.yml` defines none and the repository has no `caddy/` folder. `caddy reload` in `deploy.sh` is guarded by `|| true`; the unit's `ExecReload` is not.
2. **`/api/healthz` does not exist in the app.** The compose health check and `deploy.sh` poll it, and the old runbook lists `app/api/healthz/route.ts`, but `nextjs/app/` has no `api/` folder (the public site answers 404 for that path, checked 2026-10-04, [`live-errors-2026-10-04.txt`](examples/live-errors-2026-10-04.txt)).
3. **Port mismatch.** `deploy.sh` polls `localhost:3000`; the compose file publishes the app on `127.0.0.1:3001`.
4. **Stale comments** next to Qdrant's ports say "localhost only" while the address is the private interface. (The private address used to be hard-coded in three port mappings; it is now `PRIVATE_BIND_IP`.)
5. **Default branch.** `deploy.sh` defaults to `main`; this repository's branch is `master`, so the branch has to be passed explicitly.
6. **Variables in the old `.env.example` were unused** (see [Configuration](#configuration)); the file now documents `NEXT_PUBLIC_API_URL` only.

## Capturing the media

The screenshots and GIFs in `media/` come from `examples/capture-media.mjs`, run against a production build of this app whose `/api/backend` is forwarded, read-only, to the public deployment by `examples/dev-proxy.mjs`:

```bash
cd nextjs && npm ci && npm run build
NEXT_TELEMETRY_DISABLED=1 npm start &                  # :3000; Next warns that `next start` is not for standalone output, it still serves
node ../docs/examples/dev-proxy.mjs &                  # :3100, GET only, LIVE_HOST=<site> to change the target
cd /tmp && mkdir pw && cd pw && npm i playwright-core  # needs Chrome/Chromium and ffmpeg on the machine
PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs TMPDIR=/tmp/gsc \
  node <repo>/docs/examples/capture-media.mjs all      # or: shots | mobile | gifs
```

Do not run `next dev` in the same folder between `npm run build` and the capture: it overwrites `.next` and the pages lose their styles. A short `TMPDIR` is needed because Chrome's socket path has a length limit. Playwright's own video recorder was not used (it needs a separate ffmpeg download); the GIFs are stitched from screenshots with the system `ffmpeg`.
