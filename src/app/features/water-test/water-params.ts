import { WaterParam } from '../../domain/tank.model';

// 水质参数的展示顺序和标签,form / card / trend 共用
export const WATER_PARAMS: { key: WaterParam; label: string }[] = [
    { key: 'pH', label: 'pH' },
    { key: 'ammoniaAmmonium', label: 'Ammonia/Ammonium' },
    { key: 'nitrite', label: 'Nitrite' },
    { key: 'nitrate', label: 'Nitrate' },
    { key: 'GH', label: 'GH' },
    { key: 'KH', label: 'KH' },
];
