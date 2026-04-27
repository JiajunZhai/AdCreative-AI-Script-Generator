import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

interface OracleTrendViewProps {
  intelList: any[];
  onChartClick?: (params: any) => void;
}

export const OracleTrendView: React.FC<OracleTrendViewProps> = ({ intelList, onChartClick }) => {
  const { t } = useTranslation();

  const options = useMemo(() => {
    // 1. Extract unique quarters (X) and categories (Y)
    const rawQuarters = new Set<string>();
    const rawCategories = new Set<string>();

    intelList.forEach((item) => {
      let xVal = (item.time || '').trim();
      if (xVal.length < 4) xVal = 'Unspecified'; // filter out garbage like "20"
      const yVal = item.category || item.tag || 'General';
      rawQuarters.add(xVal);
      rawCategories.add(yVal);
    });

    const xData = Array.from(rawQuarters).sort();
    const yData = Array.from(rawCategories).sort();

    // Prevent giant stretching blocks by padding axes
    while(xData.length < 6) xData.push(`_pad_x_${xData.length}`);
    while(yData.length < 4) yData.push(`_pad_y_${yData.length}`);

    // 2. Build the exact coordinate matrix
    const matrixCount: Record<string, number> = {};
    intelList.forEach((item) => {
      let x = (item.time || '').trim();
      if (x.length < 4) x = 'Unspecified';
      const y = item.category || item.tag || 'General';
      const key = `${x}::${y}`;
      matrixCount[key] = (matrixCount[key] || 0) + 1;
    });

    // 3. Format into ECharts Heatmap shape [xIndex, yIndex, value]
    const data: [number, number, number][] = [];
    let maxVal = 0;

    for (let i = 0; i < xData.length; i++) {
        for (let j = 0; j < yData.length; j++) {
            const isPad = xData[i].startsWith('_pad_x_') || yData[j].startsWith('_pad_y_');
            if (isPad) {
                // don't push anything to keep it completely transparent and empty
                continue;
            }
            const key = `${xData[i]}::${yData[j]}`;
            const val = matrixCount[key] || 0;
            if (val > maxVal) maxVal = val;
            data.push([i, j, val]);
        }
    }

    return {
      tooltip: {
        position: 'top',
        backgroundColor: 'var(--surface-container-high, rgba(255, 255, 255, 0.9))',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        textStyle: { color: 'var(--on-surface, #1e293b)' },
        formatter: (params: any) => {
          if (!params.value) return '';
          const x = xData[params.value[0]];
          const y = yData[params.value[1]];
          const count = params.value[2];
          return `<div class="font-bold flex flex-col gap-1 text-left min-w-[80px]">
                    <span class="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">${x}</span>
                    <span class="text-xs text-slate-800 dark:text-slate-200">${y}</span>
                    <span class="text-[10px] opacity-70 text-slate-500 dark:text-slate-400 mt-1 pb-1 border-b border-outline-variant/20 block">${t('oracle.trend_recorded', 'Recorded Intelligence')}</span>
                    <span class="text-lg text-emerald-700 dark:text-emerald-300 font-black">${count} <span class="text-xs opacity-50 font-normal">${t('oracle.trend_docs', 'Docs')}</span></span>
                  </div>`;
        }
      },
      grid: {
        top: 20,
        bottom: 80,
        left: 140,
        right: 20,
      },
      xAxis: {
        type: 'category',
        data: xData,
        splitArea: { show: false },
        axisLabel: { 
           color: '#64748b', fontSize: 10, fontFamily: 'monospace', rotate: 15,
           formatter: (v: string) => v.startsWith('_pad_x_') ? '' : v
        },
        axisLine: { lineStyle: { color: 'rgba(100,116,139,0.2)' } }
      },
      yAxis: {
        type: 'category',
        data: yData,
        splitArea: { show: false },
        axisLabel: { 
           color: '#475569', fontSize: 11, width: 120, overflow: 'truncate',
           formatter: (v: string) => v.startsWith('_pad_y_') ? '' : v
        },
        axisLine: { lineStyle: { color: 'rgba(100,116,139,0.2)' } }
      },
      visualMap: {
        min: 0,
        max: maxVal || 5, // fallback max
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        textStyle: { color: '#64748b', fontSize: 10 },
        inRange: {
          color: ['rgba(16, 185, 129, 0.02)', 'rgba(16, 185, 129, 0.5)', 'rgba(16, 185, 129, 1)', 'rgba(52, 211, 153, 1)']
          // Emerald to Light Emerald mapping
        }
      },
      series: [{
        name: t('oracle.trend_mentions', 'Mentions'),
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          color: '#ffffff',
          textShadowBlur: 2,
          textShadowColor: 'rgba(0,0,0,0.5)',
          fontSize: 10,
          formatter: (p: any) => p.value[2] > 0 ? p.value[2] : ''
        },
        itemStyle: {
           borderColor: 'rgba(100,116,139,0.1)',
           borderWidth: 2,
           borderRadius: 4
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(16, 185, 129, 0.5)'
          }
        }
      }]
    };
  }, [intelList, t]);

  if (intelList.length === 0) {
     return <div className="flex-1 flex items-center justify-center text-sm opacity-50 uppercase tracking-widest font-bold">{t('oracle.trend_empty', 'No trend data available')}</div>;
  }

  const onEvents = {
     'click': (params: any) => {
         if (onChartClick) onChartClick(params);
     }
  };

  return (
    <div className="flex-1 w-full h-full p-4 overflow-hidden flex flex-col">
       <ReactECharts
         option={options}
         style={{ height: '100%', width: '100%' }}
         opts={{ renderer: 'canvas' }}
         onEvents={onEvents}
       />
    </div>
  );
};
