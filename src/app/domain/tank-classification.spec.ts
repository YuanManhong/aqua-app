import { describe, expect, it } from 'vitest';
import {
    classificationLabel,
    normalizeClassification,
    setupStylesFor,
    techLevelApplies,
} from './tank-classification';

describe('tank-classification', () => {
    describe('setupStylesFor (dependent picklist)', () => {
        it('offers Planted/Aquascape only under freshwater', () => {
            const values = setupStylesFor('freshwater').map(o => o.value);
            expect(values).toContain('planted');
            expect(values).toContain('aquascape');
            expect(values).not.toContain('reef');
            expect(values).not.toContain('fowlr');
        });

        it('offers Reef/FOWLR only under saltwater', () => {
            const values = setupStylesFor('saltwater').map(o => o.value);
            expect(values).toContain('reef');
            expect(values).toContain('fowlr');
            expect(values).not.toContain('planted');
            expect(values).not.toContain('aquascape');
        });

        it('offers only universal styles under brackish or when water type is unset', () => {
            const universal = ['biotope', 'species-only', 'bare-bottom', 'community'];
            expect(setupStylesFor('brackish').map(o => o.value)).toEqual(universal);
            expect(setupStylesFor(undefined).map(o => o.value)).toEqual(universal);
        });
    });

    describe('techLevelApplies', () => {
        it('only applies to freshwater (CO2 route)', () => {
            expect(techLevelApplies('freshwater')).toBe(true);
            expect(techLevelApplies('saltwater')).toBe(false);
            expect(techLevelApplies('brackish')).toBe(false);
            expect(techLevelApplies(undefined)).toBe(false);
        });
    });

    describe('normalizeClassification', () => {
        it('keeps a valid combination', () => {
            expect(
                normalizeClassification({ waterType: 'freshwater', setupStyle: 'planted', techLevel: 'low-tech' }),
            ).toEqual({ waterType: 'freshwater', setupStyle: 'planted', techLevel: 'low-tech' });
        });

        it('drops empty strings so no field lands on the tank', () => {
            expect(normalizeClassification({ waterType: '', setupStyle: '', techLevel: '' })).toEqual({});
        });

        it('drops a style that is invalid for the water type', () => {
            expect(normalizeClassification({ waterType: 'saltwater', setupStyle: 'planted' })).toEqual({
                waterType: 'saltwater',
            });
        });

        it('drops tech level for non-freshwater tanks', () => {
            expect(normalizeClassification({ waterType: 'saltwater', setupStyle: 'reef', techLevel: 'high-tech' })).toEqual(
                { waterType: 'saltwater', setupStyle: 'reef' },
            );
        });
    });

    describe('classificationLabel (eyebrow)', () => {
        it('joins the three dimensions with a middle dot', () => {
            expect(
                classificationLabel({ waterType: 'freshwater', setupStyle: 'planted', techLevel: 'low-tech' }),
            ).toBe('Freshwater · Planted · Low-tech');
        });

        it('skips empty fields — water type only shows just the water type', () => {
            expect(classificationLabel({ waterType: 'freshwater' })).toBe('Freshwater');
        });

        it('uses short labels for saltwater and FOWLR', () => {
            expect(classificationLabel({ waterType: 'saltwater', setupStyle: 'fowlr' })).toBe('Saltwater · FOWLR');
        });

        it('returns empty string for a legacy tank with no classification', () => {
            expect(classificationLabel({})).toBe('');
        });
    });
});
