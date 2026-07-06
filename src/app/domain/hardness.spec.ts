import { describe, expect, it } from 'vitest';
import {
    degreesToPpm,
    formatParamValue,
    fromDisplayValue,
    ppmToDegrees,
    toDisplayValue,
    unitOf,
} from './hardness';

describe('hardness conversion', () => {
    it('converts degrees to whole ppm', () => {
        expect(degreesToPpm(6)).toBe(107);
        expect(degreesToPpm(4)).toBe(71);
        expect(degreesToPpm(0)).toBe(0);
    });

    it('round-trips: ppm → degrees → ppm lands on the entered value', () => {
        for (const ppm of [36, 71, 107, 143, 214]) {
            expect(degreesToPpm(ppmToDegrees(ppm))).toBe(ppm);
        }
    });

    it('round-trips: whole degrees → ppm → degrees lands back exactly', () => {
        for (const deg of [1, 4, 6, 8, 12]) {
            expect(ppmToDegrees(degreesToPpm(deg))).toBeCloseTo(deg, 1);
        }
    });

    it('leaves non-hardness params untouched', () => {
        expect(toDisplayValue('nitrate', 20, 'ppm')).toBe(20);
        expect(fromDisplayValue('pH', 7, 'ppm')).toBe(7);
    });

    it('leaves values untouched in degrees mode', () => {
        expect(toDisplayValue('GH', 6, 'degrees')).toBe(6);
        expect(fromDisplayValue('KH', 4, 'degrees')).toBe(4);
    });

    it('converts ranges per bound', () => {
        expect(toDisplayValue('GH', { min: 4, max: 6 }, 'ppm')).toEqual({ min: 71, max: 107 });
    });

    it('formats converted values and ranges', () => {
        expect(formatParamValue('GH', 6, 'ppm')).toBe('107');
        expect(formatParamValue('KH', { min: 3, max: 4 }, 'ppm')).toBe('54–71');
        expect(formatParamValue('GH', 6, 'degrees')).toBe('6');
        expect(formatParamValue('GH', undefined, 'ppm')).toBe('-');
    });

    it('switches unit labels only for GH/KH', () => {
        expect(unitOf('GH', 'degrees')).toBe('dGH');
        expect(unitOf('KH', 'degrees')).toBe('dKH');
        expect(unitOf('GH', 'ppm')).toBe('ppm');
        expect(unitOf('KH', 'ppm')).toBe('ppm');
        expect(unitOf('nitrate', 'ppm')).toBe('ppm');
        expect(unitOf('pH', 'ppm')).toBe('');
    });
});
