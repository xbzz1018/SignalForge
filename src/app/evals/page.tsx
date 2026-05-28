import { getQuantEvalDashboardData } from '@/lib/quant/evals';
import EvalsDashboardClient from './EvalsDashboardClient';

export default async function EvalsPage() {
  const data = await getQuantEvalDashboardData();
  return <EvalsDashboardClient data={data} />;
}

export const dynamic = 'force-dynamic';
