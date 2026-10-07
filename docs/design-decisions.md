# Design decisions

The decisions that shape this repository, with the reason where the code or its comments give one. Where the code does not say why, the entry says what the choice buys and is marked *(inferred from the code)*. Nothing here is taken from old design documents.

**Contents:** [Queries are embedded with the BGE instruction, documents are not](#queries-are-embedded-with-the-bge-instruction-documents-are-not) · [Node ids are `label:key`](#node-ids-are-labelkey) · [Same-origin API path](#the-browser-only-talks-to-the-same-origin-apibackend) · [Two graph renderers](#two-graph-renderers-and-a-3d-view) · [Explore keeps Cytoscape as source of truth](#explore-keeps-cytoscape-as-the-source-of-truth) · [Hand-written touch and keyboard handling](#hand-written-touch-and-keyboard-handling) · [No global store](#no-global-store-versioned-localstorage) · [Constants in one file](#all-tunable-values-live-in-libconstantsts) · [Qdrant setup](#qdrant-collection-settings) · [Index wider than the graph](#the-vector-index-is-wider-than-the-graph) · [Standalone Next.js build](#standalone-nextjs-build) · [Changed or dropped](#changed-or-dropped-along-the-way)

## Queries are embedded with the BGE instruction, documents are not

`BAAI/bge-small-en-v1.5` is trained for asymmetric retrieval: a short query is encoded with the instruction `Represent this sentence for searching relevant passages: `, while passages are encoded as they are. The documents in Qdrant (title, overview and keywords of each series) were embedded without the instruction, so a query must add it. `inference/main.py` does that for `is_query: true` and skips the prefix if the caller already added one (`startswith` guard), so calling it twice cannot double the instruction. The backend does not load the model; it calls this service, which keeps the heavy dependency (`torch` in its CPU build and the model weights) out of the API image. *(The separation is inferred from the code; the instruction handling is in the file's docstring.)*

## Node ids are `label:key`

TMDB ids of different entities collide (Series 1399 and Person 1399). Earlier versions keyed nodes by Wikidata Q-ids; the migration to TMDB replaced them with `label:key` ids that are unique across labels and that carry the label for free, so a stored id tells which API to call. Routes and API calls still use the native key. Consequence: persisted state from the old scheme is unusable, so the `localStorage` keys got a `-v2` suffix and the old keys are deleted on load rather than showing dead entries. Details: [architecture.md](architecture.md#graph-node-ids).

## The browser only talks to the same-origin `/api/backend`

`NEXT_PUBLIC_API_URL` defaults to `/api/backend`, and a reverse proxy on the web server forwards that path to the API server. The comment in `next.config.js` gives the reason: the browser never has to deal with the API server's own (self-signed) certificate. It also means no CORS configuration for the deployed site. The value is inlined at build time, so changing it needs a rebuild (it is a Docker build argument in the compose file).

## Two graph renderers, and a 3D view

| Where | Library | What it buys *(inferred from the code)* |
|---|---|---|
| `/explore` canvas | Cytoscape.js with `cola` and `dagre` | four layouts (force, hierarchy, circle, concentric), a style sheet with selectors (`node.expandable`, `edge[type="…"]`), element JSON that can be saved to and restored from `localStorage`, `closedNeighborhood()` for hover highlighting |
| mini graphs on search, series, person, similar | `react-force-graph-2d` | a light, self-organising canvas for a read-only picture of one neighbourhood; all painting is custom (`paintNode`, `paintLink`) so that size, glow, dimming and labels follow `constants.ts` |
| 3D toggle on `/explore` | `react-force-graph-3d` (three.js) | a different view of the same nodes and edges, without any interaction logic |

## Explore keeps Cytoscape as the source of truth

The canvas is the model; React state is a derived copy refreshed by `syncFromCy()`. Expanding a node *merges* the response into the existing graph (ids already present are skipped) and re-runs the layout, so the picture grows instead of being redrawn, and a node's `expanded` status is tracked in a set that is saved with the graph. Removing a node also removes neighbours that would be left with no edges, so deleting a series does not leave a cloud of orphans.

Dragging a node re-runs the layout with a shorter simulation (`FORCE_SETTLE_OPTS`, 400 ms against 1,400 ms for a full run), so a nudge settles quickly without reshuffling the whole picture.

## Hand-written touch and keyboard handling

Three places replace library behaviour, each with its reason in a code comment:

- **Click on a mini graph node.** `react-force-graph`'s `onNodeClick` only fires for a node that is "hovered" at pointer-up, and a touch screen never hovers first, so taps were ignored. `BaseGraph` converts the click position to graph coordinates and picks the nearest node itself, ignoring pointer movement above 6 px (a drag or pan is not a tap).
- **Double-tap on `/explore`.** Cytoscape's `dbltap` was unreliable (especially on touch), so two taps on the same node within 350 ms are detected manually.
- **Node navigator.** A flat list of the hierarchy in display order, duplicates included, is walked by index. Walking by node id would jump back to the first occurrence when a node appears under more than one parent. Keyboard callbacks are kept in a ref (`gnNavRef`) so the single window listener never sees stale closures.

## No global store, versioned `localStorage`

Each page owns its state; the explore list and the saved graph are the only things shared across pages, and they are plain `localStorage` with a small event layer (same-tab `CustomEvent`, cross-tab `storage`). The explore list and the explore graph are independent on purpose: `clear graph` wipes the picture, never the bookmarks. Panel widths and collapsed states are stored per panel, so a workspace survives reloads.

## All tunable values live in `lib/constants.ts`

Colours, sizes, physics, layout options, zoom limits, API limits, timings, storage keys and panel sizes are in one file, and no other file hard-codes them (stated at the top of the file). The practical effect: restyling the graph or changing a debounce is a one-file change.

## "Mobile" means narrow and portrait

`useIsMobile` requires a viewport below 768 px **and** portrait orientation. A phone in landscape is wide enough for the desktop layout, which the comment calls the "more robust" one, instead of the cramped portrait variant. The hook returns `false` during SSR and the first paint, then updates, so no hydration mismatch occurs.

## Qdrant collection settings

Set in `scripts/init_qdrant.py` (the ETL's `qdrant_loader.py --recreate` also creates the collection):

| Setting | Value | Reason given in the file |
|---|---|---|
| vector size, distance | 384, cosine | `bge-small-en-v1.5` |
| HNSW | `m=16`, `ef_construct=100`, `full_scan_threshold=10,000` | "standard for hundreds of thousands of points" |
| quantisation | scalar int8, quantile 0.99, always in RAM | about 4× less RAM at a small quality cost |
| original vectors | in RAM (`on_disk=False`) | about 211k × 384 × 4 B ≈ 320 MB fits |
| payload indexes | `tmdb_id` (integer), `name` (text) | filtering; the join with Neo4j is by point id = `tmdb_id` |
| client/server versions | `qdrant-client==1.9.2` against `qdrant/qdrant:v1.9.2` | a mismatch makes the server read gRPC vectors as empty (`expected dim: 384, got 0`) |

## The vector index is wider than the graph

The index holds every show with text (about 211,000 points), the graph only shows with at least two user votes (about 56,000). The backend over-fetches from Qdrant and keeps only series present in the graph, so each result can open a graph page. Counts come from the comments in `scripts/init_qdrant.py` and the Methodology page; the loading code is in `graph-series_ETL`.

## Standalone Next.js build

`output: "standalone"` produces a minimal server bundle, chosen (per the comment) for a server with 4 GB of RAM. The Dockerfile is multi-stage (dependencies, build, a small runtime image running as a non-root user).

## Changed or dropped along the way

- **Wikidata ids → TMDB `label:key` ids** (see above).
- **A `Work` node type** existed in older versions of the explore filters; the filter loader now accepts only known labels and ignores the old key.
- **`cytoscape-fcose`** was a dependency but never registered: the `force` layout is `cola`. The dependency was removed and the Methodology page, which used to say `fcose`, was corrected.
- **Silent error handling.** Every API failure used to be swallowed (empty `catch`), so a server error looked like "No results". `lib/api.ts` now throws `ApiError` with the HTTP status and `failureMessage()` builds `<what> failed (HTTP 500), try again`; pages show it in place of the content, and background actions (expanding a node, loading facet ids) show a toast. This came directly from the 2026-10-04 incident in which two search modes returned 500 unnoticed by the interface.
- **Pre-TMDB explore state** is purged on load (`LEGACY_STORAGE_KEYS`).
