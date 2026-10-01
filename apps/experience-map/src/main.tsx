import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider,
  useReactFlow, type Edge, type Node, type NodeProps
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import "@xyflow/react/dist/style.css";
import "./style.css";
import inventory from "../data/inventory.json";

type Capture = { thumbnail: string; full?: string; status: string; capturedAt: string; resolvedUrl?: string; source?: string };
type Screen = { id: string; label: string; kind: string; role: string; url?: string; app?: string; screen?: string; source?: string; count?: number; capture: Capture | null };
type Connection = { id: string; from: string; to: string; action: string; role: string; state: string; evidence: "test-verified" | "code-inferred"; source: string };
type MapData = { generatedAt: string; counts: { webRoutes: number; mobileScreens: number; states: number; edges: number }; nodes: Screen[]; edges: Connection[] };
type CardData = { screen: Screen; selected: boolean; connected: boolean; dimmed: boolean; onInspect: (id: string) => void };
const map = inventory as MapData;
const elk = new ELK();
const roles = ["public", "customer", "provider", "crew", "ops"];
const roleColors: Record<string, string> = { public: "#87b8a5", customer: "#68a9e8", provider: "#d6a36d", crew: "#bc9ce2", ops: "#e09b91" };

function ScreenCard({ data }: NodeProps<Node<CardData>>) {
  const { screen, selected, connected, dimmed, onInspect } = data;
  return <div className={`screen-card ${selected ? "is-selected" : ""} ${connected ? "is-connected" : ""} ${dimmed ? "is-dimmed" : ""}`} style={{ "--role-color": roleColors[screen.role] ?? roleColors.public } as React.CSSProperties}>
    <Handle className="card-handle" type="target" position={Position.Left} />
    <button type="button" className="card-image" onClick={() => onInspect(screen.id)} aria-label={`Inspect ${screen.label}`}>
      {screen.kind === "section" ? <div className="section-art"><strong>{screen.count}</strong><span>screens · click to expand</span></div> : screen.capture ? <img src={`/${screen.capture.thumbnail}`} alt={`Screenshot of ${screen.label}`} loading="lazy" /> : <div className="image-placeholder"><span>{screen.kind === "mobile" ? "iPhone" : screen.kind === "state" ? "State" : "Web page"}</span><strong>Screenshot pending</strong></div>}
      <span className="image-expand" aria-hidden="true">↗</span>
    </button>
    <div className="card-text"><span className="card-kicker">{screen.role} · {screen.kind}{screen.capture?.status === "redirect" ? " · redirect" : screen.capture?.status === "test-artifact" ? " · test capture" : ""}</span><strong title={screen.label}>{screen.label}</strong><small title={screen.url ?? screen.id}>{screen.url ?? (screen.kind === "mobile" ? `${screen.app} / ${screen.screen}` : screen.id)}</small></div>
    <Handle className="card-handle" type="source" position={Position.Right} />
  </div>;
}
const nodeTypes = { screen: ScreenCard };

async function arrange(screens: Screen[], connections: Connection[]) {
  const graph = await elk.layout({
    id: "root",
    layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.spacing.nodeNode": "55", "elk.layered.spacing.nodeNodeBetweenLayers": "140", "elk.edgeRouting": "SPLINES" },
    children: screens.map((screen) => ({ id: screen.id, width: 250, height: 235 })),
    edges: connections.map((edge) => ({ id: edge.id, sources: [edge.from], targets: [edge.to] }))
  });
  return new Map(graph.children?.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
}

function MapViewer() {
  const [query, setQuery] = useState("");
  const [activeRoles, setActiveRoles] = useState<string[]>(roles);
  const [collapsedRoles, setCollapsedRoles] = useState<string[]>([]);
  const [activeKinds, setActiveKinds] = useState<string[]>(["web", "mobile", "state"]);
  const [evidence, setEvidence] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [highlightPath, setHighlightPath] = useState(true);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const { fitView, getNodes } = useReactFlow();
  const initialFocus = useRef(true);

  const matching = useMemo(() => new Set(map.nodes.filter((node) => {
    const haystack = `${node.label} ${node.id} ${node.url ?? ""} ${node.source ?? ""}`.toLowerCase();
    return activeRoles.includes(node.role) && activeKinds.includes(node.kind) && (!query || haystack.includes(query.toLowerCase()));
  }).map((node) => node.id)), [activeRoles, activeKinds, query]);

  const connections = useMemo(() => map.edges.filter((edge) => matching.has(edge.from) && matching.has(edge.to) && (evidence === "all" || edge.evidence === evidence)), [matching, evidence]);
  const displayedScreens = useMemo(() => {
    const screens = map.nodes.filter((screen) => matching.has(screen.id) && !collapsedRoles.includes(screen.role));
    for (const role of collapsedRoles) {
      const count = map.nodes.filter((screen) => matching.has(screen.id) && screen.role === role).length;
      if (count) screens.push({ id: `section:${role}`, label: `${role[0].toUpperCase()}${role.slice(1)} paths`, kind: "section", role, count, capture: null });
    }
    return screens;
  }, [matching, collapsedRoles]);
  const displayedConnections = useMemo(() => {
    const seen = new Set<string>();
    return connections.map((edge) => ({ ...edge, from: collapsedRoles.includes(map.nodes.find((node) => node.id === edge.from)?.role ?? "") ? `section:${map.nodes.find((node) => node.id === edge.from)?.role}` : edge.from, to: collapsedRoles.includes(map.nodes.find((node) => node.id === edge.to)?.role ?? "") ? `section:${map.nodes.find((node) => node.id === edge.to)?.role}` : edge.to })).filter((edge) => {
      if (edge.from === edge.to) return false;
      const key = `${edge.from}|${edge.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [connections, collapsedRoles]);
  const pathIds = useMemo(() => {
    const ids = new Set<string>(selected ? [selected] : []);
    if (!selected || !highlightPath) return ids;
    const queue = [selected];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of displayedConnections) {
        if (edge.from === current && !ids.has(edge.to)) { ids.add(edge.to); queue.push(edge.to); }
      }
    }
    return ids;
  }, [selected, displayedConnections, highlightPath]);
  const connectedIds = useMemo(() => new Set(displayedConnections.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])), [displayedConnections, selected]);
  const nodes = useMemo<Node<CardData>[]>(() => displayedScreens.map((screen) => ({
    id: screen.id, type: "screen", position: { x: 0, y: 0 }, data: { screen, selected: selected === screen.id, connected: connectedIds.has(screen.id), dimmed: Boolean(selected && highlightPath && !pathIds.has(screen.id) && !connectedIds.has(screen.id)), onInspect: screen.kind === "section" ? () => setCollapsedRoles((current) => current.filter((role) => role !== screen.role)) : setPreview }
  })), [displayedScreens, selected, connectedIds, highlightPath, pathIds]);
  const edges = useMemo<Edge[]>(() => displayedConnections.map((edge) => ({
    id: edge.id, source: edge.from, target: edge.to, type: "smoothstep", animated: selected === edge.from && pathIds.has(edge.to),
    label: selected === edge.from || selected === edge.to ? edge.action : undefined,
    className: selected && (pathIds.has(edge.from) && pathIds.has(edge.to)) ? "edge-highlight" : "",
    style: { stroke: selected && (pathIds.has(edge.from) && pathIds.has(edge.to)) ? "#48b7dd" : edge.evidence === "test-verified" ? "#768b91" : "#535b60", strokeWidth: selected === edge.from ? 2.5 : 1.5, strokeDasharray: edge.evidence === "code-inferred" ? "5 5" : undefined },
    labelStyle: { fill: "#e7f1ee", fontSize: 12, fontWeight: 600 }, labelBgStyle: { fill: "#1a272b", fillOpacity: 0.94 }, labelBgPadding: [7, 4] as [number, number], labelBgBorderRadius: 5
  })), [displayedConnections, selected, pathIds]);

  useEffect(() => {
    let alive = true;
    void arrange(displayedScreens, displayedConnections).then((result) => {
      if (!alive) return;
      setPositions(result);
      window.setTimeout(() => {
        const all = getNodes();
        const start = initialFocus.current;
        initialFocus.current = false;
        const focus = start ? all.filter((node) => node.id === "web:/") : all;
        void fitView({ nodes: focus.length ? focus : all, padding: start ? 0.16 : 0.2, duration: 450, maxZoom: start ? 0.9 : 1 });
      }, 80);
    });
    return () => { alive = false; };
  }, [displayedScreens, displayedConnections, fitView, getNodes]);
  const displayNodes = useMemo(() => nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? { x: 0, y: 0 } })), [nodes, positions]);
  useEffect(() => {
    if (!selected || !displayNodes.length) return;
    const nearby = new Set([selected, ...displayedConnections.filter((edge) => edge.from === selected || edge.to === selected).flatMap((edge) => [edge.from, edge.to])]);
    const timer = window.setTimeout(() => void fitView({ nodes: displayNodes.filter((node) => nearby.has(node.id)), padding: 0.35, maxZoom: 0.95, duration: 450 }), 80);
    return () => window.clearTimeout(timer);
  }, [selected, displayNodes, displayedConnections, fitView]);
  const selectedNode = map.nodes.find((node) => node.id === selected);
  const previewNode = map.nodes.find((node) => node.id === preview);
  const outgoing = map.edges.filter((edge) => edge.from === selected);
  const incoming = map.edges.filter((edge) => edge.to === selected);
  const missingCount = map.nodes.filter((node) => !node.capture).length;

  function toggle(values: string[], value: string, setter: (next: string[]) => void) { setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-head"><span className="eyebrow">YardMatch · local tool</span><h1>Experience map</h1><p>Follow actual paths through the web and iPhone ecosystem.</p></div>
      <div className="metrics"><div><strong>{map.counts.webRoutes}</strong><span>web routes</span></div><div><strong>{map.counts.mobileScreens}</strong><span>app screens</span></div><div><strong>{map.counts.edges}</strong><span>connections</span></div></div>
      <label className="field-label" htmlFor="screen-search">Find a screen or path</label><input id="screen-search" type="search" placeholder="Search screens, routes…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="filter-block"><h2>Areas <span>{activeRoles.length}/{roles.length}</span></h2><div className="area-list">{roles.map((role) => <div className="area-row" key={role}><button type="button" className={`chip ${activeRoles.includes(role) ? "active" : ""}`} onClick={() => toggle(activeRoles, role, setActiveRoles)}><i style={{ background: roleColors[role] }} />{role}</button><button type="button" className="collapse-button" aria-label={`${collapsedRoles.includes(role) ? "Expand" : "Collapse"} ${role} section`} onClick={() => { setSelected(null); toggle(collapsedRoles, role, setCollapsedRoles); }}>{collapsedRoles.includes(role) ? "+" : "−"}</button></div>)}</div></div>
      <div className="filter-block"><h2>Screen types</h2><div className="chips">{["web", "mobile", "state"].map((kind) => <button type="button" key={kind} className={`chip ${activeKinds.includes(kind) ? "active" : ""}`} onClick={() => toggle(activeKinds, kind, setActiveKinds)}>{kind}</button>)}</div></div>
      <div className="filter-block"><h2>Connection evidence</h2><select value={evidence} onChange={(event) => setEvidence(event.target.value)}><option value="all">All connections</option><option value="test-verified">Test verified</option><option value="code-inferred">Code inferred</option></select><div className="legend"><span><i className="line-solid" /> test verified</span><span><i className="line-dashed" /> code inferred</span></div></div>
      <label className="checkbox"><input type="checkbox" checked={highlightPath} onChange={(event) => setHighlightPath(event.target.checked)} /> Highlight downstream path</label>
      <div className="sidebar-foot"><span>{missingCount} screenshots pending</span><small>Generated {new Date(map.generatedAt).toLocaleString()}</small></div>
    </aside>
    <main className="map-area">
      <div className="map-topbar"><div><strong>{displayNodes.length} screens</strong><span>Drag to pan · scroll to zoom · select a card to follow its path</span></div><button type="button" onClick={() => { setSelected(null); void fitView({ padding: 0.2, duration: 400 }); }}>Fit map</button></div>
      <ReactFlow nodes={displayNodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => { if (node.id.startsWith("section:")) setCollapsedRoles((current) => current.filter((role) => role !== node.data.screen.role)); else setSelected(node.id); }} onPaneClick={() => setSelected(null)} fitView minZoom={0.05} maxZoom={2} nodesDraggable={false} attributionPosition="bottom-left"><Background gap={22} color="#28383b" /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={(node) => roleColors[(node.data as CardData).screen.role] ?? "#667"} maskColor="rgba(9, 17, 19, .8)" /></ReactFlow>
      {selectedNode && <section className="detail-panel" aria-label="Selected screen details"><div className="detail-head"><span className="eyebrow">{selectedNode.role} · {selectedNode.kind}</span><button aria-label="Close details" onClick={() => setSelected(null)}>×</button></div><h2>{selectedNode.label}</h2><code>{selectedNode.url ?? selectedNode.id}</code>{selectedNode.capture?.status === "redirect" && <p className="empty">Redirects to {selectedNode.capture.resolvedUrl ?? "another route"}; the image shows the destination.</p>}<button type="button" className="preview-button" onClick={() => setPreview(selectedNode.id)}>Open screenshot ↗</button><h3>Next actions</h3>{outgoing.length ? <ul>{outgoing.map((edge) => <li key={edge.id}><button onClick={() => setSelected(edge.to)}><strong>{edge.action}</strong><small>{map.nodes.find((node) => node.id === edge.to)?.label} · {edge.evidence === "test-verified" ? "test verified" : "code inferred"}{edge.state ? ` · ${edge.state}` : ""}</small></button></li>)}</ul> : <p className="empty">No outgoing action is mapped yet.</p>}<h3>Arrive from</h3>{incoming.length ? <ul>{incoming.map((edge) => <li key={edge.id}><button onClick={() => setSelected(edge.from)}><strong>{edge.action}</strong><small>{map.nodes.find((node) => node.id === edge.from)?.label}</small></button></li>)}</ul> : <p className="empty">Entry point or an unmapped incoming action.</p>}<p className="source">Source: {selectedNode.source ?? "curated workflow"}</p></section>}
    </main>
    {previewNode && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPreview(null)}><div className="preview-modal" role="dialog" aria-modal="true" aria-label={`${previewNode.label} screenshot`} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">{previewNode.role} · {previewNode.kind}{previewNode.capture?.status === "test-artifact" ? " · test capture" : ""}</span><h2>{previewNode.label}</h2><code>{previewNode.url ?? previewNode.id}</code></div><button aria-label="Close screenshot" onClick={() => setPreview(null)}>×</button></header>{previewNode.capture ? <img src={`/${previewNode.capture.full ?? previewNode.capture.thumbnail}`} onError={(event) => { event.currentTarget.src = `/${previewNode.capture!.thumbnail}`; }} alt={`${previewNode.label} screen`} /> : <div className="modal-empty">Screenshot pending. Run <code>npm run experience-map:refresh</code> with the local app and simulator available.</div>}</div></div>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><ReactFlowProvider><MapViewer /></ReactFlowProvider></React.StrictMode>);
