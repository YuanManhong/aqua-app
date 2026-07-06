// Tank Overview 的分诊逻辑:每个缸算出一个等级 + 紧急度分数 + 一句话原因。
// 纯 TS,不依赖 Angular(和其余 domain 一样);阈值复用 water-status,不另存一份。
import { Tank } from './tank.model';
import { daysBetween, latestWaterTest } from './tank.logic';
import { statusOf } from './water-status';
import { WATER_PARAMS } from './water-params';
import { HardnessUnit, formatParamValue, unitOf } from './hardness';

export type TriageLevel = 'danger' | 'watch' | 'stale' | 'none' | 'safe';

export interface TankTriage {
    level: TriageLevel;
    /** 排序键,越大越紧急 */
    score: number;
    /** 一句话原因(卡片 why-line) */
    whyText: string;
    /** 最近一次测试距今天数;从未测过则 undefined */
    testAgeDays?: number;
}

/** 最近一次测试超过这个天数 → 'stale'(数据过期比单个参数漂移更不可知) */
export const STALE_TEST_DAYS = 14;
/** 最近一次换水超过这个天数 → 页脚换水标签变琥珀色 */
export const STALE_CHANGE_DAYS = 21;

/**
 * 分级规则(先命中先赢):任一参数 danger → danger;任一 watch → watch;
 * 测试过期 → stale;从未测过 → none;否则 safe。
 * 分数:danger×100 + watch×12 + (stale?18:0) + (没测过?9:0)。
 * stale(18)故意高于单个 watch(12):两周前的数据是更大的未知数。
 */
export function triageTank(tank: Tank, today: string, hardnessUnit: HardnessUnit = 'degrees'): TankTriage {
    const latest = latestWaterTest(tank);
    const dangerParts: string[] = [];
    const watchParts: string[] = [];
    let measured = 0;
    for (const p of WATER_PARAMS) {
        const v = latest?.[p.key];
        if (v === undefined) continue;
        measured++;
        const unit = unitOf(p.key, hardnessUnit);
        const text = p.label + ' ' + formatParamValue(p.key, v, hardnessUnit) + (unit ? ' ' + unit : '');
        const status = statusOf(p.key, v);
        if (status === 'danger') dangerParts.push(text);
        else if (status === 'watch') watchParts.push(text);
    }

    const testAgeDays = latest ? daysBetween(latest.date, today) : undefined;
    const stale = testAgeDays !== undefined && testAgeDays > STALE_TEST_DAYS;
    const level: TriageLevel = dangerParts.length
        ? 'danger'
        : watchParts.length
          ? 'watch'
          : stale
            ? 'stale'
            : !latest
              ? 'none'
              : 'safe';
    const score = dangerParts.length * 100 + watchParts.length * 12 + (stale ? 18 : 0) + (latest ? 0 : 9);

    const parts: string[] = [];
    if (dangerParts.length) parts.push(dangerParts.join(', ') + ' in the danger zone');
    if (watchParts.length) parts.push(watchParts.join(', ') + ' to watch');
    if (latest && stale) parts.push('last test ' + relativeLabel(latest.date, today));
    const whyText =
        parts.join(' · ') ||
        (latest ? `All ${measured} parameters in range` : 'No tests logged yet — log the first one');

    return { level, score, whyText, ...(testAgeDays !== undefined ? { testAgeDays } : {}) };
}

/** 相对时间标签:"today" / "yesterday" / "N days ago" / "N weeks ago" / "N months ago" */
export function relativeLabel(iso: string, today: string): string {
    const days = daysBetween(iso, today);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
}

/**
 * 最近一次换水日期:换水还不是一等公民记录,先从测试备注推——
 * 备注同时含 "change" 和("%" 或 "water")就当那天换过水。
 * 后续换水成为独立记录后,这个推导降级为旧数据的兜底。
 */
export function lastWaterChangeDate(tank: Tank): string | undefined {
    let latest: string | undefined;
    for (const wt of tank.waterTests ?? []) {
        const note = wt.note?.toLowerCase() ?? '';
        if (!note.includes('change')) continue;
        if (!note.includes('%') && !note.includes('water')) continue;
        if (!latest || wt.date > latest) latest = wt.date;
    }
    return latest;
}
