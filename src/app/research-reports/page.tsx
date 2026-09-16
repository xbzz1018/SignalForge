import type { Metadata } from 'next';
import { getResearchAutomationDashboard, type ResearchAutomationDashboard } from '@/lib/quant/research-reports';
import { getRuntimeDegradationConfig } from '@/lib/config/degradation';
import ResearchReportsClient, { type ResearchView } from './ResearchReportsClient';

export const metadata: Metadata = {
  title: '投研情报中心 · SignalForge',
  description: '统一管理观察池、研究证据、结构化报告、主题洞察与推送回执。',
};

type Props = { searchParams?: Promise<{ view?: string }> };

function unavailableDashboard(): ResearchAutomationDashboard {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      watchlists: 0,
      reports: 0,
      activeChannels: 0,
      latestScore: null,
    },
    watchlists: [],
    latestReports: [],
    recentRuns: [],
    notificationChannels: [],
    recentDeliveries: [],
    providerMatrix: [],
  };
}

export default async function ResearchReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  let dashboard: ResearchAutomationDashboard;
  let initialError: string | undefined;
  if (!getRuntimeDegradationConfig().components.database.enabled) {
    dashboard = unavailableDashboard();
    initialError = '研究数据暂时不可用，请启动 TimescaleDB 后点击“刷新”。';
  } else {
    try {
      dashboard = await getResearchAutomationDashboard();
    } catch {
      // Keep the route usable when optional local services are stopped. The
      // client can retry after TimescaleDB is brought back online.
      dashboard = unavailableDashboard();
      initialError = '研究数据暂时不可用，请启动 TimescaleDB 后点击“刷新”。';
    }
  }
  const requestedView = params?.view;
  const view: ResearchView = requestedView === 'reports' || requestedView === 'insights' || requestedView === 'automation' ? requestedView : 'overview';
  return <ResearchReportsClient initialData={dashboard} initialView={view} initialError={initialError} />;
}

export const dynamic = 'force-dynamic';
