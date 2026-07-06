// 领域模型:纯 TS 接口,不依赖 Angular。
// 所有日期一律存 ISO 字符串(如 "2026-06-24"),避免 JSON 序列化后 Date 断裂;
// ISO 格式的字典序即时间序,排序可直接比较字符串。

/** 水体类型:建缸时必选;决定 Setup style / Tech level 的可选范围。 */
export type WaterType = 'freshwater' | 'saltwater' | 'brackish';

/** 缸的风格定位:描述性标签(缸会演变,可随时改),不是身份标识。 */
export type SetupStyle =
    | 'planted'
    | 'reef'
    | 'fowlr'
    | 'biotope'
    | 'aquascape'
    | 'species-only'
    | 'bare-bottom'
    | 'community';

/** 技术路线:CO2/强光/液肥 与否,只对淡水缸有意义。 */
export type TechLevel = 'low-tech' | 'high-tech';

export interface Tank {
    id: string;
    name: string;
    startDate: string;
    /** 示例缸标记:dashboard 据此显示 sample 横幅,"Clear sample" 按它删除。 */
    isSample?: boolean;
    volume?: string;
    waterType?: WaterType; // 新建缸必填;旧数据可能缺失,渲染时跳过即可
    setupStyle?: SetupStyle;
    techLevel?: TechLevel;
    waterTests?: WaterTest[];
    livestock?: Livestock[];
    aquaticPlants?: AquaticPlant[];
    photos?: Photo[];
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
}

export interface AquaticPlant {
    id: string;
    species: string;
    countHistory: Count[];
    onBoardDate: string;
    departureDate?: string;
    note?: string;
}

/** 照片类型:FTS = full-tank shot(进程对比的素材);problem = 诊断照。 */
export type PhotoType = 'fts' | 'livestock' | 'problem' | 'other';

/**
 * 照片:独立实体,不嵌在任何东西下面。字段就三个:日期(默认今天)、caption、可选关联。
 * 关联存 ActivityEvent.key(如 "test:wt-5"):事件照/诊断照挂到时间线对应条目上,
 * 该条目旁显示缩略图;不关联的进程照自己成一条 "Photo added" 活动。
 * 关联失效(源记录没了)时照片自动退回为独立活动,不会丢。
 */
export interface Photo {
    id: string;
    src: string; // data URL,入库前已压缩(localStorage / 云端 JSON 都存得起)
    date: string;
    caption?: string;
    linkedTo?: string;
    type?: PhotoType; // 旧数据没有此字段 → 按 'other' 处理,无需迁移
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
