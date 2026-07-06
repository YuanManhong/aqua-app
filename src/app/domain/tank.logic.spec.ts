import { describe, expect, it } from 'vitest';
import {
    activityLog,
    addCountEntry,
    addPhoto,
    addWaterTest,
    currentCount,
    daysBetween,
    formatValueRange,
    ftsPhotosAsc,
    latestWaterTest,
    markDeparture,
    mergeCloudTanks,
    midpoint,
    nearestTestAtOrBefore,
    photosByMonth,
    photoType,
    removePhoto,
    removeWaterTest,
    seriesOf,
    sortByDate,
    sortByDateDesc,
    sortPhotosDesc,
    updatePlant,
    updateWaterTest,
} from './tank.logic';
import { AquaticPlant, Photo, Tank, WaterTest } from './tank.model';

const makeTank = (overrides: Partial<Tank> = {}): Tank => ({
    id: 't1',
    name: 'Test Tank',
    startDate: '2026-01-01',
    ...overrides,
});

const makeTest = (overrides: Partial<WaterTest> = {}): WaterTest => ({
    id: 'wt1',
    date: '2026-01-02',
    ...overrides,
});

const makePlant = (overrides: Partial<AquaticPlant> = {}): AquaticPlant => ({
    id: 'p1',
    species: 'Java Moss',
    countHistory: [{ date: '2026-01-01', count: 1 }],
    onBoardDate: '2026-01-01',
    ...overrides,
});

describe('formatValueRange', () => {
    it('formats undefined as dash', () => expect(formatValueRange(undefined)).toBe('-'));
    it('formats a number as-is', () => expect(formatValueRange(7)).toBe('7'));
    it('formats a range as min–max', () => expect(formatValueRange({ min: 6.5, max: 7.5 })).toBe('6.5–7.5'));
});

describe('midpoint', () => {
    it('returns the number itself', () => expect(midpoint(7)).toBe(7));
    it('returns the middle of a range', () => expect(midpoint({ min: 6, max: 8 })).toBe(7));
});

describe('sortByDate', () => {
    it('sorts ISO dates ascending without mutating the input', () => {
        const items = [{ date: '2026-03-01' }, { date: '2026-01-15' }, { date: '2026-02-01' }];
        const sorted = sortByDate(items);
        expect(sorted.map(i => i.date)).toEqual(['2026-01-15', '2026-02-01', '2026-03-01']);
        expect(items[0].date).toBe('2026-03-01'); // 原数组不变
    });
});

describe('sortByDateDesc', () => {
    it('sorts newest date first without mutating the input', () => {
        const items = [{ date: '2026-01-15' }, { date: '2026-03-01' }, { date: '2026-02-01' }];
        const sorted = sortByDateDesc(items);
        expect(sorted.map(i => i.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-15']);
        expect(items[0].date).toBe('2026-01-15'); // 原数组不变
    });

    it('lists same-day items latest-entered first (array order = entry order)', () => {
        const items = [
            { id: 'first', date: '2026-07-05' },
            { id: 'second', date: '2026-07-05' },
            { id: 'third', date: '2026-07-05' },
        ];
        expect(sortByDateDesc(items).map(i => i.id)).toEqual(['third', 'second', 'first']);
    });
});

describe('mergeCloudTanks', () => {
    it('keeps local-only tanks instead of letting the cloud copy clobber them', () => {
        const local = [makeTank({ id: 'local-1', name: 'Anonymous weeks of data' })];
        const remote = [makeTank({ id: 'cloud-1', name: 'Old cloud tank' })];

        const merged = mergeCloudTanks(local, remote);
        expect(merged.map(t => t.id)).toEqual(['cloud-1', 'local-1']);
    });

    it('keeps records entered locally before sign-in when the same tank exists in the cloud', () => {
        const local = [makeTank({ id: 't1', waterTests: [
            makeTest({ id: 'wt-shared', date: '2026-06-01' }),
            makeTest({ id: 'wt-local-new', date: '2026-07-04' }), // 登录前在本地新录的
        ] })];
        const remote = [makeTank({ id: 't1', waterTests: [
            makeTest({ id: 'wt-shared', date: '2026-06-01' }),
            makeTest({ id: 'wt-cloud-new', date: '2026-06-20' }), // 别的设备录的
        ] })];

        const merged = mergeCloudTanks(local, remote);
        expect(merged).toHaveLength(1);
        // 两边独有的记录都保住,并按日期升序
        expect(merged[0].waterTests?.map(t => t.id)).toEqual(['wt-shared', 'wt-cloud-new', 'wt-local-new']);
    });

    it('prefers the local copy of an item both sides have (freshest edits live on this device)', () => {
        const local = [makeTank({ id: 't1', livestock: [{
            id: 'ls1', species: 'Cherry Shrimp', color: '#c0392b', kind: 'group' as const, onBoardDate: '2026-05-01',
            countHistory: [{ date: '2026-05-01', count: 10 }, { date: '2026-07-04', count: 15 }],
        }] })];
        const remote = [makeTank({ id: 't1', livestock: [{
            id: 'ls1', species: 'Cherry Shrimp', color: '#c0392b', kind: 'group' as const, onBoardDate: '2026-05-01',
            countHistory: [{ date: '2026-05-01', count: 10 }],
        }] })];

        const merged = mergeCloudTanks(local, remote);
        expect(merged[0].livestock?.[0].countHistory).toHaveLength(2); // 本地新加的数量记录没丢
    });

    it('prefers local scalar fields for a shared tank', () => {
        const local = [makeTank({ id: 't1', name: 'Renamed here before sign-in' })];
        const remote = [makeTank({ id: 't1', name: 'Old cloud name' })];

        expect(mergeCloudTanks(local, remote)[0].name).toBe('Renamed here before sign-in');
    });

    it('drops local sample tanks so demo data never enters a real account', () => {
        const local = [
            makeTank({ id: 'sample', isSample: true }),
            makeTank({ id: 'real-local' }),
        ];
        const remote = [makeTank({ id: 'cloud-1' })];

        const merged = mergeCloudTanks(local, remote);
        expect(merged.map(t => t.id)).toEqual(['cloud-1', 'real-local']);
    });

    it('returns just the cloud tanks when local is empty', () => {
        const remote = [makeTank({ id: 'cloud-1' })];
        expect(mergeCloudTanks([], remote)).toEqual(remote);
    });
});

describe('addWaterTest', () => {
    it('returns a new tank with the test inserted in date order', () => {
        const tank = makeTank({ waterTests: [makeTest({ id: 'a', date: '2026-01-05' })] });
        const result = addWaterTest(tank, makeTest({ id: 'b', date: '2026-01-03' }));

        expect(result).not.toBe(tank);
        expect(result.waterTests?.map(t => t.id)).toEqual(['b', 'a']);
        expect(tank.waterTests?.length).toBe(1); // 入参不被修改
    });

    it('creates the waterTests array when missing', () => {
        const result = addWaterTest(makeTank(), makeTest());
        expect(result.waterTests?.length).toBe(1);
    });
});

describe('updateWaterTest', () => {
    it('replaces the test with the same id and re-sorts by date', () => {
        const tank = makeTank({
            waterTests: [makeTest({ id: 'a', date: '2026-01-01' }), makeTest({ id: 'b', date: '2026-01-05', pH: 7 })],
        });
        const result = updateWaterTest(tank, makeTest({ id: 'b', date: '2025-12-20', pH: 6.5 }));

        expect(result).not.toBe(tank);
        expect(result.waterTests?.map(t => t.id)).toEqual(['b', 'a']); // 日期改早了 → 排到前面
        expect(result.waterTests?.[0].pH).toBe(6.5);
        expect(tank.waterTests?.[1].pH).toBe(7); // 入参不被修改
    });

    it('replaces the whole record — fields absent from the update are dropped', () => {
        const tank = makeTank({ waterTests: [makeTest({ id: 'a', pH: 7, note: 'old' })] });
        const result = updateWaterTest(tank, makeTest({ id: 'a', nitrate: 10 }));
        expect(result.waterTests?.[0]).toEqual(makeTest({ id: 'a', nitrate: 10 }));
    });

    it('leaves the tank unchanged when the id does not exist', () => {
        const tank = makeTank({ waterTests: [makeTest({ id: 'a' })] });
        const result = updateWaterTest(tank, makeTest({ id: 'ghost' }));
        expect(result.waterTests).toEqual(tank.waterTests);
    });
});

describe('removeWaterTest', () => {
    it('removes the test with the given id without mutating the input', () => {
        const tank = makeTank({ waterTests: [makeTest({ id: 'a' }), makeTest({ id: 'b' })] });
        const result = removeWaterTest(tank, 'a');
        expect(result.waterTests?.map(t => t.id)).toEqual(['b']);
        expect(tank.waterTests?.length).toBe(2);
    });

    it('is a no-op for an unknown id and tolerates a missing array', () => {
        expect(removeWaterTest(makeTank({ waterTests: [makeTest()] }), 'ghost').waterTests?.length).toBe(1);
        expect(removeWaterTest(makeTank(), 'ghost').waterTests).toEqual([]);
    });
});

describe('latestWaterTest', () => {
    it('returns the last (newest) test', () => {
        const tank = makeTank({
            waterTests: [makeTest({ id: 'a', date: '2026-01-01' }), makeTest({ id: 'b', date: '2026-01-09' })],
        });
        expect(latestWaterTest(tank)?.id).toBe('b');
    });
    it('returns undefined when there are no tests', () => {
        expect(latestWaterTest(makeTank())).toBeUndefined();
    });
});

describe('addCountEntry / currentCount', () => {
    it('appends immutably and currentCount reflects the newest entry', () => {
        const plant = makePlant();
        const updated = addCountEntry(plant, { date: '2026-02-01', count: 3, reason: 'split' });

        expect(updated).not.toBe(plant);
        expect(currentCount(updated)).toBe(3);
        expect(currentCount(plant)).toBe(1);
    });

    it('keeps history sorted even when adding a backdated entry', () => {
        const plant = makePlant({ countHistory: [{ date: '2026-02-01', count: 5 }] });
        const updated = addCountEntry(plant, { date: '2026-01-10', count: 2 });
        expect(updated.countHistory.map(c => c.date)).toEqual(['2026-01-10', '2026-02-01']);
        expect(currentCount(updated)).toBe(5);
    });
});

describe('markDeparture / updatePlant', () => {
    it('marks only the targeted plant as departed', () => {
        const tank = makeTank({ aquaticPlants: [makePlant({ id: 'p1' }), makePlant({ id: 'p2' })] });
        const result = updatePlant(tank, 'p2', p => markDeparture(p, '2026-03-01'));

        expect(result.aquaticPlants?.find(p => p.id === 'p1')?.departureDate).toBeUndefined();
        expect(result.aquaticPlants?.find(p => p.id === 'p2')?.departureDate).toBe('2026-03-01');
        expect(tank.aquaticPlants?.find(p => p.id === 'p2')?.departureDate).toBeUndefined();
    });
});

const makePhoto = (overrides: Partial<Photo> = {}): Photo => ({
    id: 'ph1',
    src: 'data:image/jpeg;base64,AAA',
    date: '2026-06-30',
    ...overrides,
});

describe('addPhoto / removePhoto', () => {
    it('appends immutably, creating the array when missing', () => {
        const tank = makeTank();
        const result = addPhoto(tank, makePhoto());

        expect(result).not.toBe(tank);
        expect(result.photos?.length).toBe(1);
        expect(tank.photos).toBeUndefined(); // 入参不被修改
    });

    it('removes by id without mutating the input', () => {
        const tank = makeTank({ photos: [makePhoto({ id: 'a' }), makePhoto({ id: 'b' })] });
        const result = removePhoto(tank, 'a');

        expect(result.photos?.map(p => p.id)).toEqual(['b']);
        expect(tank.photos?.length).toBe(2);
    });
});

describe('activityLog photos', () => {
    const baseTank = () =>
        makeTank({
            waterTests: [makeTest({ id: 'wt1', date: '2026-01-02' })],
            aquaticPlants: [makePlant({ id: 'p1' })],
        });

    it('attaches a linked photo to its activity event as a thumbnail', () => {
        const tank = addPhoto(baseTank(), makePhoto({ linkedTo: 'test:wt1' }));
        const events = activityLog(tank);

        const test = events.find(e => e.key === 'test:wt1');
        expect(test?.photos?.map(p => p.id)).toEqual(['ph1']);
        // 挂上去的照片不再单独成条
        expect(events.some(e => e.category === 'photo')).toBe(false);
    });

    it('turns an unlinked (progress) photo into its own "Photo added" event', () => {
        const tank = addPhoto(baseTank(), makePhoto({ caption: 'Two weeks in' }));
        const events = activityLog(tank);

        const photoEvent = events.find(e => e.key === 'photo:ph1');
        expect(photoEvent?.title).toBe('Photo added');
        expect(photoEvent?.detail).toBe('Two weeks in');
        expect(photoEvent?.date).toBe('2026-06-30');
        expect(photoEvent?.photos?.map(p => p.id)).toEqual(['ph1']);
    });

    it('falls back to a standalone event when the linked activity no longer exists', () => {
        const tank = addPhoto(baseTank(), makePhoto({ linkedTo: 'test:gone' }));
        const events = activityLog(tank);

        expect(events.find(e => e.key === 'photo:ph1')).toBeDefined();
    });

    it('gives every derived event a stable key', () => {
        const keys = activityLog(baseTank()).map(e => e.key);
        expect(keys).toContain('setup');
        expect(keys).toContain('test:wt1');
        expect(keys).toContain('add:p1');
    });

    it('lists same-day water tests latest-entered first', () => {
        let tank = makeTank({ waterTests: [] });
        tank = addWaterTest(tank, makeTest({ id: 'morning', date: '2026-01-02' }));
        tank = addWaterTest(tank, makeTest({ id: 'evening', date: '2026-01-02' }));

        const keys = activityLog(tank).map(e => e.key);
        expect(keys.indexOf('test:evening')).toBeLessThan(keys.indexOf('test:morning'));
    });
});

describe('photoType / sortPhotosDesc', () => {
    it('reads a missing type as other', () => {
        expect(photoType(makePhoto())).toBe('other');
        expect(photoType(makePhoto({ type: 'fts' }))).toBe('fts');
    });

    it('sorts newest first without mutating the input', () => {
        const photos = [makePhoto({ id: 'a', date: '2026-05-01' }), makePhoto({ id: 'b', date: '2026-06-01' })];
        expect(sortPhotosDesc(photos).map(p => p.id)).toEqual(['b', 'a']);
        expect(photos[0].id).toBe('a');
    });

    it('lists same-day photos latest-added first', () => {
        const photos = [makePhoto({ id: 'a', date: '2026-06-01' }), makePhoto({ id: 'b', date: '2026-06-01' })];
        expect(sortPhotosDesc(photos).map(p => p.id)).toEqual(['b', 'a']);
    });
});

describe('ftsPhotosAsc', () => {
    it('keeps only FTS photos, ascending by date', () => {
        const tank = makeTank({
            photos: [
                makePhoto({ id: 'a', date: '2026-06-01', type: 'fts' }),
                makePhoto({ id: 'b', date: '2026-05-01', type: 'livestock' }),
                makePhoto({ id: 'c', date: '2026-04-01', type: 'fts' }),
                makePhoto({ id: 'd', date: '2026-03-01' }), // 无 type → other,排除
            ],
        });
        expect(ftsPhotosAsc(tank).map(p => p.id)).toEqual(['c', 'a']);
    });

    it('returns an empty array when the tank has no photos', () => {
        expect(ftsPhotosAsc(makeTank())).toEqual([]);
    });
});

describe('photosByMonth', () => {
    it('groups by YYYY-MM, newest month first, photos desc within a group', () => {
        const groups = photosByMonth([
            makePhoto({ id: 'a', date: '2026-04-13' }),
            makePhoto({ id: 'b', date: '2026-06-17' }),
            makePhoto({ id: 'c', date: '2026-06-03' }),
        ]);

        expect(groups.map(g => g.key)).toEqual(['2026-06', '2026-04']);
        expect(groups[0].photos.map(p => p.id)).toEqual(['b', 'c']);
    });

    it('returns no groups for no photos', () => {
        expect(photosByMonth([])).toEqual([]);
    });
});

describe('nearestTestAtOrBefore', () => {
    const tests = [
        makeTest({ id: 'a', date: '2026-05-04' }),
        makeTest({ id: 'b', date: '2026-05-24' }),
        makeTest({ id: 'c', date: '2026-06-03' }),
    ];

    it('returns the same-day test when one exists', () => {
        expect(nearestTestAtOrBefore(tests, '2026-05-24')?.id).toBe('b');
    });

    it('falls back to the closest earlier test', () => {
        expect(nearestTestAtOrBefore(tests, '2026-05-30')?.id).toBe('b');
    });

    it('returns undefined for a date before every test', () => {
        expect(nearestTestAtOrBefore(tests, '2026-05-01')).toBeUndefined();
    });
});

describe('daysBetween', () => {
    it('counts days from a to b', () => expect(daysBetween('2026-04-13', '2026-05-24')).toBe(41));
    it('is zero on the same day', () => expect(daysBetween('2026-04-13', '2026-04-13')).toBe(0));
});

describe('seriesOf', () => {
    it('extracts midpoints and min/max, skipping tests without the parameter', () => {
        const tests: WaterTest[] = [
            makeTest({ id: 'a', date: '2026-01-01', pH: 7 }),
            makeTest({ id: 'b', date: '2026-01-05' }), // 没测 pH,跳过
            makeTest({ id: 'c', date: '2026-01-03', pH: { min: 6, max: 8 } }),
        ];
        const series = seriesOf(tests, 'pH');

        expect(series.map(p => p.date)).toEqual(['2026-01-01', '2026-01-03']);
        expect(series[1]).toEqual({ date: '2026-01-03', value: 7, min: 6, max: 8 });
    });
});
