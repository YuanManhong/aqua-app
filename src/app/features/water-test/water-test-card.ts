import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WaterTest } from '../../domain/tank.model';
import { statusOf } from '../../domain/water-status';
import { formatParamValue, unitOf } from '../../domain/hardness';
import { WATER_PARAMS } from '../../domain/water-params';
import { STATUS_COLORS, STATUS_LABELS } from '../ui/tokens';
import { SettingsStore } from '../../state/settings.store';

interface Tile {
    key: string;
    label: string;
    unit: string;
    display: string;
    statusLabel: string;
    dot: string;
    bg: string;
    border: string;
    chip: string;
    labelColor: string;
}

// 「最新水质」区块:纯展示,只吃一个 input。六个参数 → 状态着色的方格。
@Component({
    selector: 'water-test-card',
    imports: [DatePipe],
    template: `
    <section class="card">
      <div class="head">
        <div>
          <h2>Latest water test</h2>
          <p class="sub">
            @if (test(); as t) {
              {{ t.date | date: 'MMM d, y' }} · {{ relative() }}
            } @else {
              No tests yet
            }
          </p>
        </div>
        @if (totalTests() > 0) {
          <button class="view-all" (click)="viewHistory.emit()">View all {{ totalTests() }} tests <span aria-hidden="true">→</span></button>
        }
      </div>

      <div class="tiles">
        @for (tile of tiles(); track tile.key) {
          <div class="tile" [style.background]="tile.bg" [style.border-color]="tile.border">
            <div class="tile-top">
              <span class="tile-label" [style.color]="tile.labelColor">{{ tile.label }}</span>
              <span class="dot" [style.background]="tile.dot"></span>
            </div>
            <div class="tile-value">
              <span class="num">{{ tile.display }}</span>
              @if (tile.unit) { <span class="unit">{{ tile.unit }}</span> }
            </div>
            <span class="chip" [style.color]="tile.chip">{{ tile.statusLabel }}</span>
          </div>
        }
      </div>
    </section>
  `,
    styles: `
    .card {
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      padding: 16px 22px 18px; box-shadow: 0 1px 2px rgba(18,49,47,0.04);
    }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 13px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 22px; margin: 0; color: #0f2e2c; }
    .sub { margin: 3px 0 0; font-size: 13px; color: #5a7371; }
    .view-all { appearance: none; border: none; background: transparent; color: #0f8a8d; font: inherit; font-weight: 700; font-size: 13px; padding: 0; cursor: pointer; }
    .view-all:hover { text-decoration: underline; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); gap: 9px; }
    .tile { border-radius: 7px; padding: 10px 12px 9px; border: 1px solid; display: flex; flex-direction: column; gap: 5px; }
    .tile-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .tile-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
    .tile-value { display: flex; align-items: baseline; gap: 5px; }
    .num { font-size: 22px; font-weight: 700; line-height: 1; color: #12312f; font-feature-settings: 'tnum'; letter-spacing: -0.01em; }
    .unit { font-size: 11px; font-weight: 600; color: #7d9391; }
    .chip { align-self: flex-start; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  `,
})
export class WaterTestCard {
    private readonly settings = inject(SettingsStore);
    readonly test = input<WaterTest | undefined>();
    readonly totalTests = input(0);
    readonly viewHistory = output<void>();

    readonly tiles = computed<Tile[]>(() => {
        const hardnessUnit = this.settings.hardnessUnit();
        return WATER_PARAMS.map(p => {
            const v = this.test()?.[p.key];
            const status = statusOf(p.key, v);
            const c = STATUS_COLORS[status];
            return {
                key: p.key,
                label: p.label,
                unit: unitOf(p.key, hardnessUnit),
                display: v === undefined ? '—' : formatParamValue(p.key, v, hardnessUnit),
                statusLabel: STATUS_LABELS[status],
                dot: c.dot,
                bg: c.bg,
                border: c.border,
                chip: c.chip,
                labelColor: c.label,
            };
        });
    });

    readonly relative = computed(() => {
        const t = this.test();
        return t ? relativeFromToday(t.date) : '';
    });
}

function relativeFromToday(iso: string): string {
    const days = Math.round((Date.now() - Date.parse(iso + 'T00:00:00')) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
}
