import { WaterParam } from './tank.model';

// 水质参数的展示顺序和标签,form / card / trend / triage 共用。
// 放在 domain:triage 的 why-line 需要这些标签,而 domain 不能反向依赖 features。
export const WATER_PARAMS: { key: WaterParam; label: string }[] = [
    { key: 'pH', label: 'pH' },
    { key: 'ammoniaAmmonium', label: 'Ammonia' },
    { key: 'nitrite', label: 'Nitrite' },
    { key: 'nitrate', label: 'Nitrate' },
    { key: 'GH', label: 'GH' },
    { key: 'KH', label: 'KH' },
];

/** 化学式短标签(overview 卡片的 mini-tile 用):pH / NH₃ / NO₂ / NO₃ / GH / KH */
export const SHORT_PARAM_LABELS: Record<WaterParam, string> = {
    pH: 'pH',
    ammoniaAmmonium: 'NH₃',
    nitrite: 'NO₂',
    nitrate: 'NO₃',
    GH: 'GH',
    KH: 'KH',
};
