# API used by the interface, and the other services in this repository

The interface is a client of [`graph-series_backend`](https://github.com/GKatzer/graph-series_backend); the server side of these endpoints is documented there. This page lists what `nextjs/lib/api.ts` calls, with real responses captured from the public deployment on 2026-10-04 (read-only `GET`s, trimmed; files in [`examples/`](examples/)).

All calls are `GET`, go to `${NEXT_PUBLIC_API_URL}` (default `/api/backend`) and fail with `Error("API <status>: <body>")` on a non-2xx answer. Defaults for `limit` come from `lib/constants.ts`.

## Endpoints called by the UI

| Method | Path | Query | UI default | Used by |
|---|---|---|---|---|
| GET | `/api/search` | `q`, `mode` = `semantic` \| `structural` \| `hybrid`, `limit` | `limit` 20 (search page), 8 (explore dropdown) | search, explore |
| GET | `/api/search/persons` | `q`, `limit` | 20 (search page), 8 (explore) | search, explore |
| GET | `/api/series/{tmdb_id}` | | | series page, similar page header |
| GET | `/api/series/{tmdb_id}/similar` | `mode` = `semantic` \| `hybrid`, `limit` | `hybrid`, `limit` 20 (always sent by the client) | similar page |
| GET | `/api/graph/series/{tmdb_id}` | `depth` = 1 \| 2 | 1 | mini graphs, explore expansion (depth 1) |
| GET | `/api/person/{person_id}` | | | person page, search (person mode) |
| GET | `/api/person/{person_id}/graph` | | | person page graph, explore expansion |
| GET | `/api/graph/node/{type}/{key}` | `limit` | 50 | explore expansion of genre, keyword, network, country, language (`type` is the lower-case label; `key` is URL-encoded) |

`GET /health` exists on the backend (`{"status": "ok", "uptime_s": …}`) but the UI does not call it.

## Real responses

**Health** ([`health.json`](examples/health.json)):

```bash
curl -s https://graph-series.katzer.ru/api/backend/health
```
```json
{"status":"ok","uptime_s":1135596}
```

**Semantic search** ([`search-semantic-space-western.json`](examples/search-semantic-space-western.json); overviews shortened):

```bash
curl -s 'https://graph-series.katzer.ru/api/backend/api/search?q=space%20western&mode=semantic&limit=3'
```
```json
{
  "query": "space western",
  "mode": "semantic",
  "results": [
    {
      "tmdb_id": 30991, "name": "Cowboy Bebop", "start_year": 1998, "end_year": 1999,
      "episode_count": 26, "season_count": 1, "overview": "In 2071, roughly fifty years after …",
      "poster_path": "/xDiXDfZwC6XYC6fxHI1jl3A3Ill.jpg", "vote_average": 8.5, "vote_count": 2026,
      "popularity": 38.3139, "score": 0.7173728942871094,
      "shared_actors": null, "shared_countries": null, "source": "vector"
    },
    …
  ],
  "total": 3
}
```

**Series detail** ([`series-1396.json`](examples/series-1396.json), keywords and overview shortened): `GET /api/series/1396` returns identifiers (`tmdb_id`, `imdb_id`, `wikidata_id`, `tvdb_id`), years, `status`, `type`, counts, rating fields, `overview`, `tagline`, `poster_path`, `genres`, `keywords`, `countries` (ISO codes), `languages` (ISO codes), `networks[]`, `creators[]`, `directors[]`. Genre names came back in English on this date (the type comment in `lib/types.ts` says "localized names (ru)" and the Methodology page says Russian; both are out of date for the deployment checked).

**Graph** ([`graph-series-1396-depth1.json`](examples/graph-series-1396-depth1.json) shows the first 4 nodes and edges; [`…counts.json`](examples/graph-series-1396-depth1.counts.json) the totals): `GET /api/graph/series/1396?depth=1` returned 66 nodes (1 series, 29 persons, 29 keywords, 2 genres, 3 languages, 1 network, 1 country) and 67 edges. A node:

```json
{ "id": "series:1396", "key": 1396, "label": "Series", "name": "Breaking Bad",
  "properties": { "start_year": 2008, "poster_path": "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", "vote_average": 8.952, "popularity": 227.4384 } }
```

Edges have `source`, `target` (node ids) and `type` (`ACTED_IN`, …). Hub nodes (`/api/graph/node/genre/18`) carry the total in `properties.total` (`total` 23,928 for genre 18 at capture time).

**Similar, hybrid** ([`similar-1396-hybrid.json`](examples/similar-1396-hybrid.json), first 3 of 5 requested): scores were 1.0208, 0.8991 and 0.8796 for the first three, all `source: "vector"`, `shared_actors` and `shared_countries` null. A hybrid score is the cosine score plus structural bonuses, so it can exceed 1; the page shows it as `hybrid score 1.02` (it used to be shown as "102 % semantic").

**Person** ([`person-17419.json`](examples/person-17419.json)): `{ "person_id": 17419, "name": "Bryan Cranston", "series": [{ "tmdb_id", "name", "start_year", "role": "ACTED_IN" | "CREATED" | "DIRECTED" }, …] }`; 22 series for this person.

## Failures observed on the public deployment

On 2026-10-04 `structural` search and person search answered **HTTP 500** with the body `Internal Server Error` for every query tried (`breaking bad`, `cranston`, `tom`, `Friends`), while `semantic`, `hybrid`, series, person, similar and graph endpoints answered 200. A query shorter than two characters answers 422 with a validation message. Raw transcript: [`examples/live-errors-2026-10-04.txt`](examples/live-errors-2026-10-04.txt).

Cause and fix (confirmed by the owner the same day): the full-text indexes `series_name_idx` and `person_name_idx` did not exist in Neo4j; they are created only by the backend's `scripts/schema_init.cypher`, which must be re-run after every graph reload. After running it both modes answered 200 (`structural` for `breaking` returned *Breaking New Ground* and *Breaking Bad*; `persons?q=cranston` returned Bryan Cranston with `series_count` 17). The first request right after creation still returned 500 while the indexes were `POPULATING`.

Timings from this machine on 2026-10-04: most requests 1.3 to 3 s; one hub-graph request 12 s, one hybrid request 11 s, and an earlier hybrid request timed out after 20 s.

## Embedding service (`inference/`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/embed` | `{"text": "<string>", "is_query": true}` | `{"vector": [ … 384 floats … ]}` |
| GET | `/health` | | `{"status": "ok", "model": "BAAI/bge-small-en-v1.5", "loaded": true}` |

Run locally and checked on 2026-10-04 (details in [architecture.md](architecture.md#inference-service-inferencemainpy)).

## Scripts (`scripts/`)

| Script | What it does | Arguments |
|---|---|---|
| `init_qdrant.py` | creates the `graph-series` collection and two payload indexes | `--host` (default `localhost`), `--port` (6333), `--recreate` |
| `backup_qdrant.sh` | snapshot, download, delete the snapshot, rotate backups | none |
| `deploy.sh` | pull, rebuild and restart the app | branch (default `main`) |
| `setup_tailscale_firewall.sh` | UFW (or iptables) rules for Qdrant | none |
| `tvkg-vds2.service` | systemd unit that runs `docker compose up -d` | |

See [deployment.md](deployment.md) for how they fit together.
