import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WaterTest } from '../../domain/tank.model';
import { formatValueRange } from '../../domain/tank.logic';
import { statusOf, UNITS } from '../../domain/water-status';
import { WATER_PARAMS } from './water-params';
import { STATUS_COLORS, STATUS_LABELS } from '../ui/tokens';

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
        <span class="count">{{ measuredCount() }} of 6 parameters</span>
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

      @if (test()?.note) {
        <p class="note">“{{ test()!.note }}”</p>
      }
    </section>
  `,
    styles: `
    .card {
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      padding: 22px 24px; box-shadow: 0 1px 2px rgba(18,49,47,0.04);
    }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 18px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 22px; margin: 0; color: #0f2e2c; }
    .sub { margin: 3px 0 0; font-size: 13px; color: #5a7371; }
    .count { font-size: 12px; font-weight: 600; color: #7d9391; letter-spacing: 0.03em; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(146px, 1fr)); gap: 12px; }
    .tile { border-radius: 7px; padding: 14px 15px 13px; border: 1px solid; display: flex; flex-direction: column; gap: 9px; }
    .tile-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .tile-label { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
    .tile-value { display: flex; align-items: baseline; gap: 5px; }
    .num { font-size: 29px; font-weight: 700; line-height: 1; color: #12312f; font-feature-settings: 'tnum'; letter-spacing: -0.01em; }
    .unit { font-size: 13px; font-weight: 600; color: #7d9391; }
    .chip { align-self: flex-start; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .note {
      margin: 16px 0 0; padding-top: 14px; border-top: 1px solid #eef2f2;
      font-size: 14px; font-style: italic; color: #5a7371; font-family: 'Newsreader', serif;
    }
  `,
})
export class WaterTestCard {
    readonly test = input<WaterTest | undefined>();

    readonly tiles = computed<Tile[]>(() =>
        WATER_PARAMS.map(p => {
            const v = this.test()?.[p.key];
            const status = statusOf(p.key, v);
            const c = STATUS_COLORS[status];
            return {
                key: p.key,
                label: p.label,
                unit: UNITS[p.key],
                display: v === undefined ? '—' : formatValueRange(v),
                statusLabel: STATUS_LABELS[status],
                dot: c.dot,
                bg: c.bg,
                border: c.border,
                chip: c.chip,
                labelColor: c.label,
            };
        }),
    );

    readonly measuredCount = computed(() => {
        const t = this.test();
        if (!t) return 0;
        return WATER_PARAMS.filter(p => t[p.key] !== undefined).length;
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
