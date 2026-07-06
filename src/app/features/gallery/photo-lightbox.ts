import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Photo, Tank } from '../../domain/tank.model';
import {
    activityLog,
    daysBetween,
    nearestTestAtOrBefore,
    photoType,
} from '../../domain/tank.logic';
import { statusOf } from '../../domain/water-status';
import { formatParamValue, unitOf } from '../../domain/hardness';
import { WATER_PARAMS } from '../../domain/water-params';
import { CATEGORY_COLORS, hexToRgba, PHOTO_TYPES, STATUS_COLORS } from '../ui/tokens';
import { SettingsStore } from '../../state/settings.store';

interface MiniTile {
    key: string;
    label: string;
    unit: string;
    display: string;
    bg: string;
    border: string;
    labelColor: string;
}

interface ActivityRow {
    key: string;
    title: string;
    detail?: string;
    color: string;
    ring: string;
}

// Lightbox v2:左边大图(徽章 + i/n + 前后翻页),右边上下文面板 ——
// 日期/Day N、caption、当天(或最近一次)水质 mini-tiles、当天的活动条目。
// 吃「有序照片列表 + 起始下标」,翻页只在这个列表里走:Gallery 的筛选、
// 胶片条、活动流缩略图都复用这一个组件。
@Component({
    selector: 'photo-lightbox',
    imports: [DatePipe],
    host: { '(document:keydown)': 'onKey($event)' },
    template: `
    <div class="overlay" (click)="close.emit()">
      <div class="card" (click)="$event.stopPropagation()">
        <div class="stage">
          <img [src]="photo().src" [alt]="photo().caption || 'Tank photo'" />
          <span class="badge" [style.background]="typeInfo().color">{{ typeInfo().full }}</span>
          <span class="pos">{{ idx() + 1 }} / {{ photos().length }}</span>
          @if (hasPrev()) {
            <button class="nav prev" aria-label="Previous photo" (click)="step(-1)">‹</button>
          }
          @if (hasNext()) {
            <button class="nav next" aria-label="Next photo" (click)="step(1)">›</button>
          }
        </div>

        <aside class="panel">
          <div class="panel-head">
            <div>
              <div class="date">{{ photo().date | date: 'MMM d, y' }}</div>
              <div class="day">Day {{ dayNumber() }} · {{ relative() }}</div>
            </div>
            <button class="x" aria-label="Close" (click)="close.emit()">✕</button>
          </div>

          @if (photo().caption) {
            <p class="caption">{{ photo().caption }}</p>
          }

          @if (waterTest(); as test) {
            <div>
              <div class="sec-head">
                <span class="sec-label">Water that day</span>
                @if (test.date !== photo().date) {
                  <span class="sec-hint">nearest · {{ test.date | date: 'MMM d, y' }}</span>
                }
              </div>
              <div class="tiles">
                @for (tile of tiles(); track tile.key) {
                  <div class="tile" [style.background]="tile.bg" [style.border-color]="tile.border">
                    <span class="tile-label" [style.color]="tile.labelColor">{{ tile.label }}</span>
                    <div class="tile-value">
                      <span class="num">{{ tile.display }}</span>
                      @if (tile.unit) { <span class="unit">{{ tile.unit }}</span> }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (activity().length) {
            <div>
              <div class="sec-label sec-mb">On this day</div>
              <div class="events">
                @for (ev of activity(); track ev.key) {
                  <div class="ev">
                    <span class="dot" [style.background]="ev.color" [style.box-shadow]="'0 0 0 3px ' + ev.ring"></span>
                    <div>
                      <div class="ev-title">{{ ev.title }}</div>
                      @if (ev.detail) { <div class="ev-detail">{{ ev.detail }}</div> }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
    styles: `
    @keyframes lb-backdrop { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lb-pop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
    .overlay {
      position: fixed; inset: 0; z-index: 82; background: rgba(8,26,25,0.68); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 24px;
      animation: lb-backdrop 0.16s ease;
    }
    .card {
      width: 100%; max-width: 1080px; max-height: calc(100vh - 48px);
      display: flex; flex-wrap: wrap; background: #fff; border-radius: 14px; overflow: hidden;
      box-shadow: 0 30px 80px rgba(8,26,25,0.5); animation: lb-pop 0.22s cubic-bezier(0.2,0.8,0.3,1);
    }
    .stage {
      flex: 1 1 460px; min-width: min(100%, 460px); position: relative; background: #0f2e2c;
      overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 320px;
    }
    .stage img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badge {
      position: absolute; top: 14px; left: 14px; padding: 5px 11px; border-radius: 999px;
      color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .pos {
      position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); padding: 4px 12px;
      border-radius: 999px; background: rgba(8,26,25,0.55); color: #fff; font-size: 12px; font-weight: 600;
      backdrop-filter: blur(4px);
    }
    .nav {
      position: absolute; top: 50%; transform: translateY(-50%); width: 42px; height: 42px;
      border-radius: 50%; border: none; background: rgba(255,255,255,0.9); color: #0f2e2c;
      font-size: 22px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    }
    .nav:hover { background: #fff; }
    .nav.prev { left: 12px; }
    .nav.next { right: 12px; }

    .panel {
      flex: 1 1 340px; min-width: min(100%, 320px); max-width: 420px; padding: 22px 24px;
      overflow: auto; display: flex; flex-direction: column; gap: 18px;
    }
    .panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .date { font-family: 'Newsreader', serif; font-weight: 500; font-size: 22px; color: #0f2e2c; line-height: 1.1; }
    .day { margin-top: 3px; font-size: 12.5px; color: #8aa19f; font-weight: 600; }
    .x {
      appearance: none; border: 1px solid #dcecec; background: #f7fafa; width: 32px; height: 32px;
      border-radius: 8px; font-size: 15px; color: #5a7371; cursor: pointer; line-height: 1; flex: 0 0 auto;
    }
    .x:hover { background: #eef2f2; }
    .caption { margin: 0; font-size: 15px; line-height: 1.5; color: #2c4f4d; }

    .sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 9px; }
    .sec-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8aa19f; }
    .sec-hint { font-size: 11px; color: #a3b6b4; white-space: nowrap; }
    .sec-mb { display: block; margin-bottom: 10px; }
    .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
    .tile { border-radius: 7px; padding: 8px 9px; border: 1px solid; display: flex; flex-direction: column; gap: 3px; }
    .tile-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .tile-value { display: flex; align-items: baseline; gap: 3px; }
    .num { font-size: 16px; font-weight: 700; line-height: 1; color: #12312f; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
    .unit { font-size: 9.5px; font-weight: 600; color: #7d9391; }

    .events { display: flex; flex-direction: column; gap: 11px; }
    .ev { display: grid; grid-template-columns: 13px 1fr; gap: 11px; align-items: start; }
    .dot { width: 11px; height: 11px; border-radius: 50%; margin-top: 3px; }
    .ev-title { font-size: 13.5px; font-weight: 600; color: #12312f; line-height: 1.3; }
    .ev-detail { font-size: 12px; color: #7d9391; margin-top: 2px; line-height: 1.35; }
  `,
})
export class PhotoLightbox {
    private readonly settings = inject(SettingsStore);
    /** 有序照片列表(通常最新在前)——翻页范围就是它,调用方决定筛选口径 */
    readonly photos = input.required<Photo[]>();
    /** 起始下标(点开的那张在列表里的位置) */
    readonly index = input(0);
    readonly tank = input.required<Tank>();
    readonly close = output<void>();

    /** 当前下标:跟随 index 输入重置,翻页时本地改 */
    readonly idx = linkedSignal(() => this.index());

    readonly photo = computed<Photo>(() => this.photos()[this.idx()]);
    readonly typeInfo = computed(() => PHOTO_TYPES[photoType(this.photo())]);
    readonly hasPrev = computed(() => this.idx() > 0);
    readonly hasNext = computed(() => this.idx() < this.photos().length - 1);

    readonly dayNumber = computed(() => Math.max(0, daysBetween(this.tank().startDate, this.photo().date)));
    readonly relative = computed(() => relativeFromToday(this.photo().date));

    /** 照片日期当天或之前最近的一次水质测试 —— 日期连接的核心 */
    readonly waterTest = computed(() => nearestTestAtOrBefore(this.tank().waterTests ?? [], this.photo().date));

    readonly tiles = computed<MiniTile[]>(() => {
        const test = this.waterTest();
        const hardnessUnit = this.settings.hardnessUnit();
        return WATER_PARAMS.map(p => {
            const v = test?.[p.key];
            const c = STATUS_COLORS[statusOf(p.key, v)];
            return {
                key: p.key,
                label: p.label,
                unit: unitOf(p.key, hardnessUnit),
                display: v === undefined ? '—' : formatParamValue(p.key, v, hardnessUnit),
                bg: c.bg,
                border: c.border,
                labelColor: c.label,
            };
        });
    });

    /** 当天的活动条目;排除照片自己派生的那条 "Photo added" */
    readonly activity = computed<ActivityRow[]>(() => {
        const photo = this.photo();
        return activityLog(this.tank(), Infinity)
            .filter(e => e.date === photo.date && e.key !== `photo:${photo.id}`)
            .map(e => {
                const color = e.color ?? CATEGORY_COLORS[e.category];
                return { key: e.key, title: e.title, detail: e.detail, color, ring: hexToRgba(color, 0.16) };
            });
    });

    step(delta: number): void {
        const next = this.idx() + delta;
        if (next >= 0 && next < this.photos().length) this.idx.set(next);
    }

    onKey(e: KeyboardEvent): void {
        if (e.key === 'ArrowLeft') this.step(-1);
        else if (e.key === 'ArrowRight') this.step(1);
        else if (e.key === 'Escape') this.close.emit();
    }
}

function relativeFromToday(iso: string): string {
    const days = Math.round((Date.now() - Date.parse(iso + 'T00:00:00')) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
}
