// 展示层设计令牌:颜色映射 + 小工具。纯数据,供各 feature 组件共用。
import { WaterStatus } from '../../domain/water-status';
import { ActivityEvent } from '../../domain/tank.logic';
import { PhotoType } from '../../domain/tank.model';

/** 主题强调色(Add test / active pill / area fill 等) */
export const ACCENT = '#0f8a8d';

/** 状态色板:dot / bg / border / chip(文字)/ label */
export interface StatusColor {
    dot: string;
    bg: string;
    border: string;
    chip: string;
    label: string;
}

export const STATUS_COLORS: Record<WaterStatus, StatusColor> = {
    safe: { dot: '#2f9e6d', bg: '#e8f5ee', border: '#c9e8d7', chip: '#1c6b48', label: '#3d7a63' },
    watch: { dot: '#e0a02a', bg: '#fbf1dd', border: '#f0dcb0', chip: '#8a5a12', label: '#8a6a2c' },
    danger: { dot: '#d1543f', bg: '#fbe7e2', border: '#f0cabf', chip: '#a3341f', label: '#a3543f' },
    none: { dot: '#c3d3d1', bg: '#f4f7f7', border: '#e4ecec', chip: '#9aacaa', label: '#9aacaa' },
};

export const STATUS_LABELS: Record<WaterStatus, string> = {
    safe: 'Safe',
    watch: 'Watch',
    danger: 'Danger',
    none: 'No data',
};

/** 活动日志分类色(livestock 会被 item 自己的 color 覆盖) */
export const CATEGORY_COLORS: Record<ActivityEvent['category'], string> = {
    setup: '#2c6e6b',
    test: '#0f8a8d',
    livestock: '#c0392b',
    plant: '#3f9b6b',
    update: '#e0a02a',
    remove: '#b0785f',
    photo: '#3a6ea5',
};

/** 照片类型徽章:短标签(缩略图角标)/ 全称(lightbox)/ 底色 */
export const PHOTO_TYPES: Record<PhotoType, { label: string; full: string; color: string }> = {
    fts: { label: 'FTS', full: 'Full-tank shot', color: '#0f8a8d' },
    livestock: { label: 'Livestock', full: 'Livestock', color: '#c0392b' },
    problem: { label: 'Problem', full: 'Problem / diagnostic', color: '#d1543f' },
    other: { label: 'Photo', full: 'Photo', color: '#7d9391' },
};

/** 植物统一用绿色作圆点 */
export const PLANT_COLOR = '#3f9b6b';

/** Add new 里 livestock 颜色选择的调色板 */
export const SWATCH_PALETTE: { value: string; label: string }[] = [
    { value: '#e8613c', label: 'Coral' },
    { value: '#c0392b', label: 'Red' },
    { value: '#d69a2d', label: 'Amber' },
    { value: '#3f9b6b', label: 'Green' },
    { value: '#0f8a8d', label: 'Teal' },
    { value: '#3a6ea5', label: 'Blue' },
    { value: '#7c6a4a', label: 'Brown' },
    { value: '#7a5aa8', label: 'Violet' },
];

/** #rrggbb → rgba(),给圆点光环等半透明用 */
export function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
