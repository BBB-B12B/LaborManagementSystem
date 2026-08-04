#!/usr/bin/env python3
"""build_backlink_graph.py  (T-273)

Generator (single source of truth): reads knowledge/index_files.json and emits a
single, fully self-contained, OFFLINE HTML graph view of the knowledge base
(Obsidian-style). No CDN / no network refs: the force-directed layout is a small
hand-written velocity-Verlet simulation rendered on <canvas>, embedded inline.

Output: knowledge/diagrams/backlink-graph.html

Design contract (see .sessions/mece_plan.md Phase 3):
  NODES  : one per index entry. id=path, label=basename,
           color = topic bucket (top real major-topics + "other"=grey),
           radius = f(score-weighted incident degree).
  EDGES  : from related[]; symmetric A<->B deduped (keep MAX score);
           weight=score; stroke opacity proportional to score.
  LAYOUT : in-browser force sim (charge repulsion + link spring + centering +
           per-topic centroid clustering to break the hairball). Positions are
           computed in the browser, NOT baked -> file output is idempotent.
  CORE UI: (1) live score-threshold edge slider (2) click-to-focus depth-1 local
           graph (3) zoom-based label fade + always-on hover label
           (4) text search filter (5) topic colour legend.

Determinism: output bytes depend only on index_files.json content. Nodes/edges are
sorted by path; no timestamps / randomness are written into the file. Re-running
the generator on unchanged input produces a byte-identical file (Verify-3c).
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "knowledge", "index_files.json")
OUT_DIR = os.path.join(ROOT, "knowledge", "diagrams")
OUT = os.path.join(OUT_DIR, "backlink-graph.html")

# Distinct, colour-blind-friendly palette for the top real topics.
# "other" / empty always maps to grey (OTHER_COLOR), never consumes a palette slot.
PALETTE = [
    "#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1",
    "#76b7b2", "#edc948", "#ff9da7", "#9c755f", "#86bcb6",
    "#d37295", "#a0cbe8", "#8cd17d",
]
OTHER_COLOR = "#8a8f98"
OTHER_KEYS = {"other", "", None}
TOP_TOPICS = 12  # number of real topics to give a distinct colour
TARGET_DEGREE = 7  # default-view avg visible degree ceiling (among connected nodes)


def major_topic(entry: dict) -> str:
    """First major topic of an entry, normalised to 'other' when absent."""
    t = entry.get("topics") if isinstance(entry, dict) else None
    maj = t.get("major") if isinstance(t, dict) else None
    if isinstance(maj, list):
        return maj[0] if maj else "other"
    if isinstance(maj, str) and maj:
        return maj
    return "other"


def build_model(index: dict) -> dict:
    """Turn the raw index into a deterministic {nodes, edges, topics} model."""
    paths = sorted(index.keys())  # deterministic node order
    pset = set(paths)

    node_topic = {p: major_topic(index[p]) for p in paths}

    # Rank real topics by node count -> top get distinct colours, rest -> other.
    counts = defaultdict(int)
    for p in paths:
        counts[node_topic[p]] += 1
    real = [(t, n) for t, n in counts.items() if t not in OTHER_KEYS]
    real.sort(key=lambda kv: (-kv[1], kv[0]))  # freq desc, then name (deterministic)
    color_of = {}
    for i, (t, _n) in enumerate(real[:TOP_TOPICS]):
        color_of[t] = PALETTE[i % len(PALETTE)]

    def topic_color(t: str) -> str:
        return color_of.get(t, OTHER_COLOR)

    # Symmetric edge dedupe: key=sorted(a,b), keep MAX score. Both ends must exist.
    edge_score: dict[tuple[str, str], int] = {}
    for p in paths:
        for rel in index[p].get("related", []) or []:
            if not isinstance(rel, dict):
                continue
            q = rel.get("path")
            if q not in pset or q == p:
                continue
            try:
                sc = int(rel.get("score", 1))
            except (TypeError, ValueError):
                sc = 1
            key = (p, q) if p < q else (q, p)
            if sc > edge_score.get(key, -1):
                edge_score[key] = sc

    edges = [
        {"s": a, "t": b, "w": w}
        for (a, b), w in sorted(edge_score.items())
    ]

    # Score-weighted incident degree -> node radius input.
    wdeg = defaultdict(int)
    for e in edges:
        wdeg[e["s"]] += e["w"]
        wdeg[e["t"]] += e["w"]

    nodes = []
    for p in paths:
        t = node_topic[p]
        full_desc = index[p].get("description") or ""
        nodes.append({
            "id": p,
            "label": os.path.basename(p),
            "topic": t,
            "color": topic_color(t),
            "wdeg": wdeg.get(p, 0),
            # truncate long summaries but signal there's more with an ellipsis
            "desc": full_desc[:240] + ("…" if len(full_desc) > 240 else ""),
        })

    # Legend = real coloured topics (in colour order) + an "other" entry.
    legend = [{"topic": t, "color": PALETTE[i % len(PALETTE)], "count": counts[t]}
              for i, (t, _n) in enumerate(real[:TOP_TOPICS])]
    legend.append({"topic": "other", "color": OTHER_COLOR,
                   "count": sum(counts[t] for t in counts if t in OTHER_KEYS)
                   + sum(n for t, n in real[TOP_TOPICS:])})

    # Edge-strength bounds + a default threshold that opens on a readable (non-
    # hairball) view: pick the smallest threshold whose avg visible degree (over
    # nodes that still have an edge) is <= TARGET_DEGREE. Slider lets users relax it.
    scores = [e["w"] for e in edges] or [1]
    min_s, max_s = min(scores), max(scores)
    default_thr = min_s
    for thr in range(min_s, max_s + 1):
        kept = [e for e in edges if e["w"] >= thr]
        vis = {e["s"] for e in kept} | {e["t"] for e in kept}
        avg = (2 * len(kept) / len(vis)) if vis else 0
        default_thr = thr
        if avg <= TARGET_DEGREE:
            break

    return {
        "nodes": nodes, "edges": edges, "legend": legend,
        "minScore": min_s, "maxScore": max_s, "defaultThreshold": default_thr,
    }


# --- HTML template ---------------------------------------------------------
# {{DATA}} is replaced with the JSON model. Everything else is static so the
# emitted file is a pure function of the index content.
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Backlink Graph</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #14161a; color: #e6e8eb;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  #wrap { position: fixed; inset: 0; }
  canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  canvas.dragging { cursor: grabbing; }
  .panel { position: absolute; background: rgba(26,29,34,.92); border: 1px solid #2c313a;
    border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(6px); }
  #controls { top: 14px; left: 14px; width: 250px; }
  #controls h1 { font-size: 13px; margin: 0 0 2px; letter-spacing: .2px; }
  #controls .sub { color: #8a8f98; font-size: 11px; margin-bottom: 10px; }
  .row { margin: 9px 0; }
  .row label { display: flex; justify-content: space-between; font-size: 11px;
    color: #b6bcc6; margin-bottom: 3px; }
  .row label b { color: #e6e8eb; font-variant-numeric: tabular-nums; }
  input[type=range] { width: 100%; accent-color: #4e79a7; }
  input[type=search] { width: 100%; padding: 6px 8px; border-radius: 7px;
    border: 1px solid #2c313a; background: #0f1115; color: #e6e8eb; font-size: 12px; }
  input[type=search]:focus { outline: none; border-color: #4e79a7; }
  #legend { bottom: 14px; left: 14px; max-width: 250px; max-height: 42vh; overflow: auto; }
  #legend .lg-title { font-size: 11px; color: #8a8f98; margin-bottom: 7px; text-transform: uppercase; letter-spacing: .6px; }
  .lg { display: flex; align-items: center; gap: 7px; padding: 2px 0; cursor: pointer;
    font-size: 12px; user-select: none; }
  .lg.off { opacity: .35; }
  .lg .dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 auto; }
  .lg .nm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lg .ct { color: #8a8f98; font-variant-numeric: tabular-nums; }
  #stats { top: 14px; right: 14px; font-size: 11px; color: #b6bcc6; min-width: 150px; }
  #stats b { color: #e6e8eb; font-variant-numeric: tabular-nums; }
  #tip { position: absolute; pointer-events: none; background: #0b0c0f; border: 1px solid #2c313a;
    border-radius: 6px; padding: 5px 8px; font-size: 11px; max-width: 320px; display: none; z-index: 9; }
  #tip .tp { color: #8a8f98; }
  .hint { color: #6b7280; font-size: 10px; margin-top: 8px; }
  .plus { margin: 6px 0 2px; border-top: 1px solid #2c313a; padding-top: 6px; }
  .plus summary { cursor: pointer; font-size: 11px; color: #b6bcc6; user-select: none; outline: none; }
  .plus summary:hover { color: #e6e8eb; }
  .plus[open] summary { color: #e6e8eb; margin-bottom: 4px; }
  .plusrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .chk { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #b6bcc6; cursor: pointer; }
  .chk input { accent-color: #4e79a7; }
  .btn { background: #1f242c; border: 1px solid #2c313a; color: #e6e8eb;
    border-radius: 7px; padding: 5px 9px; font-size: 11px; cursor: pointer; }
  .btn:hover { border-color: #4e79a7; }
  /* T-274 read panel: appears on node click. pointer-events on itself only. */
  #detail { top: 100px; right: 14px; width: 300px; max-height: calc(100vh - 120px);
    overflow: auto; display: none; pointer-events: auto; z-index: 12; }
  #detail.show { display: block; }
  #detail .dt-close { position: absolute; top: 6px; right: 10px; cursor: pointer;
    color: #8a8f98; font-size: 17px; line-height: 1; border: none; background: none; }
  #detail .dt-close:hover { color: #e6e8eb; }
  #detail h2 { font-size: 14px; margin: 0 0 6px; padding-right: 18px; word-break: break-word; }
  #detail .dt-meta { color: #8a8f98; font-size: 11px; margin-bottom: 9px; }
  #detail .dt-summary { font-size: 12px; color: #d4d8dd; line-height: 1.55; margin-bottom: 4px; }
  #detail .dt-summary.empty { color: #6b7280; font-style: italic; }
  #detail .dt-sec { font-size: 10px; text-transform: uppercase; letter-spacing: .6px;
    color: #8a8f98; margin: 12px 0 5px; }
  #detail .dt-nb { display: block; padding: 3px 0; color: #9fb8d8; cursor: pointer;
    font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #detail .dt-nb:hover { color: #cfe0f5; text-decoration: underline; }
  #detail .dt-none { color: #6b7280; font-size: 11px; }
  #detail .dt-open { display: inline-block; margin-top: 4px; color: #6f9ed4;
    font-size: 12px; text-decoration: none; }
  #detail .dt-open:hover { text-decoration: underline; }
  #detail .dt-note { color: #6b7280; font-size: 10px; margin-top: 4px; line-height: 1.4; }
</style>
</head>
<body>
<div id="wrap">
  <canvas id="cv"></canvas>

  <div id="controls" class="panel">
    <h1>Knowledge Backlink Graph</h1>
    <div class="sub" id="subcount"></div>
    <div class="row">
      <label>Edge strength <b><span id="thrVal">1</span>+</b></label>
      <input type="range" id="thr" min="1" max="10" step="1" value="1">
    </div>
    <div class="row">
      <input type="search" id="search" placeholder="Search files...">
    </div>
    <div class="row">
      <button class="btn" id="reset">Reset view</button>
      <button class="btn" id="clearsel">Clear focus</button>
    </div>
    <details id="plus-panel" class="plus">
      <summary>Advanced controls</summary>
      <div class="row">
        <label>Repel <b><span id="force-repel-v">1.0</span></b></label>
        <input type="range" id="force-repel" min="0.2" max="3" step="0.1" value="1">
      </div>
      <div class="row">
        <label>Center pull <b><span id="force-center-v">1.0</span></b></label>
        <input type="range" id="force-center" min="0" max="3" step="0.1" value="1">
      </div>
      <div class="row">
        <label>Link force <b><span id="force-link-v">1.0</span></b></label>
        <input type="range" id="force-link" min="0" max="3" step="0.1" value="1">
      </div>
      <div class="row">
        <label>Link distance <b><span id="force-dist-v">1.0</span></b></label>
        <input type="range" id="force-dist" min="0.3" max="3" step="0.1" value="1">
      </div>
      <div class="row plusrow">
        <button class="btn" id="settle">Settle / freeze</button>
        <label class="chk"><input type="checkbox" id="orphan" checked> orphans</label>
        <label class="chk"><input type="checkbox" id="arrows"> arrows</label>
      </div>
    </details>
    <div class="hint">Drag = pan · scroll = zoom · click node = focus its neighbours</div>
  </div>

  <div id="stats" class="panel">
    <div>nodes <b id="sN">0</b> · visible <b id="sNv">0</b></div>
    <div>edges <b id="sE">0</b> · visible <b id="sEv">0</b></div>
    <div>avg visible degree <b id="sDeg">0</b></div>
  </div>

  <div id="legend" class="panel">
    <div class="lg-title">Topics</div>
    <div id="lgList"></div>
  </div>

  <div id="detail" class="panel">
    <button class="dt-close" id="dtClose" title="Close">×</button>
    <h2 id="dtTitle"></h2>
    <div class="dt-meta" id="dtMeta"></div>
    <div class="dt-summary" id="dtSummary"></div>
    <div class="dt-sec">Linked files</div>
    <div id="dtNeighbors"></div>
    <a class="dt-open" id="dtOpen" target="_blank" rel="noopener">open raw file ↗</a>
    <div class="dt-note">Opens the raw file directly — depending on your browser it may download instead of display. The summary above is the in-page reader.</div>
  </div>

  <div id="tip"></div>
</div>

<script id="graph-data" type="application/json">{{DATA}}</script>
<script>
"use strict";
const DATA = JSON.parse(document.getElementById("graph-data").textContent);

// ---- deterministic seeded PRNG (mulberry32) so in-browser layout is stable ----
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(0x9e3779b9);

// ---- build runtime graph ----
const nodes = DATA.nodes.map((n,i)=>({...n, idx:i}));
const idOf = new Map(nodes.map(n=>[n.id,n]));
const edges = DATA.edges.map(e=>({s:idOf.get(e.s), t:idOf.get(e.t), w:e.w}));

// degree (all edges) for radius; adjacency for focus mode
const deg = new Map(nodes.map(n=>[n,0]));
const adj = new Map(nodes.map(n=>[n,new Set()]));
for(const e of edges){ adj.get(e.s).add(e.t); adj.get(e.t).add(e.s); }
const maxW = Math.max(1, ...nodes.map(n=>n.wdeg));
for(const n of nodes){ n.r = 3.2 + 6.5*Math.sqrt(n.wdeg/maxW); }

// ---- force-sim params (exposed for the Plus panel) ----
const SIM = { repel: 1.0, center: 1.0, linkForce: 1.0, linkDist: 1.0, cluster: 0.012 };
const BASE_REPEL = 900, BASE_LINK_K = 0.04, BASE_LINK_LEN = 46, BASE_CENTER = 0.012;
let frozen = false, showOrphans = true, showArrows = false;
// --- cooling: the sim sheds energy each tick and STOPS once settled (like a
// spinning top winding down). reheat() re-energises it on user interaction. ---
let alpha = 1;
const ALPHA_MIN = 0.0015, ALPHA_DECAY = 0.02, ALPHA_TARGET = 0;
function reheat(a){ alpha = Math.max(alpha, (a===undefined ? 0.6 : a)); }

// ---- topic centroids (recomputed each tick) for cluster force ----
const topicNodes = new Map();
for(const n of nodes){ if(!topicNodes.has(n.topic)) topicNodes.set(n.topic,[]); topicNodes.get(n.topic).push(n); }

// ---- initial layout: spread topics around a ring, jitter inside ----
(function seedLayout(){
  const topics=[...topicNodes.keys()];
  topics.forEach((tp,ti)=>{
    const ang = (ti/topics.length)*Math.PI*2;
    const cx = Math.cos(ang)*260, cy = Math.sin(ang)*260;
    for(const n of topicNodes.get(tp)){
      n.x = cx + (rnd()-0.5)*180; n.y = cy + (rnd()-0.5)*180; n.vx=0; n.vy=0;
    }
  });
})();

// ---- view transform ----
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio||1));
let view = { x:0, y:0, k:1 };   // pan x/y (screen px), zoom k
let W=0, H=0;
function resize(){
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio||1));
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
}
window.addEventListener("resize", resize); resize();
// center the world initially
view.x = W/2; view.y = H/2;

// ---- UI state ----
let threshold = DATA.defaultThreshold;
let selected = null;             // focused node
let searchHits = null;           // Set of nodes matching search (or null)
const topicOff = new Set();      // topics toggled off via legend

// ---- visible-set computation ----
let visEdges = [], visNodeSet = new Set();
function recomputeVisible(){
  visEdges = edges.filter(e => e.w >= threshold
    && !topicOff.has(e.s.topic) && !topicOff.has(e.t.topic));
  visNodeSet = new Set();
  for(const e of visEdges){ visNodeSet.add(e.s); visNodeSet.add(e.t); }
  for(const n of nodes){
    if(topicOff.has(n.topic)) continue;
    if(showOrphans || visNodeSet.has(n)) visNodeSet.add(n);
  }
  // stats
  document.getElementById("sNv").textContent = visNodeSet.size;
  document.getElementById("sEv").textContent = visEdges.length;
  const avg = visNodeSet.size ? (2*visEdges.length/visNodeSet.size) : 0;
  document.getElementById("sDeg").textContent = avg.toFixed(1);
  reheat(0.5);   // re-settle after threshold / orphan / legend changes
}

// ---- physics tick ----
function tick(){
  if(frozen || alpha < ALPHA_MIN) return;   // settled -> stop computing & moving
  const aF = alpha;                          // cooling factor: forces fade as the sim settles
  const repel = BASE_REPEL * SIM.repel;
  const linkK = BASE_LINK_K * SIM.linkForce;
  const linkLen = BASE_LINK_LEN * SIM.linkDist;
  const centerK = BASE_CENTER * SIM.center;

  // charge repulsion (O(n^2), fine for ~200 nodes)
  for(let i=0;i<nodes.length;i++){
    const a=nodes[i];
    for(let j=i+1;j<nodes.length;j++){
      const b=nodes[j];
      let dx=a.x-b.x, dy=a.y-b.y, d2=dx*dx+dy*dy+0.01;
      const f=repel*aF/d2; const d=Math.sqrt(d2);
      const fx=f*dx/d, fy=f*dy/d;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
  }
  // link spring
  for(const e of edges){
    const a=e.s, b=e.t;
    let dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01;
    const f=linkK*(d-linkLen)*aF;
    const fx=f*dx/d, fy=f*dy/d;
    a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
  }
  // centering + topic cluster pull
  for(const [,arr] of topicNodes){
    let cx=0, cy=0; for(const n of arr){ cx+=n.x; cy+=n.y; } cx/=arr.length; cy/=arr.length;
    for(const n of arr){ n.vx += (cx-n.x)*SIM.cluster*aF; n.vy += (cy-n.y)*SIM.cluster*aF; }
  }
  for(const n of nodes){
    n.vx += (0 - n.x)*centerK*aF; n.vy += (0 - n.y)*centerK*aF;
    n.vx*=0.86; n.vy*=0.86;
    if(n!==dragNode){ n.x+=n.vx; n.y+=n.vy; }
  }
  alpha += (ALPHA_TARGET - alpha) * ALPHA_DECAY;   // cool down -> drops below ALPHA_MIN -> stops
}

// ---- render ----
function world(n){ return { x: view.x + n.x*view.k, y: view.y + n.y*view.k }; }
function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);

  const focusSet = selected ? new Set([selected, ...adj.get(selected)]) : null;
  // edges
  ctx.lineWidth = 1;
  for(const e of visEdges){
    if(!visNodeSet.has(e.s)||!visNodeSet.has(e.t)) continue;
    const dim = focusSet && !(focusSet.has(e.s)&&focusSet.has(e.t));
    const a=world(e.s), b=world(e.t);
    const op = Math.min(0.7, 0.12 + e.w*0.08) * (dim?0.12:1);
    ctx.strokeStyle = `rgba(150,160,175,${op})`;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    if(showArrows && !dim){ drawArrow(a,b,e.t.r*view.k); }
  }
  // nodes
  for(const n of nodes){
    if(!visNodeSet.has(n)) continue;
    const p=world(n), r=Math.max(1.5, n.r*view.k);
    const focusDim = focusSet && !focusSet.has(n);
    const searchDim = searchHits && !searchHits.has(n);
    const dim = focusDim || searchDim;
    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
    ctx.fillStyle = n.color; ctx.fill();
    if(n===selected){ ctx.lineWidth=2; ctx.strokeStyle="#fff"; ctx.stroke(); }
    else if(searchHits && searchHits.has(n)){ ctx.lineWidth=1.5; ctx.strokeStyle="#ffd166"; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // labels: fade in with zoom; always for hover/selected/search/focus neighbours
  const showAllLabels = view.k > 1.7;
  ctx.fillStyle = "#cdd2da"; ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for(const n of nodes){
    if(!visNodeSet.has(n)) continue;
    const force = (n===hoverNode)||(n===selected)||(focusSet&&focusSet.has(n))||(searchHits&&searchHits.has(n));
    if(!showAllLabels && !force) continue;
    const p=world(n);
    ctx.globalAlpha = force?1:0.8;
    ctx.fillText(n.label, p.x, p.y + Math.max(1.5,n.r*view.k) + 2);
    ctx.globalAlpha = 1;
  }
}
function drawArrow(a,b,rb){
  const ang=Math.atan2(b.y-a.y,b.x-a.x);
  const tx=b.x-Math.cos(ang)*(rb+2), ty=b.y-Math.sin(ang)*(rb+2), s=5;
  ctx.fillStyle="rgba(150,160,175,.6)";
  ctx.beginPath();
  ctx.moveTo(tx,ty);
  ctx.lineTo(tx-Math.cos(ang-0.4)*s, ty-Math.sin(ang-0.4)*s);
  ctx.lineTo(tx-Math.cos(ang+0.4)*s, ty-Math.sin(ang+0.4)*s);
  ctx.closePath(); ctx.fill();
}

// ---- main loop ----
function frame(){ tick(); draw(); requestAnimationFrame(frame); }

// ---- hit testing ----
let hoverNode=null, dragNode=null, panning=false, lastX=0, lastY=0;
function pick(mx,my){
  let best=null, bd=1e9;
  for(const n of nodes){
    if(!visNodeSet.has(n)) continue;
    const p=world(n), r=Math.max(4,n.r*view.k)+3;
    const d=(p.x-mx)**2+(p.y-my)**2;
    if(d<r*r && d<bd){ bd=d; best=n; }
  }
  return best;
}
cv.addEventListener("mousemove",ev=>{
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  if(dragNode){ dragNode.x=(mx-view.x)/view.k; dragNode.y=(my-view.y)/view.k; dragNode.vx=0; dragNode.vy=0; reheat(0.4); return; }
  if(panning){ view.x+=mx-lastX; view.y+=my-lastY; lastX=mx; lastY=my; return; }
  hoverNode=pick(mx,my);
  const tip=document.getElementById("tip");
  if(hoverNode){
    tip.style.display="block"; tip.style.left=(ev.clientX+12)+"px"; tip.style.top=(ev.clientY+12)+"px";
    tip.innerHTML=`<div>${hoverNode.label}</div><div class="tp">${hoverNode.topic} · deg ${adj.get(hoverNode).size} · weight ${hoverNode.wdeg}</div><div class="tp">${hoverNode.id}</div>`;
  } else tip.style.display="none";
});
cv.addEventListener("mousedown",ev=>{
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  const n=pick(mx,my);
  if(n){ dragNode=n; } else { panning=true; cv.classList.add("dragging"); }
  lastX=mx; lastY=my;
});
window.addEventListener("mouseup",()=>{ dragNode=null; panning=false; cv.classList.remove("dragging"); });
// ---- read panel (T-274): summary + neighbour navigation + open-file ----
const detail = document.getElementById("detail");
function recenter(n){ view.x = W/2 - n.x*view.k; view.y = H/2 - n.y*view.k; }
function hideDetail(){ detail.classList.remove("show"); }
function showDetail(n){
  document.getElementById("dtTitle").textContent = n.label;
  document.getElementById("dtMeta").textContent =
    n.topic + " · " + adj.get(n).size + " links · weight " + n.wdeg;
  const sum = document.getElementById("dtSummary");
  if(n.desc){ sum.textContent = n.desc; sum.classList.remove("empty"); }
  else { sum.textContent = "no summary — open the file to read it"; sum.classList.add("empty"); }
  const nb = document.getElementById("dtNeighbors");
  nb.textContent = "";
  const neigh = [...adj.get(n)].sort((a,b)=>a.label.localeCompare(b.label));
  if(neigh.length){
    for(const m of neigh){
      const a = document.createElement("span");
      a.className = "dt-nb"; a.textContent = m.label; a.title = m.id;
      a.addEventListener("click", ()=>{ selected = m; recenter(m); showDetail(m); });
      nb.appendChild(a);
    }
  } else {
    const d = document.createElement("div");
    d.className = "dt-none"; d.textContent = "no linked files (orphan)";
    nb.appendChild(d);
  }
  document.getElementById("dtOpen").setAttribute("href", "../../" + n.id);
  detail.classList.add("show");
}
document.getElementById("dtClose").addEventListener("click", ()=>{ hideDetail(); selected=null; });
cv.addEventListener("click",ev=>{
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  const n=pick(mx,my);
  selected = (n===selected)? null : n;
  if(selected){ showDetail(selected); } else { hideDetail(); }
});
cv.addEventListener("wheel",ev=>{
  ev.preventDefault();
  const r=cv.getBoundingClientRect(), mx=ev.clientX-r.left, my=ev.clientY-r.top;
  const wx=(mx-view.x)/view.k, wy=(my-view.y)/view.k;
  const k2=Math.max(0.15,Math.min(6, view.k*(ev.deltaY<0?1.1:0.9)));
  view.k=k2; view.x=mx-wx*k2; view.y=my-wy*k2;
},{passive:false});

// ---- controls wiring ----
const thr=document.getElementById("thr");
thr.min=DATA.minScore; thr.max=DATA.maxScore; thr.value=DATA.defaultThreshold;
document.getElementById("thrVal").textContent=DATA.defaultThreshold;
thr.addEventListener("input",()=>{ threshold=+thr.value; document.getElementById("thrVal").textContent=threshold; recomputeVisible(); });
document.getElementById("search").addEventListener("input",ev=>{
  const q=ev.target.value.trim().toLowerCase();
  searchHits = q ? new Set(nodes.filter(n=>n.label.toLowerCase().includes(q)||n.id.toLowerCase().includes(q))) : null;
});
document.getElementById("reset").addEventListener("click",()=>{ view={x:W/2,y:H/2,k:1}; });
document.getElementById("clearsel").addEventListener("click",()=>{ selected=null; hideDetail(); });

// ---- Plus controls (advanced; additive, Core works without them) ----
function bindForce(id,key){
  const el=document.getElementById(id), out=document.getElementById(id+"-v");
  el.addEventListener("input",()=>{ SIM[key]=+el.value; out.textContent=(+el.value).toFixed(1); frozen=false; updateSettleLabel(); reheat(0.7); });
}
bindForce("force-repel","repel");
bindForce("force-center","center");
bindForce("force-link","linkForce");
bindForce("force-dist","linkDist");
const settleBtn=document.getElementById("settle");
function updateSettleLabel(){ settleBtn.textContent = frozen ? "Resume sim" : "Settle / freeze"; }
settleBtn.addEventListener("click",()=>{
  frozen=!frozen;
  if(frozen){ for(const n of nodes){ n.vx=0; n.vy=0; } }   // instantly cool
  updateSettleLabel();
});
document.getElementById("orphan").addEventListener("change",ev=>{ showOrphans=ev.target.checked; recomputeVisible(); });
document.getElementById("arrows").addEventListener("change",ev=>{ showArrows=ev.target.checked; });

// ---- legend ----
const lgList=document.getElementById("lgList");
for(const item of DATA.legend){
  const el=document.createElement("div"); el.className="lg";
  el.innerHTML=`<span class="dot" style="background:${item.color}"></span><span class="nm">${item.topic}</span><span class="ct">${item.count}</span>`;
  el.addEventListener("click",()=>{
    if(topicOff.has(item.topic)){ topicOff.delete(item.topic); el.classList.remove("off"); }
    else { topicOff.add(item.topic); el.classList.add("off"); }
    recomputeVisible();
  });
  lgList.appendChild(el);
}

// ---- stats init ----
document.getElementById("sN").textContent = nodes.length;
document.getElementById("sE").textContent = edges.length;
document.getElementById("subcount").textContent = `${nodes.length} files · ${edges.length} links · ${DATA.legend.length-1} topics`;

recomputeVisible();
frame();
</script>
</body>
</html>
"""


def main() -> int:
    if not os.path.exists(INDEX):
        print(f"ERROR: index not found: {INDEX}", file=sys.stderr)
        return 1
    with open(INDEX, encoding="utf-8") as fh:
        index = json.load(fh)

    model = build_model(index)
    # compact, sorted JSON -> deterministic, ascii-safe (no network, no unicode surprises)
    data_json = json.dumps(model, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    # harden: never let a field value (e.g. a description containing "</script>")
    # close the inline <script> block. "<\/" is valid JSON, parses back to "</".
    data_json = data_json.replace("</", "<\\/")
    html = HTML_TEMPLATE.replace("{{DATA}}", data_json)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    thr = model["defaultThreshold"]
    kept = [e for e in model["edges"] if e["w"] >= thr]
    vis = {e["s"] for e in kept} | {e["t"] for e in kept}
    avg_vis = (2 * len(kept) / len(vis)) if vis else 0
    print(f"[backlink-graph] nodes={len(model['nodes'])} "
          f"edges_kept={len(model['edges'])} (deduped) "
          f"topics={len(model['legend']) - 1} "
          f"default_threshold={thr} (score {model['minScore']}-{model['maxScore']}) "
          f"avg_visible_degree={avg_vis:.2f} -> {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
