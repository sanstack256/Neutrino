import React, { useState, useMemo } from 'react';
import { SubgraphData, GraphNode, GraphEdge } from '@neutrino/contracts';
import { Layers, Server, AlertTriangle, GitCommit, FileText, Users, Compass, Eye } from 'lucide-react';

interface GraphVisualizerProps {
  data: SubgraphData | null;
  highlightPath?: string[];
  height?: number;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data, highlightPath = [], height = 520 }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Compute 2D coordinates for nodes
  const layout = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) {
      return { nodePositions: new Map<string, { x: number; y: number }>(), width: 900, height };
    }

    const width = 900;
    const padding = 80;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    // Group nodes by label
    const labelGroups: Record<string, GraphNode[]> = {
      Incident: [],
      Service: [],
      Deployment: [],
      Evidence: [],
      Team: [],
      Other: [],
    };

    data.nodes.forEach((node) => {
      const lbl = node.label || 'Other';
      if (labelGroups[lbl]) {
        labelGroups[lbl].push(node);
      } else {
        labelGroups.Other.push(node);
      }
    });

    const positions = new Map<string, { x: number; y: number }>();

    // Layered X columns:
    // Left: Evidence
    // Center-Left: Incident
    // Center: Services
    // Center-Right: Deployments
    // Right: Teams
    const columnX: Record<string, number> = {
      Evidence: padding + usableW * 0.1,
      Incident: padding + usableW * 0.32,
      Service: padding + usableW * 0.55,
      Deployment: padding + usableW * 0.78,
      Team: padding + usableW * 0.95,
      Other: padding + usableW * 0.5,
    };

    Object.entries(labelGroups).forEach(([label, nodes]) => {
      const colX = columnX[label] || padding + usableW * 0.5;
      const count = nodes.length;
      if (count === 0) return;

      nodes.forEach((node, idx) => {
        const stepY = count > 1 ? usableH / (count + 1) : usableH / 2;
        const colY = padding + stepY * (idx + 1);
        positions.set(node.id, { x: colX, y: colY });
      });
    });

    return { nodePositions: positions, width, height };
  }, [data, height]);

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
    if (isHighlighted) return { fill: '#312e81', stroke: '#818cf8', text: '#e0e7ff' };
    switch (label) {
      case 'Incident':
        return { fill: '#450a0a', stroke: '#ef4444', text: '#fca5a5' };
      case 'Service':
        return { fill: '#172554', stroke: '#3b82f6', text: '#93c5fd' };
      case 'Deployment':
        return { fill: '#2e1065', stroke: '#a855f7', text: '#d8b4fe' };
      case 'Evidence':
        return { fill: '#422006', stroke: '#f59e0b', text: '#fde68a' };
      case 'Team':
        return { fill: '#064e3b', stroke: '#10b981', text: '#6ee7b7' };
      default:
        return { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' };
    }
  };

  const getNodeIcon = (label: string) => {
    switch (label) {
      case 'Incident':
        return <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-red-400" />;
      case 'Service':
        return <Server className="w-3.5 h-3.5 inline mr-1 text-blue-400" />;
      case 'Deployment':
        return <GitCommit className="w-3.5 h-3.5 inline mr-1 text-purple-400" />;
      case 'Evidence':
        return <FileText className="w-3.5 h-3.5 inline mr-1 text-amber-400" />;
      case 'Team':
        return <Users className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-400" />;
    }
  };

  return (
    <div className="relative bg-neutrino-900 border border-neutrino-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Legend Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-neutrino-850 border-b border-neutrino-800 text-xs">
        <div className="flex items-center space-x-4">
          <span className="text-slate-400 font-mono text-[11px] uppercase">Entity Types:</span>
          <span className="flex items-center text-red-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" /> Incident
          </span>
          <span className="flex items-center text-blue-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" /> Service
          </span>
          <span className="flex items-center text-purple-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-1.5" /> Deployment
          </span>
          <span className="flex items-center text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" /> Evidence
          </span>
          <span className="flex items-center text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" /> Team
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Nodes: <span className="text-slate-200">{data.nodes.length}</span> | Edges:{' '}
          <span className="text-slate-200">{data.edges.length}</span>
        </div>
      </div>

      {/* Main SVG Graph */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="w-full h-auto min-w-[700px] select-none"
          style={{ height }}
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
              <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
            </marker>
          </defs>

          {/* Render Directed Edges */}
          {data.edges.map((edge, idx) => {
            const srcPos = layout.nodePositions.get(edge.source);
            const tgtPos = layout.nodePositions.get(edge.target);
            if (!srcPos || !tgtPos) return null;

            const isHighlighted =
              highlightPath.includes(edge.source) && highlightPath.includes(edge.target);

            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2;

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke={isHighlighted ? '#818cf8' : '#334155'}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  strokeDasharray={edge.type === 'RELATED_TO' ? '4 3' : undefined}
                  markerEnd={isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                  className="transition-all duration-300"
                />
                <text
                  x={midX}
                  y={midY - 4}
                  fill={isHighlighted ? '#a5b4fc' : '#64748b'}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {edge.type}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {data.nodes.map((node) => {
            const pos = layout.nodePositions.get(node.id);
            if (!pos) return null;

            const isHighlighted = highlightPath.includes(node.id);
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;
            const colors = getNodeColor(node.label, isHighlighted);

            const width = 110;
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
                  stroke={isSelected ? '#f8fafc' : isHovered ? '#cbd5e1' : colors.stroke}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  className="transition-colors duration-200"
                />

                {/* Node Label Text */}
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
                  {node.id.length > 15 ? `${node.id.slice(0, 13)}...` : node.id}
                </text>

                {/* Subtitle / Type */}
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
                  <span className="text-indigo-400">{k}:</span>{' '}
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
