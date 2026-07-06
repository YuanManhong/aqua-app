import { Component, computed, inject, output, signal } from '@angular/core';
import { Tank, todayISO } from '../../domain/tank.model';
import {
    activeInhabitants,
    daysBetween,
    ftsPhotosAsc,
    latestWaterTest,
    sortPhotosDesc,
} from '../../domain/tank.logic';
import { WaterStatus, statusOf } from '../../domain/water-status';
import { HardnessUnit, formatParamValue, unitOf } from '../../domain/hardness';
import { SHORT_PARAM_LABELS, WATER_PARAMS } from '../../domain/water-params';
import {
    STALE_CHANGE_DAYS,
    STALE_TEST_DAYS,
    TriageLevel,
    lastWaterChangeDate,
    relativeLabel,
    triageTank,
} from '../../domain/tank-triage';
import { STATUS_COLORS, StatusColor } from '../ui/tokens';
import { TankStore } from '../../state/tank.store';
import { SettingsStore } from '../../state/settings.store';

type SortMode = 'urgency' | 'name';

interface Tile {
    key: string;
    label: string;
    display: string;
    title: string;
    c: StatusColor;
}

interface TankCard {
    id: string;
    name: string;
    metaLine: string;
    level: TriageLevel;
    score: number;
    badgeLabel: string;
    badge: StatusColor;
    whyText: string;
    whyColor: string;
    tiles: Tile[];
    photoSrc: string | null;
    testedLabel: string;
    testedOverdue: boolean;
    changedLabel: string;
    changedOverdue: boolean;
}

interface SummaryChip {
    label: string;
    c: StatusColor;
}

// 分诊等级 → 徽章文案/配色(stale 借用 watch 的琥珀色)
const BADGE_LABELS: Record<TriageLevel, string> = {
    danger: 'Needs action',
    watch: 'Watch',
    stale: 'Test overdue',
    none: 'No data',
    safe: 'Healthy',
};
const LEVEL_COLOR: Record<TriageLevel, WaterStatus> = {
    danger: 'danger',
    watch: 'watch',
    stale: 'watch',
    none: 'none',
    safe: 'safe',
};
// why-line 文字色:danger/watch/safe 用状态 chip 色;none 用中性灰(比 chip 色更可读)
const WHY_COLORS: Record<TriageLevel, string> = {
    danger: STATUS_COLORS.danger.chip,
    watch: STATUS_COLORS.watch.chip,
    stale: STATUS_COLORS.watch.chip,
    none: '#7d9391',
    safe: STATUS_COLORS.safe.chip,
};

// 多缸总览:一屏回答"哪个缸最需要先处理"。卡片按紧急度排序,
// 整卡可点进对应缸的 dashboard;分诊全部现算(triageTank),不落任何新数据。
@Component({
    selector: 'tank-overview',
    template: `
    <div class="page">
      <div class="shell">

        <header class="card header">
          <div class="head-left">
            <div class="eyebrow">Aquarium log · {{ store.allTanks().length }} tanks</div>
            <h1>All tanks</h1>
            <div class="chips">
              @for (chip of chips(); track chip.label) {
                <span class="chip" [style.background]="chip.c.bg" [style.border-color]="chip.c.border" [style.color]="chip.c.chip">
                  <span class="chip-dot" [style.background]="chip.c.dot"></span>{{ chip.label }}
                </span>
              }
            </div>
          </div>
          <div class="head-right">
            <span class="sort-label">Sort</span>
            <div class="controls">
              <div class="segmented">
                <button type="button" [class.active]="sortMode() === 'urgency'" (click)="sortMode.set('urgency')">By urgency</button>
                <button type="button" [class.active]="sortMode() === 'name'" (click)="sortMode.set('name')">By name</button>
              </div>
              <button type="button" class="gear" aria-label="Settings" title="Settings" (click)="openSettings.emit()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            </div>
          </div>
        </header>

        <div class="grid">
          @for (t of cards(); track t.id) {
            <button type="button" class="tank-card" (click)="openTank.emit(t.id)">
              @if (t.photoSrc) {
                <span class="spine"><img [src]="t.photoSrc" alt="" /></span>
              } @else {
                <span class="spine spine-empty"><span class="no-photo">no photo yet</span></span>
              }

              <span class="content">
                <span class="name-row">
                  <span class="name-block">
                    <span class="name">{{ t.name }}</span>
                    <span class="meta">{{ t.metaLine }}</span>
                  </span>
                  <span class="badge" [style.background]="t.badge.bg" [style.border-color]="t.badge.border" [style.color]="t.badge.chip">{{ t.badgeLabel }}</span>
                </span>

                <span class="why">
                  <span class="why-dot" [style.background]="t.badge.dot"></span>
                  <span class="why-text" [style.color]="t.whyColor">{{ t.whyText }}</span>
                </span>

                <span class="tiles">
                  @for (tile of t.tiles; track tile.key) {
                    <span class="tile" [title]="tile.title" [style.background]="tile.c.bg" [style.border-color]="tile.c.border">
                      <span class="tile-label" [style.color]="tile.c.label">{{ tile.label }}</span>
                      <span class="tile-value">{{ tile.display }}</span>
                    </span>
                  }
                </span>

                <span class="foot">
                  <span class="foot-item" [class.overdue]="t.testedOverdue">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
                    {{ t.testedLabel }}
                  </span>
                  <span class="foot-item" [class.overdue]="t.changedOverdue">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" /></svg>
                    {{ t.changedLabel }}
                  </span>
                </span>
              </span>
            </button>
          }

          <button type="button" class="ghost" (click)="createTank.emit()">
            <span class="ghost-plus">+</span>
            <span class="ghost-label">Add a tank</span>
          </button>
        </div>

      </div>
    </div>
  `,
    styles: `
    .page {
      min-height: 100vh;
      background: radial-gradient(1200px 600px at 80% -10%, #dcecec 0%, #eaf1f2 55%);
      padding: 26px 24px 48px;
      box-sizing: border-box;
    }
    .shell { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .card {
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      box-shadow: 0 1px 2px rgba(18, 49, 47, 0.04);
    }

    /* ---------- header ---------- */
    .header {
      padding: 24px 28px 22px;
      display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 18px;
    }
    .head-left { min-width: 260px; }
    .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #5a8180; }
    h1 {
      font-family: 'Newsreader', serif; font-weight: 500; font-size: 40px; line-height: 1.02;
      margin: 6px 0 13px; color: #0f2e2c; letter-spacing: -0.01em;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px;
      border: 1px solid; font-size: 13px; font-weight: 700; white-space: nowrap;
    }
    .chip-dot { width: 8px; height: 8px; border-radius: 50%; }

    .head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex: 0 0 auto; }
    .sort-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8aa19f; }
    .controls { display: flex; align-items: center; gap: 8px; }
    .gear {
      appearance: none; border: 1px solid #dcecec; background: #fff; color: #5a7371;
      width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .gear:hover { background: #f2fafa; border-color: #0f8a8d; color: #0f8a8d; }
    .gear svg { display: block; }
    .segmented { display: inline-flex; border: 1px solid #dcecec; border-radius: 8px; overflow: hidden; }
    .segmented button {
      appearance: none; border: none; font: inherit; font-size: 12.5px; font-weight: 700;
      padding: 8px 14px; cursor: pointer; white-space: nowrap; background: #fff; color: #3c5a5c;
    }
    .segmented button.active { background: #0f8a8d; color: #fff; }

    /* ---------- card grid ---------- */
    .grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(min(480px, 100%), 1fr));
      gap: 16px; align-items: stretch;
    }

    /* ---------- tank card(整卡一个点击目标) ---------- */
    .tank-card {
      appearance: none; font: inherit; text-align: left; padding: 0; cursor: pointer;
      display: flex; align-items: stretch;
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      box-shadow: 0 1px 2px rgba(18, 49, 47, 0.04); overflow: hidden; color: inherit;
      transition: box-shadow .15s ease, transform .15s ease, border-color .15s ease;
    }
    .tank-card:hover {
      border-color: #b9d2d1; box-shadow: 0 10px 24px rgba(18, 49, 47, 0.10); transform: translateY(-2px);
    }

    .spine { flex: 0 0 112px; position: relative; overflow: hidden; background: #dfeaea; }
    .spine img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .spine-empty {
      background: repeating-linear-gradient(135deg, #eef4f4 0 10px, #e6efef 10px 20px);
      display: flex; align-items: center; justify-content: center;
    }
    .no-photo {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #8aa19f;
      letter-spacing: 0.06em; transform: rotate(-90deg); white-space: nowrap;
    }

    .content { flex: 1; min-width: 0; padding: 15px 18px 13px; display: flex; flex-direction: column; gap: 10px; }

    .name-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .name-block { min-width: 0; display: block; }
    .name {
      display: block; font-family: 'Newsreader', serif; font-weight: 500; font-size: 23px; line-height: 1.05;
      color: #0f2e2c; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .meta { display: block; font-size: 12.5px; font-weight: 600; color: #7d9391; margin-top: 4px; }
    .badge {
      flex: 0 0 auto; display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px;
      border: 1px solid; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      white-space: nowrap;
    }

    .why { display: flex; align-items: center; gap: 8px; min-height: 19px; }
    .why-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
    .why-text { font-size: 13.5px; font-weight: 600; line-height: 1.35; }

    .tiles { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
    .tile {
      border-radius: 6px; border: 1px solid; padding: 6px 7px 5px;
      display: flex; flex-direction: column; gap: 2px; min-width: 0;
    }
    .tile-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
    .tile-value {
      font-size: 13px; font-weight: 800; color: #12312f; font-feature-settings: 'tnum';
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .foot {
      margin-top: auto; border-top: 1px solid #eef2f2; padding-top: 9px;
      display: flex; flex-wrap: wrap; gap: 5px 18px; font-size: 12.5px;
    }
    .foot-item { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #5a7371; }
    .foot-item svg { display: block; flex: 0 0 auto; }
    .foot-item.overdue { color: #8a5a12; font-weight: 700; }

    /* ---------- ghost card ---------- */
    .ghost {
      appearance: none; font: inherit; cursor: pointer;
      border: 1.5px dashed #c3d6d5; border-radius: 8px; min-height: 186px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px;
      color: #5a8180; background: rgba(255, 255, 255, 0.55);
      transition: border-color .15s ease, color .15s ease, background .15s ease;
    }
    .ghost:hover { border-color: #0f8a8d; color: #0f8a8d; background: #fff; }
    .ghost-plus {
      width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid currentColor;
      display: inline-flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; line-height: 1;
    }
    .ghost-label { font-size: 13.5px; font-weight: 700; }
  `,
})
export class TankOverview {
    readonly store = inject(TankStore);
    private readonly settings = inject(SettingsStore);

    /** 卡片点击 → 父级 selectTank(id) 并切到 dashboard */
    readonly openTank = output<string>();
    /** ghost 卡片 → 建缸流程 */
    readonly createTank = output<void>();
    /** 齿轮按钮 → 设置弹窗(多缸用户的设置入口在这里;单缸用户在缸页) */
    readonly openSettings = output<void>();

    readonly sortMode = signal<SortMode>('urgency');
    private readonly today = todayISO();

    private readonly triaged = computed<TankCard[]>(() => {
        const unit = this.settings.hardnessUnit();
        return this.store.allTanks().map(t => this.toCard(t, unit));
    });

    readonly cards = computed<TankCard[]>(() => {
        const byName = (a: TankCard, b: TankCard) => a.name.localeCompare(b.name);
        const byUrgency = (a: TankCard, b: TankCard) => b.score - a.score || byName(a, b);
        return [...this.triaged()].sort(this.sortMode() === 'name' ? byName : byUrgency);
    });

    // 汇总 chips:只显示非零桶;watch 和 stale 合并成 "to watch"
    readonly chips = computed<SummaryChip[]>(() => {
        const count = (...levels: TriageLevel[]) =>
            this.triaged().filter(c => levels.includes(c.level)).length;
        const chips: SummaryChip[] = [];
        const action = count('danger');
        if (action) chips.push({ label: action === 1 ? '1 needs action' : `${action} need action`, c: STATUS_COLORS.danger });
        const watch = count('watch', 'stale');
        if (watch) chips.push({ label: `${watch} to watch`, c: STATUS_COLORS.watch });
        const safe = count('safe');
        if (safe) chips.push({ label: `${safe} healthy`, c: STATUS_COLORS.safe });
        const none = count('none');
        if (none) chips.push({ label: `${none} no data yet`, c: STATUS_COLORS.none });
        return chips;
    });

    private toCard(tank: Tank, hardnessUnit: HardnessUnit): TankCard {
        const triage = triageTank(tank, this.today, hardnessUnit);
        const latest = latestWaterTest(tank);
        const badge = STATUS_COLORS[LEVEL_COLOR[triage.level]];

        const tiles: Tile[] = WATER_PARAMS.map(p => {
            const v = latest?.[p.key];
            const u = unitOf(p.key, hardnessUnit);
            const unit = u ? ' ' + u : '';
            const display = v === undefined ? '—' : formatParamValue(p.key, v, hardnessUnit);
            return {
                key: p.key,
                label: SHORT_PARAM_LABELS[p.key],
                display,
                title: v === undefined ? `${p.label} — no data` : `${p.label} ${display}${unit}`,
                c: STATUS_COLORS[statusOf(p.key, v)],
            };
        });

        // 照片脊柱:优先最新的全缸照(FTS),没有就用最新的任意照片
        const photo = ftsPhotosAsc(tank).at(-1) ?? sortPhotosDesc(tank.photos ?? [])[0];

        const species = activeInhabitants(tank).livestock.length;
        const metaLine = [
            ...(tank.volume ? [tank.volume] : []),
            `day ${daysBetween(tank.startDate, this.today) + 1}`,
            species ? `${species} species` : 'no livestock',
        ].join(' · ');

        const changed = lastWaterChangeDate(tank);
        const changeAge = changed ? daysBetween(changed, this.today) : undefined;

        return {
            id: tank.id,
            name: tank.name,
            metaLine,
            level: triage.level,
            score: triage.score,
            badgeLabel: BADGE_LABELS[triage.level],
            badge,
            whyText: triage.whyText,
            whyColor: WHY_COLORS[triage.level],
            tiles,
            photoSrc: photo?.src ?? null,
            testedLabel: latest ? 'Tested ' + relativeLabel(latest.date, this.today) : 'Never tested',
            testedOverdue: !latest || (triage.testAgeDays ?? 0) > STALE_TEST_DAYS,
            changedLabel: changed ? 'Water change ' + relativeLabel(changed, this.today) : 'No water changes logged',
            changedOverdue: changeAge !== undefined && changeAge > STALE_CHANGE_DAYS,
        };
    }
}
