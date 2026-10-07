import type { Metadata } from 'next'
import Link from 'next/link'
import { TMDB_URL, TMDB_ATTRIBUTION } from '@/lib/constants'

export const metadata: Metadata = { title: 'TVKG – About' }

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-slate-800 pt-8">
      <h2 className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-4">{title}</h2>
      <div className="prose-sm space-y-3 text-slate-400 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300">
      {children}
    </code>
  )
}

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-50 mb-2">Methodology</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          How the TV Series Knowledge Graph is built, what data it uses, and where it breaks down.
        </p>
      </div>

      <Section id="overview" title="Overview">
        <p>
          TVKG is a semantic and graph-based search system over ~56,000 TV series sourced from{' '}
          <a href={TMDB_URL} target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 transition-colors">TMDB</a>.
          It combines vector similarity search with structural graph traversal to surface both
          thematically and relationally similar content.
        </p>
        <p>
          Four search modes are available: <strong className="text-slate-300">semantic</strong> — nearest
          neighbours in embedding space; <strong className="text-slate-300">structural</strong> — full-text
          match on series titles; <strong className="text-slate-300">hybrid</strong>, which blends the
          semantic score with graph-structural signals like shared cast and production country; and
          <strong className="text-slate-300"> person</strong> — full-text match on people, with their series.
        </p>
      </Section>

      <Section id="data" title="Data sources">
        <p>
          Series metadata (title, years, genres, keywords, networks, countries, languages, cast, creators,
          directors, ratings, a short overview) comes from{' '}
          <a href={TMDB_URL} target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 transition-colors">TMDB</a>,
          one API call per show. About 230,000 shows are fetched; the graph holds the ~56,000 that have at
          least two user votes, while the vector index covers every show that has an overview or keywords.
        </p>
        <p>
          The snapshot is refreshed periodically. Shows with sparse TMDB coverage may be missing keywords,
          cast, or dates.
        </p>
        <p>
          Node types in the graph: <Code>Series</Code>, <Code>Person</Code>, <Code>Genre</Code>,{' '}
          <Code>Keyword</Code>, <Code>Network</Code>, <Code>Country</Code>, <Code>Language</Code>. Edge types:{' '}
          <Code>ACTED_IN</Code>, <Code>CREATED</Code>, <Code>DIRECTED</Code>, <Code>HAS_GENRE</Code>,{' '}
          <Code>HAS_KEYWORD</Code>, <Code>AIRED_ON</Code>, <Code>PRODUCED_IN</Code>, <Code>HAS_LANGUAGE</Code>.
        </p>
      </Section>

      <Section id="embeddings" title="Embeddings & vector search">
        <p>
          Each series is represented as a 384-dimensional dense vector produced by{' '}
          <Code>BAAI/bge-small-en-v1.5</Code>, a lightweight bi-encoder optimised for retrieval tasks.
          The input to the encoder is the series title, its TMDB overview (a short one-paragraph logline),
          and its keyword tags. Shows with neither an overview nor keywords are not indexed.
        </p>
        <p>
          Vectors are stored in <a href="https://qdrant.tech" target="_blank" rel="noopener" className="text-violet-400 hover:text-violet-300 transition-colors">Qdrant</a> with
          scalar quantisation (INT8) and HNSW indexing (<Code>m=16</Code>, <Code>ef_construct=100</Code>).
          At query time the search string is embedded with the same model (using the BGE retrieval-query
          instruction; documents are encoded without it) and the top-k nearest neighbours are retrieved by
          cosine distance. Only series that are also present in the graph are returned.
        </p>
      </Section>

      <Section id="graph" title="Graph structure & traversal">
        <p>
          The knowledge graph is stored in a property graph database. Each series node links to its cast,
          creators, directors, genres, keywords, networks, countries of production, and spoken languages.
        </p>
        <p>
          The graph API exposes depth-1 and depth-2 neighbourhood traversals. Depth-2 reveals
          co-workers: directors who share actors, series that share creators, etc. The force-directed
          layout used in the 2D graph fixes the focal node at the centre; node size scales with degree.
        </p>
        <p>
          The <Link href="/explore" className="text-violet-400 hover:text-violet-300 transition-colors">explore view</Link> uses
          Cytoscape.js with force (cola), hierarchy (dagre), circle, and concentric layouts and supports progressive
          graph expansion by double-clicking any series or person node.
        </p>
      </Section>

      <Section id="hybrid" title="Hybrid similarity">
        <p>
          Hybrid mode combines the cosine similarity score from vector search with a structural score
          computed from shared cast and shared production countries. The structural component rewards
          series that share a significant fraction of actors or originate from the same country or
          language context.
        </p>
        <p>
          The number on a result depends on the mode. Semantic: cosine similarity, shown as a percentage.
          Hybrid: cosine similarity plus the bonuses, shown as a plain number that can be above 1.0 (the
          bonuses are added on top of the similarity); on the similar page the shared actor and country
          counts are shown next to it when the API returns them. Structural: full-text relevance from the
          database, also a plain number. Series added from the graph because few vector neighbours exist
          are marked as graph overlap. This keeps the ranking interpretable rather than a black-box
          recommendation.
        </p>
      </Section>

      <Section id="limitations" title="Limitations">
        <p>
          <strong className="text-slate-300">Coverage:</strong> TMDB coverage is uneven. Only about
          half of all shows have cast listed and under a third have keywords; well-known series have rich
          metadata while obscure ones may have only a title and dates. Embedding quality degrades for
          series with a thin overview and no keywords.
        </p>
        <p>
          <strong className="text-slate-300">Cast completeness:</strong> At most 20 cast members
          (ranked by episode count) and 10 directors are kept per show. Large ensemble casts are
          undercounted, so hybrid similarity based on shared actors underestimates overlap for such series.
        </p>
        <p>
          <strong className="text-slate-300">Language:</strong> The encoder is an English model, but an
          overview falls back from Russian to English to the original language of the show, so some
          overviews are not in English and match less reliably. Genre names and keywords are in English.
        </p>
        <p>
          <strong className="text-slate-300">Temporal freshness:</strong> The index is a snapshot
          and does not update in real time. Newly aired series will appear only after the next
          data refresh.
        </p>
        <p>
          <strong className="text-slate-300">Attribution:</strong> {TMDB_ATTRIBUTION}
        </p>
      </Section>

      <Section id="stack" title="Technical stack">
        <p>
          <strong className="text-slate-300">Frontend:</strong> Next.js 15 (App Router) · TypeScript ·
          Tailwind CSS · react-force-graph-2d · Cytoscape.js
        </p>
        <p>
          <strong className="text-slate-300">Vector store:</strong> Qdrant 1.9 with scalar quantisation
          and HNSW indexing
        </p>
        <p>
          <strong className="text-slate-300">Embedding service:</strong> FastAPI + BAAI/bge-small-en-v1.5
          via sentence-transformers, running on the same host
        </p>
        <p>
          <strong className="text-slate-300">Infrastructure:</strong> Self-hosted VDS behind Caddy reverse
          proxy, Docker Compose, no third-party managed services
        </p>
      </Section>

      <div className="border-t border-slate-800 pt-8 flex flex-wrap gap-4 sm:gap-6 font-mono text-xs text-slate-600">
        <a href={TMDB_URL} target="_blank" rel="noopener" className="hover:text-violet-400 transition-colors">
          TMDB →
        </a>
        <a href="https://qdrant.tech" target="_blank" rel="noopener" className="hover:text-violet-400 transition-colors">
          Qdrant →
        </a>
        <a href="https://huggingface.co/BAAI/bge-small-en-v1.5" target="_blank" rel="noopener" className="hover:text-violet-400 transition-colors">
          BAAI/bge-small-en-v1.5 →
        </a>
        <Link href="/" className="hover:text-violet-400 transition-colors">← home</Link>
      </div>

    </div>
  )
}
