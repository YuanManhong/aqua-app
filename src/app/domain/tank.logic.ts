import { AquaticPlant, Count, Livestock, Tank, ValueRange, WaterParam, WaterTest } from './tank.model';

// ---------- 查询(只读) ----------

export function currentCount(item: Livestock | AquaticPlant): number {
    return item.countHistory.at(-1)?.count ?? 0;
}

export function latestWaterTest(tank: Tank): WaterTest | undefined {
    return tank.waterTests?.at(-1);
}

export function isActiveItem(item: Livestock | AquaticPlant): boolean {
    return !item.departureDate;
}

export function activeInhabitants(tank: Tank) {
    return {
        aquaticPlants: tank.aquaticPlants?.filter(isActiveItem) ?? [],
        livestock: tank.livestock?.filter(isActiveItem) ?? [],
    };
}

export function countActivePlants(tank: Tank): number {
    let num = 0;
    for (const item of tank.aquaticPlants ?? []) {
        if (item.departureDate) continue;
        num += currentCount(item);
    }
    return num;
}

// ---------- 展示 / 数值 ----------

export function formatValueRange(v: number | ValueRange | undefined): string {
    if (v === undefined) return '-';
    if (typeof v === 'number') return String(v);
    return `${v.min} - ${v.max}`;
}

/** 区间取中点,单值原样返回;趋势图连线用 */
export function midpoint(v: number | ValueRange): number {
    return typeof v === 'number' ? v : (v.min + v.max) / 2;
}

export interface SeriesPoint {
    date: string;
    value: number;       // 单值或区间中点
    min: number;         // 单值时 min === max === value
    max: number;
}

/** 抽取某个水质参数的时间序列(跳过没测该参数的记录),按日期升序 */
export function seriesOf(tests: WaterTest[], param: WaterParam): SeriesPoint[] {
    const points: SeriesPoint[] = [];
    for (const test of tests) {
        const v = test[param];
        if (v === undefined) continue;
        points.push({
            date: test.date,
            value: midpoint(v),
            min: typeof v === 'number' ? v : v.min,
            max: typeof v === 'number' ? v : v.max,
        });
    }
    return sortByDate(points);
}

// ---------- 排序 ----------

/** ISO 日期字符串的字典序即时间序 */
export function sortByDate<T extends { date: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- 变更(不可变更新:返回新对象,不改入参) ----------

export function addWaterTest(tank: Tank, test: WaterTest): Tank {
    return {
        ...tank,
        waterTests: sortByDate([...(tank.waterTests ?? []), test]),
    };
}

export function addLivestock(tank: Tank, item: Livestock): Tank {
    return { ...tank, livestock: [...(tank.livestock ?? []), item] };
}

export function addPlant(tank: Tank, item: AquaticPlant): Tank {
    return { ...tank, aquaticPlants: [...(tank.aquaticPlants ?? []), item] };
}

export function addCountEntry<T extends Livestock | AquaticPlant>(item: T, count: Count): T {
    return {
        ...item,
        countHistory: sortByDate([...item.countHistory, count]),
    };
}

export function markDeparture<T extends Livestock | AquaticPlant>(item: T, date: string): T {
    return { ...item, departureDate: date };
}

/** 对 tank 里某个 livestock/plant 应用一次不可变更新 */
export function updateLivestock(tank: Tank, id: string, fn: (item: Livestock) => Livestock): Tank {
    return {
        ...tank,
        livestock: tank.livestock?.map(item => (item.id === id ? fn(item) : item)),
    };
}

export function updatePlant(tank: Tank, id: string, fn: (item: AquaticPlant) => AquaticPlant): Tank {
    return {
        ...tank,
        aquaticPlants: tank.aquaticPlants?.map(item => (item.id === id ? fn(item) : item)),
    };
}
