import type { QuantCapabilityId } from '@/lib/quant/capabilities';

export interface QuantVisualizationTemplate {
  id: string;
  name: string;
  scenario: string;
  painPoints: string[];
  requiredComponents: string[];
  optionalComponents: string[];
  dataSignals: string[];
  finalDataContract: string[];
}

const DEFAULT_TEMPLATE_ID: QuantCapabilityId = 'stock_diagnosis';

const TEMPLATE_BY_CAPABILITY: Record<QuantCapabilityId, QuantVisualizationTemplate> = {
  stock_diagnosis: {
    id: 'single-stock-diagnosis',
    name: '个股诊断模板',
    scenario: '单只股票的行情、K 线、财务和事件综合诊断。',
    painPoints: [
      '不能把个股诊断做成大标题说明页，首屏必须露出行情和 K 线。',
      '不能只给涨跌结论，需要同时展示量价、均线、财务、公告和数据质量。',
      '投资判断必须区分事实、计算结果和推断，不输出确定性收益承诺。',
    ],
    requiredComponents: [
      '紧凑报告摘要栏',
      '实时行情指标卡',
      'K 线与成交量主图',
      '均线/波动/回撤信号摘要',
      '财务趋势或财务缺失说明',
      '公告事件时间线',
      '数据信源渠道与质量限制',
    ],
    optionalComponents: ['估值情景', '趋势模板', '最近 K 线明细表'],
    dataSignals: ['quote', 'kline.bars', 'technicalIndicators', 'financials.reports', 'announcements'],
    finalDataContract: ['symbol', 'name', 'quote', 'kline', 'technicalIndicators', 'financials', 'announcements'],
  },
  technical_analysis: {
    id: 'technical-timing',
    name: '技术择时模板',
    scenario: '围绕价格趋势、均线、成交量、波动和交易触发条件的技术分析。',
    painPoints: [
      '不能只写看多/看空，必须给出触发、失效和观察条件。',
      'K 线、成交量和均线是主内容，不能被指标卡替代。',
      '样本不足或历史接口失败时，要展示真实错误和降级视图。',
    ],
    requiredComponents: [
      '趋势结论摘要栏',
      'OHLC/K 线主图',
      '成交量副图',
      'MA5/MA10/MA20/MA60 结构',
      '回撤/波动/量能指标',
      '触发条件与失效条件',
      '最近 K 线明细表',
    ],
    optionalComponents: ['趋势模板', '支撑压力区间', '异常波动提示'],
    dataSignals: ['quote', 'kline.bars', 'technicalIndicators.summary', 'computedMetrics', 'trendTemplate'],
    finalDataContract: ['quote', 'kline.bars', 'technicalIndicators', 'computedMetrics', 'trendTemplate'],
  },
  fundamental_analysis: {
    id: 'fundamental-research',
    name: '基本面研究模板',
    scenario: '围绕财务质量、盈利能力、现金流、成长和公告事件的基本面分析。',
    painPoints: [
      '不能只展示财务表格，需要解释盈利质量、现金流和利润率变化。',
      '报告期口径必须清楚，缺失字段不能被静默忽略。',
      '估值只作为情景分析，不包装成目标价承诺。',
    ],
    requiredComponents: [
      '基本面摘要栏',
      '营收与利润趋势',
      'ROE/毛利率/净利率趋势',
      '现金流或现金流缺失说明',
      '报告期数据表',
      '公告事件摘要',
      '数据质量与缺失字段',
    ],
    optionalComponents: ['估值情景', '盈利质量评分', '同比/环比拆解'],
    dataSignals: ['financials.reports', 'fundamentalIndicators.summary', 'announcements', 'valuation'],
    finalDataContract: ['financials.reports', 'fundamentalIndicators', 'announcements', 'valuation'],
  },
  asset_comparison: {
    id: 'stock-selection',
    name: '选股分析模板',
    scenario: '横向比较多只股票、指数或 ETF 的收益、波动、回撤、估值和质量。',
    painPoints: [
      '不能只展示主标的，必须覆盖用户输入的全部候选标的。',
      '不能基于单一指标给推荐，需要展示排名依据、剔除原因和数据限制。',
      '不同标的必须使用同一时间窗口和同一指标口径。',
    ],
    requiredComponents: [
      '候选标的覆盖摘要',
      '多标的指标矩阵',
      '收益对比图',
      '波动/回撤对比图',
      '相对强弱与排名依据',
      '流动性与可交易性',
      '数据信源渠道逐项追踪',
    ],
    optionalComponents: ['估值情景对比', '趋势模板对比', '相关性结构', '候选清单/观察清单'],
    dataSignals: ['assets[]', 'comparison.rows[]', 'correlation', 'liquidity', 'valuation', 'trendTemplate'],
    finalDataContract: ['requestedSymbols', 'assets', 'comparison', 'correlation', 'liquidity'],
  },
  sector_rotation: {
    id: 'sector-rotation',
    name: '板块轮动模板',
    scenario: '指数、ETF、行业或概念之间的相对强弱、阶段回撤和轮动观察。',
    painPoints: [
      '不能把板块分析当作单个股票诊断，必须强调相对表现。',
      '指数和 ETF 不应强制展示个股财务报表。',
      '需要说明板块代理标的、样本窗口和轮动限制。',
    ],
    requiredComponents: [
      '板块/指数代理说明',
      '相对强弱矩阵',
      '收益与回撤对比图',
      '成交额/流动性对比',
      '阶段排名变化',
      '数据信源渠道与能力边界',
    ],
    optionalComponents: ['相关性结构', '趋势模板', '成分股贡献缺失说明'],
    dataSignals: ['assets[]', 'comparison.rows[]', 'correlation', 'liquidity', 'trendTemplate'],
    finalDataContract: ['requestedSymbols', 'assets', 'comparison', 'correlation', 'liquidity'],
  },
  strategy_research: {
    id: 'strategy-research',
    name: '策略研究模板',
    scenario: '把策略想法拆成信号、样本、参数、风控和待验证假设。',
    painPoints: [
      '不能把未经回测的想法写成已验证策略。',
      '必须明确入场、出场、过滤、仓位和失效条件。',
      '如果只完成历史数据准备，需要把未完成的验证项暴露出来。',
    ],
    requiredComponents: [
      '策略假设摘要',
      '信号规则卡片',
      '样本与参数说明',
      'K 线/信号叠加图',
      '待验证清单',
      '数据限制说明',
    ],
    optionalComponents: ['回测净值曲线', '参数敏感性', '交易明细'],
    dataSignals: ['kline.bars', 'technicalIndicators', 'backtest', 'trades'],
    finalDataContract: ['kline.bars', 'technicalIndicators', 'backtest'],
  },
  backtest_review: {
    id: 'backtest-review',
    name: '策略回测模板',
    scenario: '对可复现策略回测结果进行收益、回撤、胜率、交易和限制复盘。',
    painPoints: [
      '不能只展示最终收益，必须展示回撤、交易次数、胜率和样本限制。',
      '必须说明费用、滑点、停牌和分红再投资等未建模因素。',
      '必须展示参数，确保回测可以复现。',
    ],
    requiredComponents: [
      '策略参数卡片',
      '净值曲线',
      '回撤曲线或回撤指标',
      '收益/胜率/交易次数指标',
      '交易明细表',
      '样本与限制说明',
    ],
    optionalComponents: ['基准对比', '参数敏感性', '年度收益拆解'],
    dataSignals: ['backtest.summary', 'backtest.equity_curve', 'backtest.trades', 'kline.bars'],
    finalDataContract: ['backtest', 'trades', 'equityCurve', 'kline.bars'],
  },
  portfolio_risk: {
    id: 'holding-analysis',
    name: '持仓分析模板',
    scenario: '基于用户持仓、成本、可用现金和市场数据，分析仓位、风险和调仓优先级。',
    painPoints: [
      '不能把持仓当作普通股票列表，必须展示仓位、成本、盈亏、现金和集中度。',
      '调仓建议必须先处理风险约束和数据缺口，不直接输出交易指令。',
      '如果用户只上传截图，必须标注哪些字段来自截图识别、哪些字段来自行情接口。',
    ],
    requiredComponents: [
      '账户/组合摘要栏',
      '持仓矩阵',
      '仓位与集中度条形图',
      '盈亏与成本偏离表',
      '相关性/流动性/波动风险',
      '调仓优先级建议',
      '数据缺口与风险声明',
    ],
    optionalComponents: ['现金使用情景', '个股趋势模板', '估值情景', '风险贡献热力图'],
    dataSignals: ['holdings[]', 'cash', 'assets[]', 'comparison', 'correlation', 'liquidity', 'trendTemplate', 'valuation'],
    finalDataContract: ['portfolio', 'holdings', 'assets', 'comparison', 'correlation', 'liquidity'],
  },
};

export function getQuantVisualizationTemplate(id?: string | null): QuantVisualizationTemplate {
  const capabilityId = (id ?? DEFAULT_TEMPLATE_ID) as QuantCapabilityId;
  return TEMPLATE_BY_CAPABILITY[capabilityId] ?? TEMPLATE_BY_CAPABILITY[DEFAULT_TEMPLATE_ID];
}

export function serializeQuantVisualizationTemplate(id?: string | null) {
  const template = getQuantVisualizationTemplate(id);
  return {
    templateId: template.id,
    name: template.name,
    scenario: template.scenario,
    painPoints: template.painPoints,
    requiredComponents: template.requiredComponents,
    optionalComponents: template.optionalComponents,
    dataSignals: template.dataSignals,
    finalDataContract: template.finalDataContract,
  };
}
