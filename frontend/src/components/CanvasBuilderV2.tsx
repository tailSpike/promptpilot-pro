import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeType = 'PROMPT' | 'TRANSFORM' | 'CONDITION' | 'DELAY' | 'WEBHOOK' | 'DECISION';

interface CanvasNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
}

interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  mappingPath?: string;
}

interface PersistedCanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  zoom: number;
}

const LS_KEY_LAST_SAVED = 'ppp-canvas-last-saved';

interface CanvasBuilderV2Props {
  workflowId?: string | null;
}

export const CanvasBuilderV2: React.FC<CanvasBuilderV2Props> = ({ workflowId }) => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [zoom, setZoom] = useState<number>(1);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const pendingConnection = useRef<{ sourceId: string } | null>(null);
  const [edgePopover, setEdgePopover] = useState<{ edgeId: string; open: boolean }>({ edgeId: '', open: false });
  const [edgeMappingDraft, setEdgeMappingDraft] = useState<string>('');
  const [connectHint, setConnectHint] = useState<string>('');
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const inputHandleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const outputHandleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const NODE_W = 160;
  const NODE_H = 80;
  const INPUT_ANCHOR_RADIUS = 18; // px tolerance for dropping near a node input
  // Handle visual geometry (Tailwind classes: w-3/h-3 => 12px, -left-2/-right-2 => -8px offset)
  const HANDLE_SIZE = 12; // px
  const HANDLE_OUTSET = 8; // px absolute offset outside the node edge
  // Centers relative to node edge
  const OUTPUT_HANDLE_OFFSET_X = HANDLE_OUTSET - HANDLE_SIZE / 2; // +2px to the right of node right edge
  const INPUT_HANDLE_OFFSET_X = HANDLE_SIZE / 2 - HANDLE_OUTSET; // -2px to the left of node left edge

  const [dragging, setDragging] = useState<{ nodeId: string; startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Compute storage key per workflow; undefined when creating new workflow (no id)
  const storageKey = useMemo(() => {
    return workflowId ? `${LS_KEY_LAST_SAVED}:${workflowId}` : undefined;
  }, [workflowId]);

  // Rehydrate from last saved (local storage) per workflow on mount/id change
  useEffect(() => {
    if (!storageKey) return; // skip rehydrate for new workflow page (no id yet)
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCanvasState;
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          setZoom(parsed.zoom ?? 1);
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Hook into nearest form submit to persist current graph
  useEffect(() => {
    const form = document.querySelector('form');
    if (!form) return;
    const handler = () => {
      // Only persist when tied to a specific workflow id
      if (!storageKey) return;
      try {
        const payload: PersistedCanvasState = { nodes, edges, zoom };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    };
    form.addEventListener('submit', handler);
    return () => form.removeEventListener('submit', handler);
  }, [nodes, edges, zoom, storageKey]);

  const addNode = useCallback((type: NodeType) => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const next: CanvasNode = {
      id,
      type,
      label: type,
      position: { x: 100 + nodes.length * 80, y: 100 + nodes.length * 40 },
    };
    setNodes((prev: CanvasNode[]) => [...prev, next]);
  }, [nodes.length]);

  const onStartConnect = useCallback((sourceId: string) => {
    pendingConnection.current = { sourceId };
    setConnectHint(`Connecting from ${sourceId}… click an input handle to finish`);
    // Initialize pending line at the source output anchor
    setPendingPoint(null); // will update on mouse move
  }, []);

  const onFinishConnect = useCallback((targetId: string) => {
    const pending = pendingConnection.current;
    pendingConnection.current = null;
    setConnectHint('');
    setPendingPoint(null);
    if (!pending) return;
    if (pending.sourceId === targetId) return; // no self-connect
    const id = `e_${pending.sourceId}_${targetId}`;
    setEdges((prev: CanvasEdge[]) => {
      const exists = prev.find((e: CanvasEdge) => e.id === id);
      const nextEdges = exists ? prev : [...prev, { id, sourceId: pending.sourceId, targetId }];
      return nextEdges;
    });
    // Show mapping popover immediately
    setEdgePopover({ edgeId: id, open: true });
    setEdgeMappingDraft('');
  }, []);

  const applyEdgeMapping = useCallback(() => {
    if (!edgePopover.open) return;
    const { edgeId } = edgePopover;
    setEdges((prev: CanvasEdge[]) => prev.map((e: CanvasEdge) => (e.id === edgeId ? { ...e, mappingPath: edgeMappingDraft } : e)));
    setEdgePopover({ edgeId: '', open: false });
    setEdgeMappingDraft('');
  }, [edgePopover, edgeMappingDraft]);

  const zoomIn = useCallback(() => setZoom((z: number) => Math.min(2, z + 0.1)), []);
  const zoomOut = useCallback(() => setZoom((z: number) => Math.max(0.2, z - 0.1)), []);

  const graphStyle = useMemo(() => ({ transform: `scale(${zoom})`, transformOrigin: '0 0' as const }), [zoom]);

  // Compute visual handle center using DOM if available; fallback to math constants
  const getHandleCenter = useCallback((nodeId: string, kind: 'input' | 'output') => {
    const g = graphRef.current;
    const el = (kind === 'input' ? inputHandleRefs.current[nodeId] : outputHandleRefs.current[nodeId]);
    if (g && el) {
      const gRect = g.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - gRect.left) / zoom;
      const cy = (r.top + r.height / 2 - gRect.top) / zoom;
      return { x: cx, y: cy };
    }
    // Fallback to computed positions
    const n = nodes.find((n) => n.id === nodeId);
    if (!n) return null;
    if (kind === 'output') {
      return { x: n.position.x + NODE_W + OUTPUT_HANDLE_OFFSET_X, y: n.position.y + NODE_H / 2 };
    }
    return { x: n.position.x + INPUT_HANDLE_OFFSET_X, y: n.position.y + NODE_H / 2 };
  }, [nodes, zoom, INPUT_HANDLE_OFFSET_X, OUTPUT_HANDLE_OFFSET_X, NODE_W, NODE_H]);


  const submitNearestForm = useCallback(() => {
    try {
      const form = document.querySelector('form') as HTMLFormElement | null;
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="mt-6 border rounded-md p-3" data-testid="builder-v2-canvas">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className="px-2 py-1 border rounded text-sm"
          data-testid="canvas-step-library-button"
          onClick={() => setLibraryOpen((v) => !v)}
        >
          {libraryOpen ? 'Close Library' : 'Open Step Library'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="px-2 py-1 border rounded text-sm" data-testid="canvas-zoom-out" onClick={zoomOut}>-</button>
          <span className="text-xs">{Math.round(zoom * 100)}%</span>
          <button type="button" className="px-2 py-1 border rounded text-sm" data-testid="canvas-zoom-in" onClick={zoomIn}>+</button>
          <button
            type="button"
            className={`px-3 py-1 border rounded text-sm ${storageKey ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            data-testid="canvas-save-button"
            onClick={storageKey ? submitNearestForm : undefined}
            title={storageKey ? 'Save workflow' : 'Create the workflow to enable Canvas Save'}
            aria-disabled={!storageKey}
            disabled={!storageKey}
          >
            Save
          </button>
        </div>
      </div>

      {libraryOpen ? (
        <div className="mb-3 p-2 border rounded bg-gray-50">
          <div className="text-xs font-semibold mb-2">Quick Add</div>
          <div className="flex gap-2">
            <button type="button" className="px-2 py-1 border rounded text-xs" data-testid="canvas-add-step-PROMPT" onClick={() => addNode('PROMPT')}>Add PROMPT</button>
            <button type="button" className="px-2 py-1 border rounded text-xs" data-testid="canvas-add-step-TRANSFORM" onClick={() => addNode('TRANSFORM')}>Add TRANSFORM</button>
          </div>
          {!storageKey ? (
            <div className="mt-2 text-[10px] text-gray-600">
              Note: Save is enabled after you create the workflow. Use the Create/Save button in the editor first.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative border rounded h-[420px] overflow-hidden" data-testid="canvas">
        {/* Minimap placeholder */}
        <div className="absolute right-2 bottom-2 bg-white/90 border rounded px-2 py-1 text-[10px]" data-testid="canvas-minimap">Mini-map</div>
        {connectHint ? (
          <div className="absolute left-2 bottom-2 bg-yellow-50 text-yellow-900 border border-yellow-200 rounded px-2 py-1 text-[10px]">
            {connectHint}
          </div>
        ) : null}

        {/* Graph layer */}
        <div
          className="absolute inset-0 origin-top-left"
          ref={graphRef}
          style={graphStyle}
          onMouseMove={(e) => {
            if (!graphRef.current) return;
            const rect = graphRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            if (pendingConnection.current) {
              setPendingPoint({ x, y });
            }
            if (dragging) {
              const dx = x - dragging.startX;
              const dy = y - dragging.startY;
              setNodes((prev) => prev.map((n) => n.id === dragging.nodeId ? {
                ...n,
                position: { x: dragging.originX + dx, y: dragging.originY + dy }
              } : n));
            }
          }}
          onMouseUp={(e) => {
            if (!graphRef.current) return;
            const rect = graphRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;

            // Finish drag
            if (dragging) {
              setDragging(null);
            }

            // If connecting, allow dropping near a node input anchor
            if (pendingConnection.current) {
              const maybeTarget = nodes.find((n) => {
                const center = getHandleCenter(n.id, 'input');
                if (!center) return false;
                const dx = x - center.x;
                const dy = y - center.y;
                return Math.sqrt(dx * dx + dy * dy) <= INPUT_ANCHOR_RADIUS;
              });
              if (maybeTarget) {
                onFinishConnect(maybeTarget.id);
              } else {
                // cancel
                setPendingPoint(null);
                setConnectHint('');
                pendingConnection.current = null;
              }
            }
          }}
        >
          {/* Edges: SVG layer in graph coordinates */}
          <svg className="absolute inset-0" width="100%" height="100%" style={{ overflow: 'visible' }}>
            {edges.map((e) => {
              const src = nodes.find((n) => n.id === e.sourceId);
              const dst = nodes.find((n) => n.id === e.targetId);
              if (!src || !dst) return null;
              // Anchor to visual handle centers (DOM-based when available)
              const sCenter = getHandleCenter(src.id, 'output');
              const tCenter = getHandleCenter(dst.id, 'input');
              if (!sCenter || !tCenter) return null;
              const sx = sCenter.x;
              const sy = sCenter.y;
              const tx = tCenter.x;
              const ty = tCenter.y;
              const dx = Math.max(40, Math.abs(tx - sx) / 2);
              const dir = tx >= sx ? 1 : -1;
              const c1x = sx + dir * dx;
              const c1y = sy;
              const c2x = tx - dir * dx;
              const c2y = ty;
              const d = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
              return (
                <path
                  key={e.id}
                  d={d}
                  stroke="#7c3aed"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  className="cursor-pointer"
                  data-testid={`canvas-edge-${e.id}`}
                  onClick={() => {
                    setEdgePopover({ edgeId: e.id, open: true });
                    setEdgeMappingDraft(e.mappingPath || '');
                  }}
                />
              );
            })}
            {pendingConnection.current && pendingPoint && (() => {
              const src = nodes.find((n) => n.id === pendingConnection.current!.sourceId);
              if (!src) return null;
              const sCenter = getHandleCenter(src.id, 'output');
              if (!sCenter) return null;
              const sx = sCenter.x;
              const sy = sCenter.y;
              const tx = pendingPoint.x;
              const ty = pendingPoint.y;
              const dx = Math.max(40, Math.abs(tx - sx) / 2);
              const dir = tx >= sx ? 1 : -1;
              const c1x = sx + dir * dx;
              const c1y = sy;
              const c2x = tx - dir * dx;
              const c2y = ty;
              const d = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
              return <path d={d} stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" fill="none" strokeDasharray="6 4" />;
            })()}
          </svg>

          {/* Nodes */}
            {nodes.map((n) => (
            <div
              key={n.id}
              className="absolute w-[160px] h-[80px] bg-white border rounded shadow-sm relative"
              style={{ left: n.position.x, top: n.position.y }}
              data-testid={`canvas-node-${n.id}`}
                onMouseDown={(e) => {
                  if (!graphRef.current) return;
                  const rect = graphRef.current.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / zoom;
                  const y = (e.clientY - rect.top) / zoom;
                  setDragging({ nodeId: n.id, startX: x, startY: y, originX: n.position.x, originY: n.position.y });
                }}
            >
              <div className="text-xs font-semibold px-2 py-1 border-b">{n.label}</div>
              <div className="p-2 text-[10px] text-gray-600">Type: {n.type}</div>
              {/* Handles */}
              <div
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-500 cursor-crosshair z-20"
                data-testid="handle-output"
                ref={(el) => { outputHandleRefs.current[n.id] = el; }}
                onMouseDown={() => onStartConnect(n.id)}
                onClick={() => onStartConnect(n.id)}
                title="Start connection"
              />
              <div
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 cursor-crosshair z-20"
                data-testid="handle-input"
                ref={(el) => { inputHandleRefs.current[n.id] = el; }}
                onMouseUp={() => onFinishConnect(n.id)}
                onClick={() => onFinishConnect(n.id)}
                title="Finish connection"
              />
            </div>
          ))}
        </div>
      </div>

      {edgePopover.open ? (
        <div className="mt-3 p-3 border rounded bg-white shadow" data-testid="edge-popover">
          <div className="text-sm font-semibold mb-2">Map Edge Output → Input</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Path</label>
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="output.text"
              value={edgeMappingDraft}
              onChange={(e) => setEdgeMappingDraft(e.target.value)}
              data-testid="edge-mapping-path"
            />
            <button type="button" className="px-2 py-1 border rounded text-sm" data-testid="edge-mapping-apply" onClick={applyEdgeMapping}>Apply</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CanvasBuilderV2;
