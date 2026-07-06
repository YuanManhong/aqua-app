import { Photo, Tank, newId } from './tank.model';

// 示例照片共用一张占位图(public/ 下的开缸背景图)——重点是让 Gallery v2 的
// 按月分组 / FTS 进程对比 / lightbox 日期连接有数据可看,真实照片是用户传的。
const PHOTO_SRC = '/first-tank-bg.jpg';

function buildSamplePhotos(): Photo[] {
    return [
        { id: 'ph-1', src: PHOTO_SRC, date: '2026-04-13', type: 'fts', caption: 'Day one — fresh fill, nothing grown in yet.' },
        { id: 'ph-2', src: PHOTO_SRC, date: '2026-04-20', type: 'fts', caption: 'One week in — still cycling, water a little hazy.' },
        { id: 'ph-3', src: PHOTO_SRC, date: '2026-04-27', type: 'problem', caption: 'Milky bacterial bloom while the nitrite spiked.' },
        { id: 'ph-4', src: PHOTO_SRC, date: '2026-05-04', type: 'other', caption: 'Planted three Cryptocoryne along the back wall.' },
        { id: 'ph-5', src: PHOTO_SRC, date: '2026-05-14', type: 'fts', caption: 'Cycle complete — first shrimp went in today.' },
        { id: 'ph-6', src: PHOTO_SRC, date: '2026-05-15', type: 'livestock', caption: 'Cherry shrimp already grazing the moss.' },
        { id: 'ph-7', src: PHOTO_SRC, date: '2026-05-24', type: 'problem', caption: 'Green algae film on the glass — nitrate got away from me.' },
        { id: 'ph-8', src: PHOTO_SRC, date: '2026-06-03', type: 'fts', caption: 'Cleared right up after a 30% water change.' },
        { id: 'ph-9', src: PHOTO_SRC, date: '2026-06-16', type: 'livestock', caption: 'They bred — counted 15 cherries this morning.' },
        { id: 'ph-10', src: PHOTO_SRC, date: '2026-06-17', type: 'fts', caption: 'Java moss is really filling in now.' },
        { id: 'ph-11', src: PHOTO_SRC, date: '2026-06-30', type: 'fts', caption: 'Ten weeks in — a proper little jungle.' },
        { id: 'ph-12', src: PHOTO_SRC, date: '2026-07-02', type: 'livestock', caption: 'Nerite doing slow laps of the front glass.' },
    ];
}

// 首次使用时可选加载的示例缸:约 11 周历史(开缸 → 闯缸 → 稳定),
// 让新用户不用先攒数据就能看到趋势图和活动流的样子。
// 日期固定在 2026 年,保证数据确定性(demo 用,无需"永远显示最近")。
export function buildSampleTank(): Tank {
    return {
        id: newId(),
        name: 'Shrimp Tank',
        isSample: true,
        startDate: '2026-04-13',
        volume: '5.5 gal',
        waterType: 'freshwater',
        setupStyle: 'planted',
        techLevel: 'low-tech',
        waterTests: [
            { id: 'wt-1', date: '2026-04-13', pH: { min: 6.5, max: 7.5 }, ammoniaAmmonium: { min: 0.25, max: 0.5 }, nitrite: 0, nitrate: { min: 5, max: 10 }, GH: 6, KH: 4, note: 'Fresh setup — first fill.' },
            { id: 'wt-2', date: '2026-04-20', pH: { min: 6.5, max: 7.5 }, ammoniaAmmonium: { min: 0.5, max: 1 }, nitrite: { min: 0.25, max: 0.5 }, nitrate: { min: 5, max: 10 }, GH: 6, KH: 4, note: 'Cycling — ammonia climbing.' },
            { id: 'wt-3', date: '2026-04-27', pH: 6.8, ammoniaAmmonium: 0.25, nitrite: { min: 1, max: 2 }, nitrate: { min: 10, max: 20 }, GH: { min: 5, max: 6 }, KH: { min: 3, max: 4 }, note: 'Nitrite spike.' },
            { id: 'wt-4', date: '2026-05-04', pH: 6.8, ammoniaAmmonium: 0, nitrite: { min: 0.25, max: 0.5 }, nitrate: { min: 20, max: 40 }, GH: 5, KH: 3 },
            { id: 'wt-5', date: '2026-05-14', pH: 6.9, ammoniaAmmonium: 0, nitrite: 0, nitrate: 20, GH: 6, KH: 4, note: 'Cycle complete — added shrimp.' },
            { id: 'wt-6', date: '2026-05-24', pH: 7, ammoniaAmmonium: 0, nitrite: 0, nitrate: { min: 40, max: 50 }, GH: 7, KH: 4, note: 'Nitrate high — did a 30% change.' },
            { id: 'wt-7', date: '2026-06-03', pH: 6.9, ammoniaAmmonium: 0, nitrite: 0, nitrate: { min: 15, max: 20 }, GH: { min: 6, max: 7 }, KH: 4 },
            { id: 'wt-8', date: '2026-06-16', pH: 6.8, ammoniaAmmonium: 0, nitrite: 0, nitrate: { min: 10, max: 20 }, GH: 6, KH: 4 },
            { id: 'wt-9', date: '2026-06-30', pH: 6.9, ammoniaAmmonium: 0, nitrite: 0, nitrate: { min: 20, max: 30 }, GH: 6, KH: 4, note: 'Nitrate creeping up again.' },
        ],
        livestock: [
            { id: 'ls-1', species: 'Ember Tetras', color: '#e8613c', kind: 'group', onBoardDate: '2026-05-14', countHistory: [{ date: '2026-05-14', count: 8 }] },
            { id: 'ls-2', species: 'Red Cherry Shrimp', color: '#c0392b', kind: 'group', onBoardDate: '2026-05-14', countHistory: [{ date: '2026-05-14', count: 10 }, { date: '2026-06-16', count: 15, reason: 'bred' }] },
            { id: 'ls-3', species: 'Nerite Snails', color: '#7c6a4a', kind: 'group', onBoardDate: '2026-05-24', countHistory: [{ date: '2026-05-24', count: 2 }] },
        ],
        aquaticPlants: [
            { id: 'pl-1', species: 'Java Moss', onBoardDate: '2026-04-13', countHistory: [{ date: '2026-04-13', count: 1 }] },
            { id: 'pl-2', species: 'Anubias Nana', onBoardDate: '2026-04-13', countHistory: [{ date: '2026-04-13', count: 2 }] },
            { id: 'pl-3', species: 'Cryptocoryne', onBoardDate: '2026-05-04', countHistory: [{ date: '2026-05-04', count: 3 }] },
        ],
        photos: buildSamplePhotos(),
    };
}
