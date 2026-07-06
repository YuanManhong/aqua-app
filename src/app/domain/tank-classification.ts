import { SetupStyle, Tank, TechLevel, WaterType } from './tank.model';

// 缸的三维分类:三个单选字段各管一个维度(水体 / 风格 / 技术路线)。
// 不做 multi-select——自由勾选会产生 "Planted · Bare-bottom" 这种自相矛盾的组合;
// 依赖规则类似 dependent picklist:Reef/FOWLR 只属海水,Planted/Aquascape 和 CO2 技术路线只属淡水。
// 每个可选字段都允许留空(新手未必知道自己是哪一派),渲染时跳过空值。

export interface Option<T extends string> {
    value: T;
    label: string;
}

export const WATER_TYPES: Option<WaterType>[] = [
    { value: 'freshwater', label: 'Freshwater' },
    { value: 'saltwater', label: 'Saltwater / Marine' },
    { value: 'brackish', label: 'Brackish' },
];

/** eyebrow 等紧凑场合用的短标签("Saltwater / Marine" 太长)。 */
const WATER_TYPE_SHORT: Record<WaterType, string> = {
    freshwater: 'Freshwater',
    saltwater: 'Saltwater',
    brackish: 'Brackish',
};

/** only 缺省 = 任何水体都适用。 */
const SETUP_STYLES: (Option<SetupStyle> & { only?: WaterType[] })[] = [
    { value: 'planted', label: 'Planted', only: ['freshwater'] },
    { value: 'reef', label: 'Reef', only: ['saltwater'] },
    { value: 'fowlr', label: 'FOWLR (fish only + live rock)', only: ['saltwater'] },
    { value: 'biotope', label: 'Biotope' },
    { value: 'aquascape', label: 'Aquascape', only: ['freshwater'] },
    { value: 'species-only', label: 'Species-only' },
    { value: 'bare-bottom', label: 'Bare-bottom' },
    { value: 'community', label: 'Community' },
];

export const TECH_LEVELS: Option<TechLevel>[] = [
    { value: 'low-tech', label: 'Low-tech' },
    { value: 'high-tech', label: 'High-tech (CO₂)' },
];

/** 指定水体下可选的 setup style;未选水体时只给通用项。 */
export function setupStylesFor(waterType: WaterType | '' | undefined): Option<SetupStyle>[] {
    return SETUP_STYLES.filter(s => !s.only || (waterType && s.only.includes(waterType))).map(
        ({ value, label }) => ({ value, label }),
    );
}

/** Tech level(CO2 路线)只对淡水缸有意义。 */
export function techLevelApplies(waterType: WaterType | '' | undefined): boolean {
    return waterType === 'freshwater';
}

export interface ClassificationInput {
    waterType?: WaterType | '';
    setupStyle?: SetupStyle | '';
    techLevel?: TechLevel | '';
}

/**
 * 按依赖规则清洗表单值:空串与不合法组合(如 saltwater + planted)静默降级为"不落字段"。
 * 返回值直接 spread 进 Tank,保证无效组合永远进不了数据。
 */
export function normalizeClassification(
    input: ClassificationInput,
): Pick<Tank, 'waterType' | 'setupStyle' | 'techLevel'> {
    const waterType = input.waterType || undefined;
    const setupStyle =
        input.setupStyle && setupStylesFor(waterType).some(o => o.value === input.setupStyle)
            ? input.setupStyle
            : undefined;
    const techLevel = input.techLevel && techLevelApplies(waterType) ? input.techLevel : undefined;
    return {
        ...(waterType ? { waterType } : {}),
        ...(setupStyle ? { setupStyle } : {}),
        ...(techLevel ? { techLevel } : {}),
    };
}

/** header eyebrow 文案,如 "Freshwater · Planted · Low-tech";空字段跳过,全空返回 ''。 */
export function classificationLabel(
    tank: Pick<Tank, 'waterType' | 'setupStyle' | 'techLevel'>,
): string {
    const style = SETUP_STYLES.find(o => o.value === tank.setupStyle);
    return [
        tank.waterType && WATER_TYPE_SHORT[tank.waterType],
        // FOWLR 的完整 label 带括号说明,eyebrow 里只要缩写
        style && (style.value === 'fowlr' ? 'FOWLR' : style.label),
        tank.techLevel && (tank.techLevel === 'low-tech' ? 'Low-tech' : 'High-tech'),
    ]
        .filter(Boolean)
        .join(' · ');
}
