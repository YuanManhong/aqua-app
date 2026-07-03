import { describe, expect, it } from 'vitest';
import {
    addCountEntry,
    addWaterTest,
    currentCount,
    formatValueRange,
    latestWaterTest,
    markDeparture,
    midpoint,
    seriesOf,
    sortByDate,
    updatePlant,
} from './tank.logic';
import { AquaticPlant, Tank, WaterTest } from './tank.model';

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
    it('formats a range as min - max', () => expect(formatValueRange({ min: 6.5, max: 7.5 })).toBe('6.5 - 7.5'));
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
