import { Tank } from './tank.model';

// 首次启动(localStorage 为空)时的种子数据
export const seedTanks: Tank[] = [
    {
        id: 'tank-1',
        name: 'My First Tank',
        startDate: '2026-04-13',
        waterTests: [
            {
                id: 'wt-1',
                date: '2026-04-13',
                pH: { min: 6.5, max: 7.5 },
                ammoniaAmmonium: { min: 0, max: 0.25 },
                nitrite: { min: 0.25, max: 0.5 },
                nitrate: { min: 10, max: 20 },
            },
            {
                id: 'wt-2',
                date: '2026-04-14',
                pH: { min: 6.5, max: 7.5 },
                ammoniaAmmonium: { min: 0, max: 0.25 },
                nitrite: { min: 0.25, max: 0.5 },
                nitrate: { min: 10, max: 20 },
            },
        ],
        aquaticPlants: [
            {
                id: 'plant-1',
                species: 'Java Moss',
                countHistory: [{ date: '2026-04-13', count: 1 }],
                onBoardDate: '2026-04-13',
            },
            {
                id: 'plant-2',
                species: 'Anubias',
                countHistory: [{ date: '2026-04-13', count: 2 }],
                onBoardDate: '2026-04-13',
            },
        ],
    },
];
