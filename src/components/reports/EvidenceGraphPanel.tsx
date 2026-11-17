import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { AnyScanReport } from '../../types/forensics';

interface EvidenceNodeData extends Record<string, unknown> {
  label: string;
  sublabel: string;
  findingId?: string;
  tone: 'base' | 'exposure' | 'danger';
}

function ForensicNode({ data }: { data: EvidenceNodeData }) {
  const borderClass =
    data.tone === 'danger'
      ? 'border-[#FF4B4B] bg-[#FFF2F2]'
      : data.tone === 'exposure'
        ? 'border-[#95ba07] bg-[#ECFFB6]/60'
        : 'border-[#08090B]/15 bg-white';

  return (
    <div
      className={`px-3 py-2 rounded-2xl border text-left min-w-[148px] max-w-[190px] shadow-xs ${borderClass}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#00545F]" />
      <div className="font-display text-[11px] font-bold text-[#08090B] truncate">
        {data.label}
      </div>
      <div className="font-mono text-[10px] text-[#525866] truncate mt-0.5">
        {data.sublabel}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[#08090B]" />
    </div>
  );
}

const nodeTypes = { forensic: ForensicNode };

interface EvidenceGraphPanelProps {
  report: AnyScanReport;
  onSelectFindingNode: (findingId: string) => void;
}

export function EvidenceGraphPanel({
  report,
  onSelectFindingNode,
}: EvidenceGraphPanelProps) {
  const { nodes, edges } = useMemo(() => {
    const present = report.findings.filter((f) => f.present);
    const fileLabel =
      report.kind === 'text' ? report.sourceLabel : report.fileName;

    const graphNodes: Node<EvidenceNodeData>[] = [
      {
        id: 'origin',
        type: 'forensic',
        position: { x: 10, y: 120 },
        data: {
          label: 'Original Input',
          sublabel: fileLabel,
          tone: 'base',
        },
      },
      {
        id: 'surface',
        type: 'forensic',
        position: { x: 230, y: 120 },
        data: {
          label: 'Embedded Metadata',
          sublabel: `${present.length} signal(s) found`,
          tone: present.length > 0 ? 'exposure' : 'base',
        },
      },
      {
        id: 'recipient',
        type: 'forensic',
        position: { x: 690, y: 120 },
        data: {
          label: 'Sharing Surface',
          sublabel: 'Any recipient inspects file',
          tone: 'base',
        },
      },
    ];

    const graphEdges: Edge[] = [
      {
        id: 'e-origin-surface',
        source: 'origin',
        target: 'surface',
        animated: true,
        style: { stroke: '#00545F' },
      },
    ];

    present.forEach((finding, idx) => {
      const yPos = 25 + idx * 72;
      const nodeId = `finding-${finding.id}`;
      const isHigh =
        finding.id === 'where_gps' ||
        finding.id === 'device_serial' ||
        finding.id === 'pdf_author';
      graphNodes.push({
        id: nodeId,
        type: 'forensic',
        position: { x: 460, y: yPos },
        data: {
          label: finding.label,
          sublabel: finding.sourceTag,
          findingId: finding.id,
          tone: isHigh ? 'danger' : 'exposure',
        },
      });

      graphEdges.push({
        id: `e-surf-${nodeId}`,
        source: 'surface',
        target: nodeId,
        animated: true,
        style: { stroke: isHigh ? '#FF4B4B' : '#95ba07' },
      });
      graphEdges.push({
        id: `e-${nodeId}-rec`,
        source: nodeId,
        target: 'recipient',
        style: { stroke: '#94A3B8' },
      });
    });

    if (present.length === 0) {
      graphEdges.push({
        id: 'e-clean-rec',
        source: 'surface',
        target: 'recipient',
        style: { stroke: '#12A36B' },
      });
    }

    return { nodes: graphNodes, edges: graphEdges };
  }, [report]);

  return (
    <section
      aria-label="Evidence Network Graph"
      className="card-unseen p-4 sm:p-5 space-y-3"
    >
      <div>
        <h3 className="font-mono text-xs tracking-[0.14em] font-bold text-[#08090B] uppercase">
          EVIDENCE RELATIONSHIP GRAPH
        </h3>
        <p className="font-sans text-[11px] text-[#525866]">
          Conditional graph built strictly from detected fields. Click any finding node to highlight its supporting metadata row.
        </p>
      </div>

      <div className="h-72 w-full rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          onNodeClick={(_evt, node) => {
            const fId = (node.data as EvidenceNodeData)?.findingId;
            if (fId) onSelectFindingNode(fId);
          }}
        >
          <Background color="#CBD5E1" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
