import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

interface OracleGraphViewProps {
  intelList: any[];
  onNodeClick?: (params: any) => void;
}

export const OracleGraphView: React.FC<OracleGraphViewProps> = ({ intelList, onNodeClick }) => {
  const { t } = useTranslation();

  const options = useMemo(() => {
    // 1. Build Nodes
    const uniqueRegions = new Set<string>();
    const uniqueCategories = new Set<string>();
    
    intelList.forEach(item => {
        if(item.region) uniqueRegions.add(item.region);
        if(item.category) uniqueCategories.add(item.category);
    });

    const nodes: any[] = [];
    
    // Core node
    nodes.push({
        id: 'CORE',
        name: t('oracle.graph_core_nexus', 'Strategy Nexus'),
        symbolSize: 40,
        category: 0,
        itemStyle: { color: '#a7f3d0', borderColor: '#10b981', borderWidth: 2, shadowBlur: 15, shadowColor: 'rgba(16, 185, 129, 0.4)' },
        label: { show: true, position: 'bottom', color: '#1e293b', fontSize: 13, fontWeight: 'bold' }
    });

    // Region nodes
    Array.from(uniqueRegions).forEach(reg => {
       nodes.push({
           id: `REG_${reg}`,
           name: reg,
           symbolSize: 28,
           category: 1,
           itemStyle: { color: '#38bdf8' }, // Sky
           label: { show: true, position: 'right', color: '#0284c7', fontSize: 11, fontWeight: 'bold' }
       });
    });

    // Category nodes
    Array.from(uniqueCategories).forEach(cat => {
       // Estimate size by how many times it appears
       const count = intelList.filter(i => i.category === cat).length;
       const size = Math.min(Math.max(14, count * 5), 35);
       
       nodes.push({
           id: `CAT_${cat}`,
           name: cat,
           symbolSize: size,
           category: 2,
           itemStyle: { color: '#10b981' }, 
           label: { show: true, position: 'top', color: '#065f46', fontSize: 10 }
       });
    });

    // 2. Build Links
    const links: any[] = [];

    // Connect regions to core
    Array.from(uniqueRegions).forEach(reg => {
       const weight = intelList.filter(i => i.region === reg).length;
       links.push({
           source: 'CORE',
           target: `REG_${reg}`,
           value: weight,
           lineStyle: { width: Math.max(1, weight), curveness: 0.2, color: 'rgba(14, 165, 233, 0.4)' }
       });
    });

    // Connect Categories to Regions or Core if no region
    intelList.forEach(item => {
       const regNode = item.region ? `REG_${item.region}` : 'CORE';
       const catNode = `CAT_${item.category}`;
       
       if (item.category) {
           // check if link exists
           const existing = links.find(l => l.source === regNode && l.target === catNode);
           if (existing) {
               existing.value += 1;
               existing.lineStyle.width = Math.min(10, existing.value);
           } else {
               links.push({
                   source: regNode,
                   target: catNode,
                   value: 1,
                   lineStyle: { width: 1, curveness: 0.3, color: 'rgba(16, 185, 129, 0.3)' }
               });
           }
       }
    });

    const labelCore = t('oracle.graph_core', 'Core');
    const labelRegions = t('oracle.graph_regions', 'Regions');
    const labelStrategies = t('oracle.graph_strategies', 'Strategies');

    return {
      tooltip: {
         formatter: (params: any) => {
            if (params.dataType === 'node') {
               return `<div class="font-bold text-[11px] text-slate-800"><span class="w-2 h-2 inline-block rounded-full mr-1" style="background:${params.color}"></span> ${params.data.name}</div>`;
            }
            if (params.dataType === 'edge') {
               return `<span class="opacity-70 text-[10px] text-slate-600">${t('oracle.graph_affinity', 'Affinity:')} ${params.value}</span>`;
            }
         },
         backgroundColor: 'var(--surface-container-high, rgba(255, 255, 255, 0.9))',
         borderColor: 'rgba(0,0,0,0.1)',
         textStyle: { color: '#1e293b' }
      },
      legend: [{
         data: [labelCore, labelRegions, labelStrategies],
         textStyle: { color: '#64748b', fontSize: 10 },
         bottom: 10
      }],
      series: [{
         type: 'graph',
         layout: 'force',
         data: nodes,
         links: links,
         categories: [
            { name: labelCore },
            { name: labelRegions },
            { name: labelStrategies }
         ],
         roam: true,
         label: {
            position: 'right'
         },
         force: {
            repulsion: 300,
            edgeLength: [50, 150],
            gravity: 0.1
         },
         lineStyle: {
            color: 'source',
            curveness: 0.3
         },
         emphasis: {
            focus: 'adjacency',
            lineStyle: {
               width: 5
            }
         }
      }]
    };
  }, [intelList, t]);

  if (intelList.length === 0) {
     return <div className="flex-1 flex items-center justify-center text-sm opacity-50 uppercase tracking-widest font-bold">{t('oracle.vault_empty', 'Vault is empty')}</div>;
  }

  const onEvents = {
     'click': (params: any) => {
         if (params.dataType === 'node' && onNodeClick) {
             onNodeClick(params);
         }
     }
  };

  return (
    <div className="flex-1 w-full h-full p-4 overflow-hidden flex flex-col relative">
       {/* Background Grid simulation */}
       <div className="absolute inset-0 opacity-[0.4] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--outline-variant) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
       
       <ReactECharts
         option={options}
         style={{ height: '100%', width: '100%', zIndex: 10 }}
         opts={{ renderer: 'canvas' }}
         onEvents={onEvents}
       />
    </div>
  );
};
