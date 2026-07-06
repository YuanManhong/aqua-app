import { AquaticPlant, Count, Livestock, Photo, PhotoType, Tank, ValueRange, WaterParam, WaterTest } from './tank.model';

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
    return `${v.min}–${v.max}`;
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

/**
 * 按日期倒序(最新在前)。日期只精确到天,同一天分不出先后,
 * 用数组下标倒序兜底:数组是录入顺序(append),靠后 = 后录入 → 排前面。
 */
export function sortByDateDesc<T extends { date: string }>(items: T[]): T[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.index - a.index)
        .map(x => x.item);
}

// ---------- 照片(Gallery v2 的纯派生助手) ----------

/** 旧照片没有 type 字段 → 一律按 'other' 读 */
export function photoType(photo: Photo): PhotoType {
    return photo.type ?? 'other';
}

/** 照片按日期倒序(最新在前);同日后录入的在前 */
export function sortPhotosDesc(photos: Photo[]): Photo[] {
    return sortByDateDesc(photos);
}

/** 进程对比的素材:全缸照(FTS)按日期升序 */
export function ftsPhotosAsc(tank: Tank): Photo[] {
    return sortByDate((tank.photos ?? []).filter(p => photoType(p) === 'fts'));
}

export interface PhotoMonthGroup {
    /** "YYYY-MM" —— 展示层自己格式化成 "June 2026" */
    key: string;
    photos: Photo[];
}

/** 按月分组,最新月份在前、组内也倒序;入参顺序不限 */
export function photosByMonth(photos: Photo[]): PhotoMonthGroup[] {
    const groups: PhotoMonthGroup[] = [];
    for (const photo of sortPhotosDesc(photos)) {
        const key = photo.date.slice(0, 7);
        const last = groups.at(-1);
        if (last?.key === key) last.photos.push(photo);
        else groups.push({ key, photos: [photo] });
    }
    return groups;
}

// ---------- 日期连接(lightbox 的 "water that day" / "Day N") ----------

/** 照片日期当天或之前最近的一次水质测试(还没测过则 undefined) */
export function nearestTestAtOrBefore(tests: WaterTest[], date: string): WaterTest | undefined {
    return sortByDate(tests).filter(t => t.date <= date).at(-1);
}

/** 两个 ISO 日期相差的天数(b - a) */
export function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// ---------- 变更(不可变更新:返回新对象,不改入参) ----------

export function addWaterTest(tank: Tank, test: WaterTest): Tank {
    return {
        ...tank,
        waterTests: sortByDate([...(tank.waterTests ?? []), test]),
    };
}

/** 整条替换同 id 的水质记录(日期可能改了 → 重排);id 不存在则原样返回 */
export function updateWaterTest(tank: Tank, test: WaterTest): Tank {
    return {
        ...tank,
        waterTests: sortByDate((tank.waterTests ?? []).map(t => (t.id === test.id ? test : t))),
    };
}

export function removeWaterTest(tank: Tank, id: string): Tank {
    return { ...tank, waterTests: (tank.waterTests ?? []).filter(t => t.id !== id) };
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

export function addPhoto(tank: Tank, photo: Photo): Tank {
    return { ...tank, photos: [...(tank.photos ?? []), photo] };
}

export function removePhoto(tank: Tank, id: string): Tank {
    return { ...tank, photos: (tank.photos ?? []).filter(p => p.id !== id) };
}

/** 撤销「离开」标记(Manage 里的 Return)—— 不可变地删掉 departureDate */
export function clearDeparture<T extends Livestock | AquaticPlant>(item: T): T {
    const { departureDate, ...rest } = item;
    return rest as T;
}

// ---------- 云同步合并 ----------

/** 同 id 集合求并集:两边都有的条目以本地为准(本设备最近的操作),各自独有的都保留 */
function unionById<T extends { id: string }>(remote: T[] | undefined, local: T[] | undefined): T[] {
    const localById = new Map((local ?? []).map(item => [item.id, item]));
    const remoteIds = new Set((remote ?? []).map(item => item.id));
    return [
        ...(remote ?? []).map(item => localById.get(item.id) ?? item),
        ...(local ?? []).filter(item => !remoteIds.has(item.id)),
    ];
}

/**
 * 同一个缸两边都有时逐项合并:四个内容集合按条目 id 求并集
 * (登录前在本地新录的记录、别的设备新增的记录,两边都保住),
 * 标量字段(名字、水体等)本地优先——用户正看着这台设备,改名回跳最像 bug。
 * 已知取舍:同一条目两边都改过时本地覆盖云端,符合全局 last-write-wins 策略。
 */
function mergeTankContents(remote: Tank, local: Tank): Tank {
    return {
        ...remote,
        ...local,
        waterTests: sortByDate(unionById(remote.waterTests, local.waterTests)),
        livestock: unionById(remote.livestock, local.livestock),
        aquaticPlants: unionById(remote.aquaticPlants, local.aquaticPlants),
        photos: unionById(remote.photos, local.photos),
    };
}

/**
 * 登录水合时合并云端与本地,而不是让云端整份覆盖本地。
 * 典型场景:云上已有数据,用户登录前又在本地录了新内容(新缸,或往已有缸里
 * 加了水质记录)——水质历史无法重测,本地数据必须保留。
 *
 * 规则:
 * - 同 id 的缸逐项合并(见 mergeTankContents);
 * - 本地独有的缸(id 不在云端)追加在后;
 * - 本地的示例缸不并入:演示数据不该进真实账号。
 */
export function mergeCloudTanks(local: Tank[], remote: Tank[]): Tank[] {
    const localById = new Map(local.map(t => [t.id, t]));
    const remoteIds = new Set(remote.map(t => t.id));
    return [
        ...remote.map(r => {
            const l = localById.get(r.id);
            return l ? mergeTankContents(r, l) : r;
        }),
        ...local.filter(t => !remoteIds.has(t.id) && !t.isSample),
    ];
}

// ---------- 活动日志(纯派生,不落任何新数据) ----------

export interface ActivityEvent {
    /** 稳定标识:由来源数据确定性派生(如 "test:wt-5"、"add:ls-1"),照片的 linkedTo 指向它 */
    key: string;
    date: string; // ISO
    category: 'setup' | 'test' | 'livestock' | 'plant' | 'update' | 'remove' | 'photo';
    title: string;
    detail?: string;
    color?: string; // livestock 用自己的颜色覆盖分类色
    photos?: Photo[]; // 挂在这条事件上的照片(时间线里显示缩略图)
}

/** 把水质记录 + 生物/水草事件 + 照片合成一条倒序时间线(最新在前,最多 limit 条) */
export function activityLog(tank: Tank, limit = 10): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    if (tank.startDate) events.push({ key: 'setup', date: tank.startDate, category: 'setup', title: 'Tank started' });

    for (const wt of tank.waterTests ?? []) {
        events.push({ key: `test:${wt.id}`, date: wt.date, category: 'test', title: 'Water test logged', detail: wt.note });
    }

    const addItem = (item: Livestock | AquaticPlant, category: 'livestock' | 'plant', color?: string) => {
        const hist = sortByDate(item.countHistory);
        if (hist[0]) {
            events.push({
                key: `add:${item.id}`,
                date: item.onBoardDate ?? hist[0].date,
                category,
                color,
                title: `Added ${hist[0].count}× ${item.species}`,
            });
        }
        for (let i = 1; i < hist.length; i++) {
            const arrow = hist[i].count >= hist[i - 1].count ? '↑' : '↓';
            events.push({
                key: `count:${item.id}:${hist[i].date}`,
                date: hist[i].date,
                category: 'update',
                title: `${item.species} ${hist[i - 1].count} → ${hist[i].count}`,
                detail: hist[i].reason ? `${arrow} ${hist[i].reason}` : `${arrow} count updated`,
            });
        }
        if (item.departureDate) {
            events.push({ key: `remove:${item.id}`, date: item.departureDate, category: 'remove', title: `${item.species} removed` });
        }
    };
    for (const ls of tank.livestock ?? []) addItem(ls, 'livestock', ls.color);
    for (const pl of tank.aquaticPlants ?? []) addItem(pl, 'plant');

    // 照片:有关联且事件还在 → 挂缩略图到那条事件;没关联或关联失效 → 自己成一条 "Photo added"
    const byKey = new Map(events.map(e => [e.key, e]));
    for (const photo of tank.photos ?? []) {
        const target = photo.linkedTo ? byKey.get(photo.linkedTo) : undefined;
        if (target) {
            (target.photos ??= []).push(photo);
        } else {
            events.push({
                key: `photo:${photo.id}`,
                date: photo.date,
                category: 'photo',
                title: 'Photo added',
                detail: photo.caption,
                photos: [photo],
            });
        }
    }

    return sortByDateDesc(events).slice(0, limit);
}
