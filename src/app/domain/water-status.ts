// 水质状态 / 阈值:纯 TS,不依赖 Angular(和其余 domain 一样)。
// 这里的阈值是占位值(低维护有草虾缸的社区常用范围)—— 先把机制接上,
// 真正可编辑的阈值以后再做。
import { ValueRange, WaterParam } from './tank.model';
import { midpoint } from './tank.logic';

export type WaterStatus = 'safe' | 'watch' | 'danger' | 'none';

// safe 区间内 = 安全;落在 watch 区间内 = 临界;两者都不在 = 危险。
export const THRESHOLDS: Record<WaterParam, { safe: [number, number]; watch: [number, number] }> = {
    pH: { safe: [6.4, 7.6], watch: [6.0, 8.0] },
    ammoniaAmmonium: { safe: [0, 0.02], watch: [0, 0.25] },
    nitrite: { safe: [0, 0.02], watch: [0, 0.25] },
    nitrate: { safe: [0, 20], watch: [0, 40] },
    GH: { safe: [4, 8], watch: [3, 12] },
    KH: { safe: [3, 6], watch: [2, 8] },
};

// 各参数的「正常值」:表单预填用(首次测试、或上次没测该参数时的默认值)。
// 氨/亚硝酸盐取 0(健康缸的期望值),其余取 safe 区间的常见落点。
export const TYPICAL_VALUES: Record<WaterParam, number> = {
    pH: 7,
    ammoniaAmmonium: 0,
    nitrite: 0,
    nitrate: 10,
    GH: 6,
    KH: 4,
};

export const UNITS: Record<WaterParam, string> = {
    pH: '',
    ammoniaAmmonium: 'ppm',
    nitrite: 'ppm',
    nitrate: 'ppm',
    GH: 'dGH',
    KH: 'dKH',
};

export function statusOf(param: WaterParam, value: number | ValueRange | undefined): WaterStatus {
    if (value === undefined) return 'none';
    const m = midpoint(value);
    const t = THRESHOLDS[param];
    if (m >= t.safe[0] && m <= t.safe[1]) return 'safe';
    if (m >= t.watch[0] && m <= t.watch[1]) return 'watch';
    return 'danger';
}
