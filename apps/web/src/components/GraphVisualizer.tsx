import React, { useState, useMemo } from 'react';
import { SubgraphData, GraphNode, GraphEdge } from '@neutrino/contracts';
import {
  Layers,
  Server,
  AlertTriangle,
  GitCommit,
  FileText,
  Users,
  Compass,
  Database,
  Filter,
} from 'lucide-react';

interface GraphVisualizerProps {
  data: SubgraphData | null;
  highlightPath?: string[];
  height?: number;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({
  data,
  highlightPath = [],
  height = 560,
}) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'core' | 'all'>('core');

  // Filter nodes and edges based on view mode
  const { visibleNodes, visibleEdges, rawEvidenceCount } = useMemo(() => {
    if (!data || !data.nodes) {
      return { visibleNodes: [], visibleEdges: [], rawEvidenceCount: 0 };
    }

    const allEvidence = data.nodes.filter((n) => n.label === 'Evidence');
    const rawEvidenceCount = allEvidence.length;

    if (filterMode === 'core' && rawEvidenceCount > 6) {
      // In core mode, collapse large raw telemetry evidence into a single clean summary node
      const nonEvidenceNodes = data.nodes.filter((n) => n.label !== 'Evidence');
      const summaryEvidenceNode: GraphNode = {
        id: `evidence-summary-(${rawEvidenceCount})`,
        label: 'Evidence',
        properties: {
          id: `evidence-summary-(${rawEvidenceCount})`,
          summary: `${rawEvidenceCount} telemetry records collected for this incident`,
          count: rawEvidenceCount,
          note: 'Switch to "All Entities" to inspect individual events',
        },
      };

      const nodes = [...nonEvidenceNodes, summaryEvidenceNode];

      // Replace individual evidence edges with summary edges
      const targetIncidents = new Set(
        data.edges.filter((e) => e.type === 'OBSERVED_IN').map((e) => e.target)
      );
      const targetSources = new Set(
        data.edges.filter((e) => e.type === 'REFERENCES').map((e) => e.target)
      );

      const nonEvidenceEdges = data.edges.filter(
        (e) => e.type !== 'OBSERVED_IN' && e.type !== 'REFERENCES'
      );

      const summaryEdges: GraphEdge[] = [];
      targetIncidents.forEach((incId) => {
        summaryEdges.push({
          source: summaryEvidenceNode.id,
          target: incId,
          type: 'OBSERVED_IN',
        });
      });
      targetSources.forEach((srcId) => {
        summaryEdges.push({
          source: summaryEvidenceNode.id,
          target: srcId,
          type: 'REFERENCES',
        });
      });

      return {
        visibleNodes: nodes,
        visibleEdges: [...nonEvidenceEdges, ...summaryEdges],
        rawEvidenceCount,
      };
    }

    return {
      visibleNodes: data.nodes,
      visibleEdges: data.edges,
      rawEvidenceCount,
    };
  }, [data, filterMode]);

  // Compute collision-free layout
  const layout = useMemo(() => {
    if (!visibleNodes || visibleNodes.length === 0) {
      return {
        nodePositions: new Map<string, { x: number; y: number }>(),
        width: 1240,
        height,
      };
    }

    // Categorize nodes by topological layers
    const groups: {
      SourceRecord: GraphNode[];
      EvidenceColA: GraphNode[];
      EvidenceColB: GraphNode[];
      Incident: GraphNode[];
      Service: GraphNode[];
      Deployment: GraphNode[];
      Team: GraphNode[];
      Other: GraphNode[];
    } = {
      SourceRecord: [],
      EvidenceColA: [],
      EvidenceColB: [],
      Incident: [],
      Service: [],
      Deployment: [],
      Team: [],
      Other: [],
    };

    visibleNodes.forEach((node) => {
      const lbl = node.label || 'Other';
      if (lbl === 'SourceRecord') {
        groups.SourceRecord.push(node);
      } else if (lbl === 'Evidence') {
        // If multiple evidence items, distribute evenly across two sub-columns to prevent vertical stacking
        if (groups.EvidenceColA.length <= groups.EvidenceColB.length) {
          groups.EvidenceColA.push(node);
        } else {
          groups.EvidenceColB.push(node);
        }
      } else if (lbl === 'Incident') {
        groups.Incident.push(node);
      } else if (lbl === 'Service') {
        groups.Service.push(node);
      } else if (lbl === 'Deployment') {
        groups.Deployment.push(node);
      } else if (lbl === 'Team') {
        groups.Team.push(node);
      } else {
        groups.Other.push(node);
      }
    });

    const positions = new Map<string, { x: number; y: number }>();

    // 6-layer horizontal distribution across 1240px width
    // Ensures at least 160-200px gap between column centers
    const hasEvidenceB = groups.EvidenceColB.length > 0;
    const colX: Record<string, number> = {
      SourceRecord: 100,
      EvidenceColA: hasEvidenceB ? 260 : 310,
      EvidenceColB: 410,
      Incident: hasEvidenceB ? 580 : 520,
      Service: hasEvidenceB ? 780 : 720,
      Deployment: hasEvidenceB ? 980 : 920,
      Team: hasEvidenceB ? 1160 : 1100,
      Other: hasEvidenceB ? 580 : 520,
    };

    const nodeHeight = 34;
    const minVerticalGap = 16;
    const minStepY = nodeHeight + minVerticalGap; // 50px minimum step between nodes

    // Find the maximum nodes in any single column to compute required SVG height
    const maxNodesInCol = Math.max(
      groups.SourceRecord.length,
      groups.EvidenceColA.length,
      groups.EvidenceColB.length,
      groups.Incident.length,
      groups.Service.length,
      groups.Deployment.length,
      groups.Team.length,
      1
    );

    const calculatedHeight = Math.max(height, maxNodesInCol * minStepY + 120);
    const canvasWidth = hasEvidenceB ? 1260 : 1200;

    // Distribute nodes vertically with guaranteed spacing
    Object.entries(groups).forEach(([groupName, nodes]) => {
      const count = nodes.length;
      if (count === 0) return;
      const x = colX[groupName] || 600;

      // Center column vertically within the calculated canvas
      const totalColHeight = (count - 1) * minStepY;
      const startY = Math.max(60, (calculatedHeight - totalColHeight) / 2);

      nodes.forEach((node, idx) => {
        const y = startY + idx * minStepY;
        positions.set(node.id, { x, y });
      });
    });

    return {
      nodePositions: positions,
      width: canvasWidth,
      height: calculatedHeight,
    };
  }, [visibleNodes, height]);

  if (!data || data.nodes.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center bg-neutrino-900 border border-neutrino-800 rounded-xl text-slate-500 font-mono text-xs"
        style={{ height }}
      >
        <Compass className="w-8 h-8 text-neutrino-700 mb-2 animate-spin-slow" />
        <span>No subgraph context to visualize.</span>
      </div>
    );
  }

  const getNodeColor = (label: string, isHighlighted: boolean) => {
    if (isHighlighted) return { fill: '#083344', stroke: '#06b6d4', text: '#cffafe' };
    switch (label) {
      case 'Incident':
        return { fill: '#450a0a', stroke: '#ef4444', text: '#fca5a5' };
      case 'Service':
        return { fill: '#0f2942', stroke: '#0284c7', text: '#7dd3fc' };
      case 'Deployment':
        return { fill: '#083344', stroke: '#06b6d4', text: '#67e8f9' };
      case 'Evidence':
        return { fill: '#422006', stroke: '#f59e0b', text: '#fde68a' };
      case 'Team':
        return { fill: '#064e3b', stroke: '#10b981', text: '#6ee7b7' };
      case 'SourceRecord':
        return { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' };
      default:
        return { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' };
    }
  };

  const getNodeIcon = (label: string) => {
    switch (label) {
      case 'Incident':
        return <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-red-400" />;
      case 'Service':
        return <Server className="w-3.5 h-3.5 inline mr-1 text-sky-400" />;
      case 'Deployment':
        return <GitCommit className="w-3.5 h-3.5 inline mr-1 text-cyan-400" />;
      case 'Evidence':
        return <FileText className="w-3.5 h-3.5 inline mr-1 text-amber-400" />;
      case 'Team':
        return <Users className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />;
      case 'SourceRecord':
        return <Database className="w-3.5 h-3.5 inline mr-1 text-slate-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-400" />;
    }
  };

  return (
    <div className="relative bg-neutrino-900 border border-neutrino-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Visualizer Top Bar & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-neutrino-850 border-b border-neutrino-800 text-xs gap-3">
        {/* Entity Types Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-mono text-[11px] uppercase">Entity Types:</span>
          <span className="flex items-center text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 mr-1.5" /> Source
          </span>
          <span className="flex items-center text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" /> Evidence
          </span>
          <span className="flex items-center text-red-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" /> Incident
          </span>
          <span className="flex items-center text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 mr-1.5" /> Service
          </span>
          <span className="flex items-center text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mr-1.5" /> Deployment
          </span>
          <span className="flex items-center text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> Team
          </span>
        </div>

        {/* View Mode & Counts */}
        <div className="flex items-center space-x-3">
          {rawEvidenceCount > 6 && (
            <div className="flex items-center bg-neutrino-900 p-0.5 rounded-lg border border-neutrino-750 font-mono text-[11px]">
              <button
                onClick={() => setFilterMode('core')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterMode === 'core'
                    ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Core Topology ({visibleNodes.length})
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterMode === 'all'
                    ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Entities ({data.nodes.length})
              </button>
            </div>
          )}

          <div className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
            Nodes: <span className="text-slate-200 font-semibold">{visibleNodes.length}</span> | Edges:{' '}
            <span className="text-slate-200 font-semibold">{visibleEdges.length}</span>
          </div>
        </div>
      </div>

      {/* Main Graph SVG Canvas with smooth scrolling */}
      <div className="relative overflow-x-auto overflow-y-auto max-h-[660px]">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          className="select-none block"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="18"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#475569" />
            </marker>
            <marker
              id="arrowhead-highlight"
              markerWidth="8"
              markerHeight="6"
              refX="18"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
            </marker>
          </defs>

          {/* Render Edges */}
          {visibleEdges.map((edge, idx) => {
            const srcPos = layout.nodePositions.get(edge.source);
            const tgtPos = layout.nodePositions.get(edge.target);
            if (!srcPos || !tgtPos) return null;

            const edgeKey = `${edge.source}-${edge.type}->${edge.target}`;
            const isHighlighted =
              highlightPath.includes(edge.source) && highlightPath.includes(edge.target);
            const isConnectedToHover =
              hoveredNode === edge.source || hoveredNode === edge.target;
            const isEdgeHovered = hoveredEdge === edgeKey;

            // Draw clean curved bezier connector
            const deltaX = tgtPos.x - srcPos.x;
            const curveOffset = Math.max(30, Math.abs(deltaX) * 0.35);
            const cpx1 = srcPos.x + (deltaX > 0 ? curveOffset : -curveOffset);
            const cpy1 = srcPos.y;
            const cpx2 = tgtPos.x - (deltaX > 0 ? curveOffset : -curveOffset);
            const cpy2 = tgtPos.y;
            const pathData = `M ${srcPos.x} ${srcPos.y} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${tgtPos.x} ${tgtPos.y}`;

            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2;
            const shouldShowLabel = isHighlighted || isConnectedToHover || isEdgeHovered;

            return (
              <g
                key={`edge-${idx}`}
                onMouseEnter={() => setHoveredEdge(edgeKey)}
                onMouseLeave={() => setHoveredEdge(null)}
                className="cursor-pointer"
              >
                {/* Invisible wide stroke for easy hover */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                />
                {/* Visible Path */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={
                    isHighlighted
                      ? '#06b6d4'
                      : isConnectedToHover || isEdgeHovered
                      ? '#38bdf8'
                      : '#334155'
                  }
                  strokeWidth={isHighlighted ? 2.5 : isConnectedToHover || isEdgeHovered ? 2 : 1.2}
                  strokeDasharray={edge.type === 'RELATED_TO' ? '4 3' : undefined}
                  markerEnd={isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                  className="transition-colors duration-150"
                />

                {/* Edge Label Pill (Shown clearly on hover/highlight to avoid clutter) */}
                {shouldShowLabel && (
                  <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                    <rect
                      x={-edge.type.length * 3.5 - 6}
                      y="-9"
                      width={edge.type.length * 7 + 12}
                      height="18"
                      rx="4"
                      fill="#0f172a"
                      stroke={isHighlighted ? '#06b6d4' : '#475569'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill={isHighlighted ? '#67e8f9' : '#cbd5e1'}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {edge.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Nodes (Guaranteed No Overlaps) */}
          {visibleNodes.map((node) => {
            const pos = layout.nodePositions.get(node.id);
            if (!pos) return null;

            const isHighlighted = highlightPath.includes(node.id);
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;
            const colors = getNodeColor(node.label, isHighlighted);

            const width = 124;
            const height = 34;

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => setSelectedNode(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-transform duration-150"
              >
                {/* Node Box */}
                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx="6"
                  fill={colors.fill}
                  stroke={isSelected ? '#f8fafc' : isHovered ? '#38bdf8' : colors.stroke}
                  strokeWidth={isSelected ? 2 : isHovered ? 1.8 : 1.2}
                  className="transition-colors duration-150"
                />

                {/* Node Title */}
                <text
                  x="0"
                  y="-2"
                  fill={colors.text}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {node.id.length > 17 ? `${node.id.slice(0, 15)}...` : node.id}
                </text>

                {/* Subtitle / Label */}
                <text
                  x="0"
                  y="10"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  className="pointer-events-none uppercase tracking-wider"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute bottom-4 right-4 max-w-sm bg-neutrino-850/95 backdrop-blur border border-neutrino-700 p-4 rounded-xl shadow-2xl text-xs z-20">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutrino-750">
              <div className="flex items-center">
                {getNodeIcon(selectedNode.label)}
                <span className="font-mono font-bold text-slate-100">{selectedNode.id}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold ml-3"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 font-mono text-[11px] max-h-48 overflow-y-auto">
              <p className="text-slate-400">
                <span className="text-slate-500">Label:</span> {selectedNode.label}
              </p>
              {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                <div key={k} className="truncate">
                  <span className="text-cyan-400">{k}:</span>{' '}
                  <span className="text-slate-300">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
