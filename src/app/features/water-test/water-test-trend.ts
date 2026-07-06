import { Component, computed, inject, input, signal } from '@angular/core';
import { WaterParam, WaterTest } from '../../domain/tank.model';
import { seriesOf } from '../../domain/tank.logic';
import { statusOf, THRESHOLDS } from '../../domain/water-status';
import { formatParamValue, unitOf } from '../../domain/hardness';
import { WATER_PARAMS } from '../../domain/water-params';
import { STATUS_COLORS } from '../ui/tokens';
import { SettingsStore } from '../../state/settings.store';

// 手写 SVG 趋势图:最近 10 个点、按序号等距、每个点带日期+数值标签、可选安全带。
const W = 720;
const H = 300;
const PAD = { l: 46, r: 22, t: 52, b: 26 };

interface ChartPoint {
    cx: number;
    cy: number;
    color: string;
    valLabel: string;
    dateLabel: string;
    valY: number;
    dateY: number;
}

interface ChartGeometry {
    empty: boolean;
    points: ChartPoint[];
    linePoints: string;
    areaPath: string;
    gridY: number[];
    safeZone: { show: boolean; y: number; yBot: number; h: number } | null;
}

@Component({
    selector: 'water-test-trend',
    template: `
    <section class="card">
      <div class="head">
        <div>
          <h2>Trend</h2>
          <p class="sub">{{ paramLabel() }} · last {{ chart().points.length }} tests</p>
        </div>
        <div class="legend"><span class="swatch"></span> safe zone</div>
      </div>

      <div class="tabs">
        @for (p of params; track p.key) {
          <button
            type="button"
            [class.active]="p.key === param()"
            (click)="param.set(p.key)"
          >{{ p.label }}</button>
        }
      </div>

      @if (chart().empty) {
        <p class="empty">No readings for this parameter yet.</p>
      } @else {
        <svg [attr.viewBox]="viewBox" preserveAspectRatio="xMidYMid meet" role="img">
          @for (gy of chart().gridY; track $index) {
            <line [attr.x1]="padL" [attr.x2]="chartRight" [attr.y1]="gy" [attr.y2]="gy" class="grid" />
          }
          @if (chart().safeZone; as sz) {
            <rect [attr.x]="padL" [attr.y]="sz.y" [attr.width]="bandW" [attr.height]="sz.h" class="safe-fill" />
            <line [attr.x1]="padL" [attr.x2]="chartRight" [attr.y1]="sz.y" [attr.y2]="sz.y" class="safe-edge" />
            <line [attr.x1]="padL" [attr.x2]="chartRight" [attr.y1]="sz.yBot" [attr.y2]="sz.yBot" class="safe-edge" />
          }
          @if (showArea()) {
            <path [attr.d]="chart().areaPath" class="area" />
          }
          <polyline [attr.points]="chart().linePoints" class="line" />
          @for (pt of chart().points; track $index) {
            <text [attr.x]="pt.cx" [attr.y]="pt.dateY" class="lbl-date">{{ pt.dateLabel }}</text>
            <text [attr.x]="pt.cx" [attr.y]="pt.valY" class="lbl-val" [attr.fill]="pt.color">{{ pt.valLabel }}</text>
            <circle [attr.cx]="pt.cx" [attr.cy]="pt.cy" r="4.5" class="dot" [attr.stroke]="pt.color" />
          }
        </svg>
      }
    </section>
  `,
    styles: `
    .card {
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      padding: 22px 24px 18px; box-shadow: 0 1px 2px rgba(18,49,47,0.04);
    }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 22px; margin: 0; color: #0f2e2c; }
    .sub { margin: 3px 0 0; font-size: 13px; color: #5a7371; }
    .legend { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #5a7371; }
    .swatch { width: 20px; height: 10px; border-radius: 3px; background: rgba(47,158,109,0.16); border: 1px solid rgba(47,158,109,0.4); }
    .tabs { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 8px; }
    .tabs button {
      appearance: none; border: 1px solid #d3e0e0; background: #fff; color: #3c5a5c;
      padding: 7px 14px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
    }
    .tabs button.active { background: #0f8a8d; border-color: #0f8a8d; color: #fff; }
    .empty { text-align: center; color: #9aacaa; font-size: 14px; padding: 30px 0; }
    svg { width: 100%; height: auto; display: block; overflow: visible; }
    .grid { stroke: #eef2f2; stroke-width: 1; }
    .safe-fill { fill: rgba(47,158,109,0.09); }
    .safe-edge { stroke: rgba(47,158,109,0.3); stroke-width: 1; stroke-dasharray: 3 3; }
    .area { fill: rgba(15,138,141,0.12); }
    .line { fill: none; stroke: #0f8a8d; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .dot { fill: #fff; stroke-width: 2.5; }
    .lbl-date { text-anchor: middle; font-size: 10px; fill: #9aacaa; }
    .lbl-val { text-anchor: middle; font-size: 12px; font-weight: 700; }
  `,
})
export class WaterTestTrend {
    private readonly settings = inject(SettingsStore);
    readonly tests = input.required<WaterTest[]>();
    readonly chartStyle = input<'area' | 'line'>('area');
    readonly param = signal<WaterParam>('nitrate');

    readonly params = WATER_PARAMS;
    readonly viewBox = `0 0 ${W} ${H}`;
    readonly padL = PAD.l;
    readonly chartRight = W - PAD.r;
    readonly bandW = W - PAD.l - PAD.r;

    readonly showArea = computed(() => this.chartStyle() === 'area');
    readonly paramLabel = computed(() => {
        const key = this.param();
        const label = WATER_PARAMS.find(p => p.key === key)?.label ?? key;
        const unit = unitOf(key, this.settings.hardnessUnit());
        return unit ? `${label} (${unit})` : label;
    });

    readonly chart = computed<ChartGeometry>(() => this.buildGeometry());

    private buildGeometry(): ChartGeometry {
        const param = this.param();
        // 几何坐标一律按存储单位(度)算——ppm 换算是线性的,位置不变;只有标签文字换算
        const hardnessUnit = this.settings.hardnessUnit();
        const empty: ChartGeometry = { empty: true, points: [], linePoints: '', areaPath: '', gridY: [], safeZone: null };
        const pts = seriesOf(this.tests(), param).slice(-10);
        if (pts.length < 1) return empty;
        const n = pts.length;
        const th = THRESHOLDS[param];

        let vMin = Math.min(...pts.map(p => p.min));
        let vMax = Math.max(...pts.map(p => p.max));
        if (th) {
            vMin = Math.min(vMin, th.safe[0]);
            vMax = Math.max(vMax, th.safe[1]);
        }
        const pad = (vMax - vMin) * 0.16 || 1;
        vMin -= pad;
        vMax += pad;
        if (vMin < 0 && pts.every(p => p.min >= 0)) vMin = 0;
        const vSpan = vMax - vMin || 1;

        const x = (i: number) => (n === 1 ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r));
        const y = (v: number) => H - PAD.b - ((v - vMin) / vSpan) * (H - PAD.t - PAD.b);
        const midY = PAD.t + (H - PAD.t - PAD.b) * 0.3;

        const points: ChartPoint[] = pts.map((p, i) => {
            const cx = +x(i).toFixed(1);
            const cy = +y(p.value).toFixed(1);
            const above = cy > midY;
            const raw = p.min === p.max ? p.value : { min: p.min, max: p.max };
            return {
                cx,
                cy,
                color: STATUS_COLORS[statusOf(param, p.value)].dot,
                valLabel: formatParamValue(param, raw, hardnessUnit),
                dateLabel: p.date.slice(5), // MM-DD
                valY: +(above ? cy - 12 : cy + 27).toFixed(1),
                dateY: +(above ? cy - 26 : cy + 15).toFixed(1),
            };
        });

        const linePoints = points.map(p => `${p.cx},${p.cy}`).join(' ');
        const areaPath =
            `M ${points[0].cx},${H - PAD.b} L ` +
            points.map(p => `${p.cx},${p.cy}`).join(' L ') +
            ` L ${points[n - 1].cx},${H - PAD.b} Z`;

        let safeZone: ChartGeometry['safeZone'] = null;
        if (th) {
            const sTop = Math.min(th.safe[1], vMax);
            const sBot = Math.max(th.safe[0], vMin);
            if (sTop > sBot) {
                const yT = +y(sTop).toFixed(1);
                const yB = +y(sBot).toFixed(1);
                safeZone = { show: true, y: yT, yBot: yB, h: +(yB - yT).toFixed(1) };
            }
        }

        const gridY = Array.from({ length: 5 }, (_, i) => +y(vMin + (vSpan * i) / 4).toFixed(1));

        return { empty: false, points, linePoints, areaPath, gridY, safeZone };
    }
}
