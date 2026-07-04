// 领域模型:纯 TS 接口,不依赖 Angular。
// 所有日期一律存 ISO 字符串(如 "2026-06-24"),避免 JSON 序列化后 Date 断裂;
// ISO 格式的字典序即时间序,排序可直接比较字符串。

export interface Tank {
    id: string;
    name: string;
    startDate: string;
    volume?: string;
    waterTests?: WaterTest[];
    livestock?: Livestock[];
    aquaticPlants?: AquaticPlant[];
    images?: Image[];
}

export interface WaterTest {
    id: string;
    date: string;
    pH?: number | ValueRange;
    ammoniaAmmonium?: number | ValueRange;
    nitrite?: number | ValueRange;
    nitrate?: number | ValueRange;
    GH?: number | ValueRange;
    KH?: number | ValueRange;
    note?: string;
}

/** WaterTest 里可测量的参数字段名(排除 id/date/note) */
export type WaterParam = 'pH' | 'ammoniaAmmonium' | 'nitrite' | 'nitrate' | 'GH' | 'KH';

export interface ValueRange {
    min: number;
    max: number;
}

export interface Livestock {
    id: string;
    species: string;
    color: string;
    kind: 'individual' | 'group';
    countHistory: Count[];
    onBoardDate: string;
    departureDate?: string;
    note?: string;
    image?: Image;
}

export interface AquaticPlant {
    id: string;
    species: string;
    countHistory: Count[];
    onBoardDate: string;
    departureDate?: string;
    note?: string;
    image?: Image;
}

export interface Image {
    src: string;
    date: string;
    title?: string;
    description?: string;
}

export interface Count {
    date: string;
    count: number;
    reason?: string;
}

export function newId(): string {
    return crypto.randomUUID();
}

/** 今天的 ISO 日期(本地时区),如 "2026-06-24" */
export function todayISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
