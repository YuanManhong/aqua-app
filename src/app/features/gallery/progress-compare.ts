import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Photo, Tank } from '../../domain/tank.model';
import { daysBetween, ftsPhotosAsc } from '../../domain/tank.logic';

// 进程对比:两张全缸照(FTS),拖分割线擦出前后变化,或并排看。
// 默认 A = 最早、B = 最新;BEFORE/AFTER 两行缩略图随便换。
// 只有 ≥2 张 FTS 时入口才可见(tank-gallery / gallery-dialog 负责隐藏)。
@Component({
    selector: 'progress-compare',
    imports: [DatePipe],
    host: { '(document:keydown.escape)': 'close.emit()' },
    template: `
    <div class="overlay" (click)="close.emit()">
      <div class="card" (click)="$event.stopPropagation()">
        <div class="hh">
          <div>
            <h2>Progress compare</h2>
            <p class="sub">Drag the divider — watch it grow in.</p>
          </div>
          <div class="hh-actions">
            <div class="seg">
              <button type="button" [class.on]="mode() === 'slider'" (click)="mode.set('slider')">Slider</button>
              <button type="button" [class.on]="mode() === 'side'" (click)="mode.set('side')">Side by side</button>
            </div>
            <button class="x" aria-label="Close" (click)="close.emit()">✕</button>
          </div>
        </div>

        <div class="viewer">
          @if (mode() === 'slider') {
            <div class="stage"
                 (pointerdown)="onDown($event)"
                 (pointermove)="onMove($event)"
                 (pointerup)="onUp($event)"
                 (pointercancel)="onUp($event)">
              <img class="after" [src]="b().src" alt="after" />
              <div class="before-clip" [style.clip-path]="'inset(0 ' + (100 - pos()) + '% 0 0)'">
                <img [src]="a().src" alt="before" />
              </div>
              <div class="pill tl">Day {{ day(a()) }} · {{ a().date | date: 'MMM d, y' }}</div>
              <div class="pill tr">Day {{ day(b()) }} · {{ b().date | date: 'MMM d, y' }}</div>
              <div class="divider" [style.left.%]="pos()">
                <div class="knob">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 7l-5 5 5 5" /><path d="M15 7l5 5-5 5" />
                  </svg>
                </div>
              </div>
            </div>
          } @else {
            <div class="side">
              <div>
                <div class="fig">
                  <img [src]="a().src" alt="before" />
                  <div class="pill tl">Day {{ day(a()) }}</div>
                </div>
                <div class="fig-date">{{ a().date | date: 'MMM d, y' }}</div>
                @if (a().caption) { <div class="fig-cap">{{ a().caption }}</div> }
              </div>
              <div>
                <div class="fig">
                  <img [src]="b().src" alt="after" />
                  <div class="pill tl">Day {{ day(b()) }}</div>
                </div>
                <div class="fig-date">{{ b().date | date: 'MMM d, y' }}</div>
                @if (b().caption) { <div class="fig-cap">{{ b().caption }}</div> }
              </div>
            </div>
          }
        </div>

        <div class="picker">
          <div class="row">
            <span class="row-lbl">Before</span>
            <div class="thumbs">
              @for (photo of fts(); track photo.id) {
                <button class="thumb" type="button" [class.sel]="photo.id === a().id" (click)="aId.set(photo.id)">
                  <img [src]="photo.src" alt="" />
                  <span class="thumb-date">{{ photo.date | date: 'MMM d' }}</span>
                </button>
              }
            </div>
          </div>
          <div class="row">
            <span class="row-lbl">After</span>
            <div class="thumbs">
              @for (photo of fts(); track photo.id) {
                <button class="thumb" type="button" [class.sel]="photo.id === b().id" (click)="bId.set(photo.id)">
                  <img [src]="photo.src" alt="" />
                  <span class="thumb-date">{{ photo.date | date: 'MMM d' }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: `
    @keyframes pc-backdrop { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pc-pop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
    /* ⚠ align-items:flex-start —— 居中的 flex overlay 在内容超高时会把头部裁到屏幕外拿不回来 */
    .overlay {
      position: fixed; inset: 0; z-index: 70; background: rgba(8,26,25,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: flex-start; justify-content: center; padding: 24px 20px;
      animation: pc-backdrop 0.16s ease; overflow: auto;
    }
    .card {
      width: 100%; max-width: 940px; background: #fff; border-radius: 14px; overflow: hidden;
      box-shadow: 0 30px 80px rgba(8,26,25,0.45); animation: pc-pop 0.22s cubic-bezier(0.2,0.8,0.3,1);
    }

    .hh { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 20px 24px 14px; border-bottom: 1px solid #eef2f2; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 24px; margin: 0; color: #0f2e2c; }
    .sub { margin: 4px 0 0; font-size: 13px; color: #7d9391; }
    .hh-actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
    .seg { display: inline-flex; background: #eef2f2; border-radius: 9px; padding: 3px; }
    .seg button {
      appearance: none; border: none; background: transparent; color: #6d8785; font: inherit;
      font-weight: 600; font-size: 13px; padding: 7px 15px; border-radius: 7px; cursor: pointer;
    }
    .seg button.on { background: #fff; color: #0f8a8d; font-weight: 700; box-shadow: 0 1px 2px rgba(18,49,47,0.12); }
    .x { appearance: none; border: 1px solid #dcecec; background: #f7fafa; width: 34px; height: 34px; border-radius: 8px; font-size: 16px; color: #5a7371; cursor: pointer; line-height: 1; }
    .x:hover { background: #eef2f2; }

    .viewer { padding: 20px 24px 8px; }
    .stage {
      position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 56vh; border-radius: 12px;
      overflow: hidden; background: #0f2e2c; cursor: ew-resize; touch-action: none; user-select: none;
    }
    .stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .before-clip { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
    .pill {
      position: absolute; top: 10px; padding: 4px 10px; border-radius: 999px; background: rgba(8,26,25,0.55);
      color: #fff; font-size: 11px; font-weight: 700; backdrop-filter: blur(3px); pointer-events: none;
    }
    .pill.tl { left: 12px; }
    .pill.tr { right: 12px; }
    .divider {
      position: absolute; top: 0; bottom: 0; width: 2px; background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.18); transform: translateX(-1px); pointer-events: none;
    }
    .knob {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px;
      border-radius: 50%; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center; color: #0f2e2c;
    }

    .side { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fig { position: relative; width: 100%; aspect-ratio: 4 / 5; max-height: 52vh; border-radius: 12px; overflow: hidden; background: #0f2e2c; }
    .fig img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .fig .pill { top: 10px; }
    .fig-date { margin-top: 8px; font-size: 13px; font-weight: 700; color: #12312f; }
    .fig-cap { font-size: 12px; color: #7d9391; line-height: 1.35; }

    .picker { padding: 6px 24px 22px; }
    .row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .row-lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0f8a8d; min-width: 52px; }
    .thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .thumb {
      position: relative; width: 92px; height: 60px; border-radius: 8px; overflow: hidden; cursor: pointer;
      flex: 0 0 auto; padding: 0; border: 2px solid transparent; background: #dfeceb;
      box-shadow: inset 0 0 0 1px #e4ecec;
    }
    .thumb.sel { border-color: #0f8a8d; box-shadow: 0 0 0 2px rgba(15,138,141,0.22); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb-date {
      position: absolute; bottom: 2px; left: 0; right: 0; text-align: center; font-size: 9px;
      font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.7);
    }
  `,
})
export class ProgressCompare {
    readonly tank = input.required<Tank>();
    readonly close = output<void>();

    /** FTS 照片升序 —— 对比素材;默认 A = 第一张、B = 最后一张 */
    readonly fts = computed<Photo[]>(() => ftsPhotosAsc(this.tank()));

    readonly aId = signal<string | null>(null);
    readonly bId = signal<string | null>(null);
    readonly mode = signal<'slider' | 'side'>('slider');
    /** 分割线位置(%),每次打开从 50 开始 */
    readonly pos = signal(50);

    readonly a = computed<Photo>(() => this.fts().find(p => p.id === this.aId()) ?? this.fts()[0]);
    readonly b = computed<Photo>(() => this.fts().find(p => p.id === this.bId()) ?? this.fts().at(-1)!);

    private dragging = false;

    day(photo: Photo): number {
        return Math.max(0, daysBetween(this.tank().startDate, photo.date));
    }

    // pointerdown 直接把分割线跳到按下点,再捕获指针跟手拖动(触屏同样生效)
    onDown(e: PointerEvent): void {
        this.dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.track(e);
    }
    onMove(e: PointerEvent): void {
        if (this.dragging) this.track(e);
    }
    onUp(e: PointerEvent): void {
        this.dragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    private track(e: PointerEvent): void {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (!rect.width) return;
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        this.pos.set(Math.min(99, Math.max(1, pct)));
    }
}
