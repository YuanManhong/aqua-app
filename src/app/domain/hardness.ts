// GH/KH 硬度单位换算:纯 TS,不依赖 Angular(和其余 domain 一样)。
// 存储只有一种单位(dGH/dKH);ppm CaCO₃ 是展示层换算——切单位不改任何已存数据。
import { ValueRange, WaterParam } from './tank.model';
import { formatValueRange } from './tank.logic';
import { UNITS } from './water-status';

export type HardnessUnit = 'degrees' | 'ppm';

/** 1 dGH = 17.85 ppm CaCO₃(1 德国度 ≙ 10 mg/L CaO 折算) */
export const PPM_PER_DEGREE = 17.85;

export function isHardnessParam(param: WaterParam): boolean {
    return param === 'GH' || param === 'KH';
}

/** 度 → ppm,取整:试剂盒精度远低于 1 ppm,小数只添噪音 */
export function degreesToPpm(deg: number): number {
    return Math.round(deg * PPM_PER_DEGREE);
}

/** ppm → 度,保留两位小数:再换回 ppm 能落回原值(107 → 5.99 → 107) */
export function ppmToDegrees(ppm: number): number {
    return Math.round((ppm / PPM_PER_DEGREE) * 100) / 100;
}

/** 存储值(度)→ 当前单位下的展示值;非硬度参数或 degrees 模式原样返回 */
export function toDisplayValue(param: WaterParam, v: number | ValueRange, unit: HardnessUnit): number | ValueRange {
    if (unit === 'degrees' || !isHardnessParam(param)) return v;
    return typeof v === 'number' ? degreesToPpm(v) : { min: degreesToPpm(v.min), max: degreesToPpm(v.max) };
}

/** toDisplayValue 的单值版:表单预填这类只有 number 的场景用,免去类型收窄 */
export function toDisplayNumber(param: WaterParam, v: number, unit: HardnessUnit): number {
    return toDisplayValue(param, v, unit) as number;
}

/** 展示单位下的输入值 → 存储值(度);非硬度参数原样返回 */
export function fromDisplayValue(param: WaterParam, v: number, unit: HardnessUnit): number {
    if (unit === 'degrees' || !isHardnessParam(param)) return v;
    return ppmToDegrees(v);
}

/** formatValueRange 的单位感知版:先换算再格式化;undefined 原样交给 formatValueRange */
export function formatParamValue(param: WaterParam, v: number | ValueRange | undefined, unit: HardnessUnit): string {
    return v === undefined ? formatValueRange(v) : formatValueRange(toDisplayValue(param, v, unit));
}

/** 参数的单位标签:GH/KH 随硬度单位切换(dGH/dKH 或 ppm),其余固定 */
export function unitOf(param: WaterParam, unit: HardnessUnit): string {
    return isHardnessParam(param) && unit === 'ppm' ? 'ppm' : UNITS[param];
}
