import { describe, expect, it } from 'vitest';
import { lastWaterChangeDate, relativeLabel, triageTank } from './tank-triage';
import { Tank, WaterTest } from './tank.model';

const TODAY = '2026-07-05';

const makeTank = (overrides: Partial<Tank> = {}): Tank => ({
    id: 't1',
    name: 'Test Tank',
    startDate: '2026-01-01',
    ...overrides,
});

/** 默认全参数落在 safe 区间,单测按需覆盖某个参数 */
const makeTest = (overrides: Partial<WaterTest> = {}): WaterTest => ({
    id: 'wt1',
    date: TODAY,
    pH: 7,
    ammoniaAmmonium: 0,
    nitrite: 0,
    nitrate: 10,
    GH: 6,
    KH: 4,
    ...overrides,
});

describe('triageTank', () => {
    it('is safe when all measured params are in range', () => {
        const t = triageTank(makeTank({ waterTests: [makeTest()] }), TODAY);
        expect(t.level).toBe('safe');
        expect(t.score).toBe(0);
        expect(t.whyText).toBe('All 6 parameters in range');
        expect(t.testAgeDays).toBe(0);
    });

    it('counts only measured params in the safe fallback text', () => {
        const t = triageTank(
            makeTank({ waterTests: [{ id: 'wt1', date: TODAY, pH: 7, nitrate: 10 }] }),
            TODAY,
        );
        expect(t.whyText).toBe('All 2 parameters in range');
    });

    it('is none with score 9 when there are no tests', () => {
        const t = triageTank(makeTank(), TODAY);
        expect(t.level).toBe('none');
        expect(t.score).toBe(9);
        expect(t.whyText).toBe('No tests logged yet — log the first one');
        expect(t.testAgeDays).toBeUndefined();
    });

    it('flags a danger param with unit and range text', () => {
        const t = triageTank(
            makeTank({ waterTests: [makeTest({ ammoniaAmmonium: 0.5 })] }),
            TODAY,
        );
        expect(t.level).toBe('danger');
        expect(t.score).toBe(100);
        expect(t.whyText).toBe('Ammonia 0.5 ppm in the danger zone');
    });

    it('flags a watch param (midpoint of a range) as "to watch"', () => {
        const t = triageTank(
            makeTank({ waterTests: [makeTest({ nitrate: { min: 20, max: 30 } })] }),
            TODAY,
        );
        expect(t.level).toBe('watch');
        expect(t.score).toBe(12);
        expect(t.whyText).toBe('Nitrate 20–30 ppm to watch');
    });

    it('comma-joins multiple params before the suffix', () => {
        const t = triageTank(
            makeTank({ waterTests: [makeTest({ ammoniaAmmonium: 0.5, pH: 5 })] }),
            TODAY,
        );
        expect(t.score).toBe(200);
        expect(t.whyText).toBe('pH 5, Ammonia 0.5 ppm in the danger zone');
    });

    it('joins danger, watch and staleness parts with a dot separator', () => {
        const t = triageTank(
            makeTank({
                waterTests: [makeTest({ date: '2026-06-01', ammoniaAmmonium: 0.5, nitrate: 25 })],
            }),
            TODAY,
        );
        expect(t.level).toBe('danger');
        expect(t.score).toBe(100 + 12 + 18);
        expect(t.whyText).toBe(
            'Ammonia 0.5 ppm in the danger zone · Nitrate 25 ppm to watch · last test 5 weeks ago',
        );
    });

    it('is stale when the latest test is older than 14 days', () => {
        const t = triageTank(makeTank({ waterTests: [makeTest({ date: '2026-06-10' })] }), TODAY);
        expect(t.level).toBe('stale');
        expect(t.score).toBe(18); // stale (18) outranks a single watch (12)
        expect(t.whyText).toBe('last test 4 weeks ago');
        expect(t.testAgeDays).toBe(25);
    });

    it('is not stale at exactly 14 days', () => {
        const t = triageTank(makeTank({ waterTests: [makeTest({ date: '2026-06-21' })] }), TODAY);
        expect(t.level).toBe('safe');
    });

    it('pH carries no unit in the why text', () => {
        const t = triageTank(makeTank({ waterTests: [makeTest({ pH: 5 })] }), TODAY);
        expect(t.whyText).toBe('pH 5 in the danger zone');
    });

    it('triages only the latest test', () => {
        const t = triageTank(
            makeTank({
                waterTests: [makeTest({ id: 'old', date: '2026-07-01', ammoniaAmmonium: 2 }), makeTest({ id: 'new' })],
            }),
            TODAY,
        );
        expect(t.level).toBe('safe');
    });
});

describe('relativeLabel', () => {
    it('says today for the same day or future dates', () => {
        expect(relativeLabel('2026-07-05', TODAY)).toBe('today');
        expect(relativeLabel('2026-07-06', TODAY)).toBe('today');
    });
    it('says yesterday for 1 day', () => expect(relativeLabel('2026-07-04', TODAY)).toBe('yesterday'));
    it('uses days under 14', () => expect(relativeLabel('2026-06-22', TODAY)).toBe('13 days ago'));
    it('uses weeks from 14 to 59 days', () => {
        expect(relativeLabel('2026-06-21', TODAY)).toBe('2 weeks ago');
        expect(relativeLabel('2026-05-07', TODAY)).toBe('8 weeks ago');
    });
    it('uses months from 60 days', () => expect(relativeLabel('2026-05-06', TODAY)).toBe('2 months ago'));
});

describe('lastWaterChangeDate', () => {
    it('returns undefined when no note mentions a change', () => {
        expect(lastWaterChangeDate(makeTank({ waterTests: [makeTest({ note: 'all good' })] }))).toBeUndefined();
        expect(lastWaterChangeDate(makeTank())).toBeUndefined();
    });

    it('requires "change" plus "%" or "water" in the note', () => {
        const tank = makeTank({
            waterTests: [
                makeTest({ id: 'a', date: '2026-06-01', note: 'changed the filter pad' }), // 只有 change,不算
                makeTest({ id: 'b', date: '2026-06-10', note: 'Nitrate high — did a 30% change.' }),
            ],
        });
        expect(lastWaterChangeDate(tank)).toBe('2026-06-10');
    });

    it('matches "water change" wording case-insensitively', () => {
        const tank = makeTank({ waterTests: [makeTest({ note: 'Weekly Water Change done' })] });
        expect(lastWaterChangeDate(tank)).toBe(TODAY);
    });

    it('returns the most recent qualifying date', () => {
        const tank = makeTank({
            waterTests: [
                makeTest({ id: 'a', date: '2026-06-20', note: '50% water change' }),
                makeTest({ id: 'b', date: '2026-06-05', note: 'small 10% change' }),
            ],
        });
        expect(lastWaterChangeDate(tank)).toBe('2026-06-20');
    });
});
