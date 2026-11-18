import path from 'path';

export const ROOT = process.cwd();
export const CASES_PATH = path.join(ROOT, 'benchmarks', 'signalforge', 'cases.json');
export const EVAL_SETS_PATH = path.join(ROOT, 'benchmarks', 'signalforge', 'eval-sets.json');
export const REPORTS_DIR = path.join(ROOT, 'tmp', 'signalforge-benchmark-reports');
export const QUEUE_DIR = path.join(ROOT, 'tmp', 'signalforge-eval-queue');
export const QUEUE_PATH = path.join(QUEUE_DIR, 'queue.json');
export const LOG_DIR = path.join(QUEUE_DIR, 'logs');
export const REPAIRS_DIR = path.join(ROOT, 'tmp', 'signalforge-eval-repairs');
export const REPAIRS_PATH = path.join(REPAIRS_DIR, 'repairs.json');
export const SCHEDULE_PATH = path.join(QUEUE_DIR, 'schedule.json');
