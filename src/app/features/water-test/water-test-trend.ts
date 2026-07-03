import { Component, computed, input, signal } from '@angular/core';
import { WaterParam, WaterTest } from '../../domain/tank.model';
import { seriesOf } from '../../domain/tank.logic';
import { WATER_PARAMS } from './water-params';

// 手写 SVG 趋势图:number 画点连线,ValueRange 画半透明上下界带 + 中点线
const W = 640;
const H = 260;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

interface ChartGeometry {
    linePoints: string;                          // polyline 的 points
    bandPath: string;                            // 区间带的 path d(没有区间时为空)
    dots: { x: number; y: number }[];
    xTicks: { x: number; label: string }[];
    yTicks: { y: number; label: string }[];
}

@Component({
    selector: 'water-test-trend',
    template: `
    <div class="toolbar">
      <label>
        Parameter
        <select [value]="param()" (change)="onParamChange($event)">
          @for (p of params; track p.key) {
            <option [value]="p.key">{{ p.label }}</option>
          }
        </select>
      </label>
    </div>

    @if (series().length < 2) {
      <p class="hint">Need at least 2 measurements of this parameter to draw a trend.</p>
    } @else {
      <svg [attr.viewBox]="viewBox" preserveAspectRatio="xMidYMid meet" role="img">
        <!-- 网格 + y 轴刻度 -->
        @for (tick of chart().yTicks; track tick.y) {
          <line [attr.x1]="padL" [attr.x2]="chartRight" [attr.y1]="tick.y" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="padL - 6" [attr.y]="tick.y" class="tick y-tick">{{ tick.label }}</text>
        }
        <!-- x 轴刻度 -->
        @for (tick of chart().xTicks; track tick.x) {
          <text [attr.x]="tick.x" [attr.y]="xLabelY" class="tick x-tick">{{ tick.label }}</text>
        }
        <!-- 区间带 -->
        @if (chart().bandPath) {
          <path [attr.d]="chart().bandPath" class="band" />
        }
        <!-- 中点折线 + 数据点 -->
        <polyline [attr.points]="chart().linePoints" class="line" />
        @for (dot of chart().dots; track $index) {
          <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3.5" class="dot" />
        }
      </svg>
    }
  `,
    styles: `
    :host { display: block; }
    .toolbar { margin-bottom: 0.5rem; }
    .hint { color: #666; }
    svg { width: 100%; height: auto; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .tick { font-size: 11px; fill: #666; }
    .y-tick { text-anchor: end; dominant-baseline: middle; }
    .x-tick { text-anchor: middle; }
    .band { fill: #4a90d9; opacity: 0.18; }
    .line { fill: none; stroke: #4a90d9; stroke-width: 2; }
    .dot { fill: #4a90d9; }
  `,
})
export class WaterTestTrend {
    readonly tests = input.required<WaterTest[]>();
    readonly param = signal<WaterParam>('pH');

    readonly params = WATER_PARAMS;
    readonly viewBox = `0 0 ${W} ${H}`;
    readonly padL = PAD.l;
    readonly chartRight = W - PAD.r;
    readonly xLabelY = H - PAD.b + 16;

    readonly series = computed(() => seriesOf(this.tests(), this.param()));
    readonly chart = computed<ChartGeometry>(() => this.buildGeometry());

    onParamChange(event: Event): void {
        this.param.set((event.target as HTMLSelectElement).value as WaterParam);
    }

    private buildGeometry(): ChartGeometry {
        const points = this.series();
        if (points.length < 2) {
            return { linePoints: '', bandPath: '', dots: [], xTicks: [], yTicks: [] };
        }

        const times = points.map(p => Date.parse(p.date));
        const tMin = Math.min(...times);
        const tMax = Math.max(...times);
        const tSpan = tMax - tMin || 1;

        let vMin = Math.min(...points.map(p => p.min));
        let vMax = Math.max(...points.map(p => p.max));
        const vPad = (vMax - vMin) * 0.1 || 1; // 全部同值时也留出空间
        vMin -= vPad;
        vMax += vPad;

        const x = (t: number) => PAD.l + ((t - tMin) / tSpan) * (W - PAD.l - PAD.r);
        const y = (v: number) => H - PAD.b - ((v - vMin) / (vMax - vMin)) * (H - PAD.t - PAD.b);

        const dots = points.map((p, i) => ({ x: x(times[i]), y: y(p.value) }));
        const linePoints = dots.map(d => `${d.x},${d.y}`).join(' ');

        // 区间带:沿 max 走一遍,再沿 min 倒着回来闭合
        const hasRange = points.some(p => p.min !== p.max);
        let bandPath = '';
        if (hasRange) {
            const upper = points.map((p, i) => `${x(times[i])},${y(p.max)}`);
            const lower = [...points].reverse().map(p => {
                const i = points.indexOf(p);
                return `${x(times[i])},${y(p.min)}`;
            });
            bandPath = `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
        }

        const yTicks = Array.from({ length: 5 }, (_, i) => {
            const v = vMin + ((vMax - vMin) * i) / 4;
            return { y: y(v), label: String(Number(v.toFixed(2))) };
        });

        // x 轴最多 5 个刻度,取等间隔的测量点,标签 MM-DD
        const step = Math.max(1, Math.ceil(points.length / 5));
        const xTicks = points
            .filter((_, i) => i % step === 0 || i === points.length - 1)
            .map((p, _, arr) => {
                const i = points.indexOf(p);
                return { x: x(times[i]), label: p.date.slice(5) };
            });

        return { linePoints, bandPath, dots, xTicks, yTicks };
    }
}
