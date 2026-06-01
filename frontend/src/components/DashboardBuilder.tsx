/**
 * DashboardBuilder
 *
 * Standardized on react-grid-layout for resizable, draggable widget positioning.
 * Layout is persisted to localStorage keyed by walletAddress + "dashboard_layout".
 * Layout changes are debounced 500ms before writing.
 * Each widget is wrapped in DashboardErrorBoundary.
 * WidgetLibrary slides in from the right.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Edit3, Save, Download, X, Package, RotateCcw, PanelRight } from 'lucide-react';
import WidgetLibrary from './WidgetLibrary';
import WidgetSystem from './WidgetSystem';
import LineChartWidget from './widgets/LineChartWidget';
import BarChartWidget from './widgets/BarChartWidget';
import PieChartWidget from './widgets/PieChartWidget';
import StatCardWidget from './widgets/StatCardWidget';
import ProposalListWidget from './widgets/ProposalListWidget';
import CalendarWidget from './widgets/CalendarWidget';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import type { WidgetConfig, WidgetType, LayoutItem } from '../types/dashboard';
import { dashboardTemplates, saveDashboardLayout, loadDashboardLayout, clearDashboardLayout } from '../utils/dashboardTemplates';
import { useWallet } from '../hooks/useWallet';

interface DashboardBuilderProps {
  initialWidgets?: WidgetConfig[];
}

const COLS = 12;
const ROW_HEIGHT = 80;
const WIDGET_STORAGE_KEY = 'vaultdao-dashboard-widgets';

function renderWidgetContent(widget: WidgetConfig, onDrillDown: (data: unknown) => void): React.ReactNode {
  switch (widget.type) {
    case 'line-chart': return <LineChartWidget title={widget.title} onDrillDown={onDrillDown} />;
    case 'bar-chart': return <BarChartWidget title={widget.title} onDrillDown={onDrillDown} />;
    case 'pie-chart': return <PieChartWidget title={widget.title} onDrillDown={onDrillDown} />;
    case 'stat-card': return <StatCardWidget title={widget.title} value="0" />;
    case 'proposal-list': return <ProposalListWidget title={widget.title} />;
    case 'calendar': return <CalendarWidget title={widget.title} />;
    default: return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Unknown widget</div>;
  }
}

/** Convert DashboardTemplate LayoutItem[] to react-grid-layout Layout[] */
function toRGLLayout(items: LayoutItem[]): Layout[] {
  return items.map(item => ({
    i: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
    minW: item.minW ?? 2, minH: item.minH ?? 2,
  }));
}

/** Default layout for a widget not in any template */
function defaultLayoutItem(widgetId: string, index: number): Layout {
  return { i: widgetId, x: (index * 4) % COLS, y: Math.floor(index / 3) * 4, w: 4, h: 4, minW: 2, minH: 2 };
}

const DashboardBuilder: React.FC<DashboardBuilderProps> = ({ initialWidgets = [] }) => {
  const { address: walletAddress } = useWallet();
  const [editMode, setEditMode] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showWidgetSystem, setShowWidgetSystem] = useState(false);
  const [drillDownData, setDrillDownData] = useState<{ widget: string; data: unknown } | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'png' | 'pdf' | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load widgets from localStorage or use initialWidgets
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const stored = localStorage.getItem(WIDGET_STORAGE_KEY);
      return stored ? JSON.parse(stored) : initialWidgets;
    } catch { return initialWidgets; }
  });

  // Load layout from localStorage (wallet-keyed) or derive from template
  const [layout, setLayout] = useState<Layout[]>(() => {
    try {
      const saved = loadDashboardLayout(walletAddress ?? undefined) as { layout?: LayoutItem[] } | null;
      if (saved?.layout) return toRGLLayout(saved.layout);
    } catch { /* ignore */ }
    // Derive from first template
    const tpl = dashboardTemplates[0];
    if (tpl) return toRGLLayout(tpl.layout.layout);
    return [];
  });

  // Re-load layout when wallet changes
  useEffect(() => {
    if (!walletAddress) return;
    try {
      const saved = loadDashboardLayout(walletAddress) as { layout?: LayoutItem[] } | null;
      if (saved?.layout) {
        setLayout(toRGLLayout(saved.layout));
        return;
      }
    } catch { /* ignore */ }
    // First load for this wallet — apply default template
    const tpl = dashboardTemplates[0];
    if (tpl) setLayout(toRGLLayout(tpl.layout.layout));
  }, [walletAddress]);

  // Debounced persist on layout change
  const persistLayout = useCallback((newLayout: Layout[], newWidgets: WidgetConfig[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(newWidgets));
      saveDashboardLayout({ layout: newLayout, widgets: newWidgets }, walletAddress ?? undefined);
    }, 500);
  }, [walletAddress]);

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout);
    persistLayout(newLayout, widgets);
  }, [widgets, persistLayout]);

  const addWidget = useCallback((type: WidgetType) => {
    const id = `widget-${Date.now()}`;
    const newWidget: WidgetConfig = {
      id, type,
      title: type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    };
    const newLayoutItem: Layout = defaultLayoutItem(id, widgets.length);
    setWidgets(prev => {
      const updated = [...prev, newWidget];
      persistLayout([...layout, newLayoutItem], updated);
      return updated;
    });
    setLayout(prev => [...prev, newLayoutItem]);
    setShowLibrary(false);
  }, [widgets.length, layout, persistLayout]);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const updated = prev.filter(w => w.id !== id);
      const newLayout = layout.filter(l => l.i !== id);
      persistLayout(newLayout, updated);
      return updated;
    });
    setLayout(prev => prev.filter(l => l.i !== id));
  }, [layout, persistLayout]);

  const handleSave = useCallback(() => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgets));
    saveDashboardLayout({ layout, widgets }, walletAddress ?? undefined);
    setEditMode(false);
  }, [layout, widgets, walletAddress]);

  const handleReset = useCallback(() => {
    clearDashboardLayout(walletAddress ?? undefined);
    localStorage.removeItem(WIDGET_STORAGE_KEY);
    const tpl = dashboardTemplates[0];
    if (tpl) {
      setWidgets(tpl.layout.widgets);
      setLayout(toRGLLayout(tpl.layout.layout));
    }
  }, [walletAddress]);

  const loadTemplate = useCallback((templateId: string) => {
    const tpl = dashboardTemplates.find(t => t.id === templateId);
    if (tpl) {
      setWidgets(tpl.layout.widgets);
      setLayout(toRGLLayout(tpl.layout.layout));
      persistLayout(toRGLLayout(tpl.layout.layout), tpl.layout.widgets);
      setShowTemplates(false);
    }
  }, [persistLayout]);

  const exportDashboard = useCallback(async (format: 'png' | 'pdf') => {
    if (!dashboardRef.current || exportingFormat) return;
    setExportingFormat(format);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(dashboardRef.current);
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `dashboard-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } else {
        const { default: jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        const w = pdf.internal.pageSize.getWidth();
        const h = (canvas.height * w) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, w, h);
        pdf.save(`dashboard-${Date.now()}.pdf`);
      }
    } finally { setExportingFormat(null); }
  }, [exportingFormat]);

  // Ensure every widget has a layout entry
  const safeLayout = widgets.map((w, i) => {
    const existing = layout.find(l => l.i === w.id);
    return existing ?? defaultLayoutItem(w.id, i);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-800 rounded-lg border border-gray-700 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => editMode ? handleSave() : setEditMode(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${editMode ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {editMode ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {editMode ? 'Save Layout' : 'Edit Layout'}
          </button>
          {editMode && (
            <>
              <button onClick={() => setShowLibrary(!showLibrary)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm">
                <PanelRight className="h-4 w-4" /><span>Add Widget</span>
              </button>
              <button onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm">
                <span className="text-sm">Templates</span>
              </button>
              <button onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm">
                <RotateCcw className="h-4 w-4" /><span>Reset to Default</span>
              </button>
            </>
          )}
          <button onClick={() => setShowWidgetSystem(!showWidgetSystem)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors text-sm">
            <Package className="h-4 w-4" /><span>Marketplace</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportDashboard('png')} disabled={!!exportingFormat}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm">
            <Download className="h-4 w-4" />{exportingFormat === 'png' ? 'Exporting…' : 'PNG'}
          </button>
          <button onClick={() => exportDashboard('pdf')} disabled={!!exportingFormat}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm">
            <Download className="h-4 w-4" />{exportingFormat === 'pdf' ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Templates panel */}
      {showTemplates && editMode && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Dashboard Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dashboardTemplates.map(tpl => (
              <button key={tpl.id} onClick={() => loadTemplate(tpl.id)}
                className="text-left p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                <p className="text-sm font-medium text-white">{tpl.name}</p>
                <p className="text-xs text-gray-400 mt-1">{tpl.description}</p>
                <p className="text-xs text-purple-400 mt-2">Role: {tpl.role}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide-in Widget Library panel */}
      {showLibrary && editMode && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Widget Library</h3>
            <button onClick={() => setShowLibrary(false)} className="p-1 hover:bg-gray-700 rounded text-gray-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <WidgetLibrary onAddWidget={addWidget} />
          </div>
        </div>
      )}

      {/* react-grid-layout dashboard */}
      <div ref={dashboardRef} className="bg-gray-900 rounded-lg border border-gray-700 p-2 min-h-[400px]">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 mb-4">No widgets yet. Click "Edit Layout" → "Add Widget" to get started.</p>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={safeLayout}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            width={1200}
            isDraggable={editMode}
            isResizable={editMode}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
            margin={[8, 8]}
          >
            {widgets.map(widget => (
              <div key={widget.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
                {editMode && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-700/50 border-b border-gray-700 flex-shrink-0">
                    <span className="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-200 text-xs select-none flex items-center gap-1">
                      ⠿ {widget.title}
                    </span>
                    <button onClick={() => removeWidget(widget.id)} aria-label={`Remove ${widget.title}`}
                      className="p-0.5 hover:bg-gray-600 rounded text-red-400 hover:text-red-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex-1 p-2 min-h-0">
                  <DashboardErrorBoundary widgetTitle={widget.title}>
                    {renderWidgetContent(widget, (data) => setDrillDownData({ widget: widget.title, data }))}
                  </DashboardErrorBoundary>
                </div>
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {/* Widget System Modal */}
      {showWidgetSystem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-6xl h-[90vh] rounded-xl border border-gray-700 bg-gray-900 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-semibold text-white">Widget Marketplace</h2>
              <button onClick={() => setShowWidgetSystem(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6"><WidgetSystem /></div>
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      {drillDownData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{drillDownData.widget} — Details</h3>
              <button onClick={() => setDrillDownData(null)} className="p-1 hover:bg-gray-700 rounded text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="bg-gray-800 p-4 rounded-lg overflow-auto text-gray-300 text-sm">
              {JSON.stringify(drillDownData.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardBuilder;
