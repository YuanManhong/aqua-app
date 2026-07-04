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

/** 撤销「离开」标记(Manage 里的 Return)—— 不可变地删掉 departureDate */
export function clearDeparture<T extends Livestock | AquaticPlant>(item: T): T {
    const { departureDate, ...rest } = item;
    return rest as T;
}

// ---------- 活动日志(纯派生,不落任何新数据) ----------

export interface ActivityEvent {
    date: string; // ISO
    category: 'setup' | 'test' | 'livestock' | 'plant' | 'update' | 'remove';
    title: string;
    detail?: string;
    color?: string; // livestock 用自己的颜色覆盖分类色
}

/** 把水质记录 + 生物/水草事件合成一条倒序时间线(最新在前,最多 limit 条) */
export function activityLog(tank: Tank, limit = 10): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    if (tank.startDate) events.push({ date: tank.startDate, category: 'setup', title: 'Tank started' });

    for (const wt of tank.waterTests ?? []) {
        events.push({ date: wt.date, category: 'test', title: 'Water test logged', detail: wt.note });
    }

    const addItem = (item: Livestock | AquaticPlant, category: 'livestock' | 'plant', color?: string) => {
        const hist = sortByDate(item.countHistory);
        if (hist[0]) {
            events.push({
                date: item.onBoardDate ?? hist[0].date,
                category,
                color,
                title: `Added ${hist[0].count}× ${item.species}`,
            });
        }
        for (let i = 1; i < hist.length; i++) {
            const arrow = hist[i].count >= hist[i - 1].count ? '↑' : '↓';
            events.push({
                date: hist[i].date,
                category: 'update',
                title: `${item.species} ${hist[i - 1].count} → ${hist[i].count}`,
                detail: hist[i].reason ? `${arrow} ${hist[i].reason}` : `${arrow} count updated`,
            });
        }
        if (item.departureDate) {
            events.push({ date: item.departureDate, category: 'remove', title: `${item.species} removed` });
        }
    };
    for (const ls of tank.livestock ?? []) addItem(ls, 'livestock', ls.color);
    for (const pl of tank.aquaticPlants ?? []) addItem(pl, 'plant');

    return [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
