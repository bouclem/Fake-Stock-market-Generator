// Type declarations for stock-market-gen.
// Hand-maintained to match src/index.js — keep in sync when the API changes.

// ---------- Data shapes ----------

export interface Bar {
  /** Unix epoch in milliseconds */
  time: number;
  /** ISO 8601 timestamp */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** close × sharesOutstanding — present only when sharesOutstanding is set */
  worth?: number;
}

export interface Stock {
  symbol: string;
  name: string | null;
  sector: string | null;
  kind: 'stock' | 'crypto';
  startPrice: number;
  /** milliseconds between bars (approximate for calendar intervals) */
  interval: number;
  sharesOutstanding: number | null;
  bars: Bar[];
  splits?: SplitEntry[];
  color?: string;
}

export interface NetWorthBar {
  time: number;
  date: string;
  value: number;
  volume: number;
}

export interface NetWorth {
  name: string | null;
  startValue: number;
  interval: number;
  bars: NetWorthBar[];
  splits?: SplitEntry[];
  _type: 'networth';
}

export interface SplitEntry {
  date: string;
  time: number;
  ratio: number;
  type: 'forward' | 'reverse';
  display: string;
}

export interface SplitDef {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Split ratio in "X:Y" format (e.g. "3:1", "1:2") */
  split?: string | number;
  /** Numeric ratio (alternative to split) */
  ratio?: number;
  label?: string;
}

export interface ChartEvent {
  date: Date | number | string;
  label: string;
  color?: string;
}

// ---------- Generation ----------

export interface GenerateStockOptions {
  symbol?: string;
  name?: string;
  sector?: string;
  startPrice?: number;
  drift?: number;
  volatility?: number;
  bars?: number;
  /** ms or "1min"/"1h"/"1d"/"1w"/"1mo"/"1m"/"1y" */
  interval?: number | string;
  startDate?: Date | number | string;
  seed?: number | string;
  kind?: 'stock' | 'crypto';
  prices?: number[];
  ohlc?: Partial<Bar>[];
  /** Accepts numbers and strings like "1_500_000" or "1.5M" */
  sharesOutstanding?: number | string;
}

export interface GenerateMarketOptions extends Omit<GenerateStockOptions, 'symbol'> {
  /** Number of stocks (default: 5) */
  count?: number;
  /** Per-stock overrides */
  stocks?: GenerateStockOptions[];
  seed?: number | string;
  symbol?: string;
}

export interface GenerateNetWorthOptions {
  name?: string;
  startValue?: number;
  drift?: number;
  volatility?: number;
  bars?: number;
  interval?: number | string;
  startDate?: Date | number | string;
  seed?: number | string;
  /** Numbers or strings like "1_500_000" / "1.5M" */
  values?: (number | string)[];
  volumes?: number[];
}

export function generateStock(options?: GenerateStockOptions): Stock;
export function generateMarket(options?: GenerateMarketOptions): Stock[];
export function generateNetWorth(options?: GenerateNetWorthOptions): NetWorth;
export function toJSON(stockOrMarket: Stock | Stock[] | NetWorth, indent?: number): string;
export function fromJSON(input: string | Stock | NetWorth): Stock | NetWorth;
export function fromJSON(input: string | (Stock | NetWorth)[]): (Stock | NetWorth)[];

export function parseSplitRatio(value: string | number | null | undefined): number | null;
export function applySplit(
  data: Stock | NetWorth,
  splitDate: Date | number | string,
  ratio: number | string,
  options?: { fields?: string[] }
): Stock | NetWorth;
export function applySplits<T extends { bars: unknown[] }>(data: T, splits: SplitDef[] | null | undefined): T;

// ---------- Loading ----------

export function loadSplits(source: string | SplitDef | SplitDef[] | { splits: SplitDef[] } | null | undefined): Promise<SplitDef[]>;
export function loadSplitsSync(source: string | SplitDef | SplitDef[] | { splits: SplitDef[] } | null | undefined): SplitDef[];
export function loadEvents(source: ChartEvent[] | ChartEvent | { events: ChartEvent[] } | string | null | undefined): ChartEvent[];
export function loadEventsSync(source: ChartEvent[] | ChartEvent | { events: ChartEvent[] } | string | null | undefined): ChartEvent[];

// ---------- Numeric helpers ----------

export function parseNumeric(value: number | string | null | undefined): number | null | undefined;
export function formatNumeric(value: number): string;
export function formatHumanNumber(value: number, precision?: number): string;
export function cleanNumericArray(arr: (number | string | null | undefined)[] | null | undefined): number[];
export function cleanJson(jsonString: string): string;
export function parseJson(jsonString: string): unknown;

// ---------- RNG ----------

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  gauss(): number;
  pick<T>(arr: T[]): T;
}
export function createRng(seed?: number | string): Rng;

// ---------- Intervals ----------

export function parseInterval(interval: number | string): number;

// ---------- Charts ----------

export interface ChartColors {
  bg?: string;
  grid?: string;
  text?: string;
  axis?: string;
  line?: string;
  area?: string;
  up?: string;
  down?: string;
}

export interface ChartPadding {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  padding?: ChartPadding;
  theme?: 'light' | 'dark';
  title?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  xTicks?: number;
  yTicks?: number;
  /** Array, single event object, { events: [...] } envelope, or ".json" path (Node) */
  events?: ChartEvent[] | ChartEvent | { events: ChartEvent[] } | string;
  /** 'price' (default) or 'worth' — worth requires sharesOutstanding */
  valueMode?: 'price' | 'worth';
  colors?: ChartColors;
}

export type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'candle';

export function renderChart(stock: Stock, type?: ChartType, options?: ChartOptions): string;
export function renderLineChart(stock: Stock, options?: ChartOptions): string;
export function renderAreaChart(stock: Stock, options?: ChartOptions): string;
export function renderBarChart(stock: Stock, options?: ChartOptions): string;
export function renderCandlestickChart(stock: Stock, options?: ChartOptions): string;

export interface MultiLineOptions extends ChartOptions {
  mode?: 'price' | 'normalized';
  legend?: boolean;
  area?: boolean;
}
export function renderMultiLineChart(stocks: Stock[], options?: MultiLineOptions): string;
export function renderNetWorthChart(netWorth: NetWorth, options?: ChartOptions): string;

export interface MixedChartItem {
  data: NetWorth | Stock;
  valueField?: 'value' | 'worth' | 'close' | 'auto';
  label?: string;
  color?: string;
}
export interface MixedChartOptions extends ChartOptions {
  mode?: 'absolute' | 'normalized' | 'percent';
  showLegend?: boolean;
}
export function renderMixedChart(items: MixedChartItem[], options?: MixedChartOptions): string;

export interface VolumeChartOptions extends ChartOptions {
  /** Height of the volume panel as % of total height (default: 25, clamped 10–40) */
  volumeHeight?: number;
}
export function renderChartWithVolume(
  data: Stock | NetWorth,
  type?: 'line' | 'area' | 'bar' | 'candlestick',
  options?: VolumeChartOptions
): string;

// ---------- HTML ----------

export interface HtmlPageOptions {
  title?: string;
  theme?: 'light' | 'dark';
  chartType?: 'line' | 'area' | 'bar' | 'candlestick';
  chartOptions?: ChartOptions;
}
export function renderHtmlPage(marketOrStock: Stock | Stock[], options?: HtmlPageOptions): string;
