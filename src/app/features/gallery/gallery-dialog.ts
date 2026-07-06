import { Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Photo, PhotoType, Tank } from '../../domain/tank.model';
import { ftsPhotosAsc, photosByMonth, photoType, sortPhotosDesc } from '../../domain/tank.logic';
import { PHOTO_TYPES } from '../ui/tokens';

/** Compare 需要 ≥2 张全缸照;按还差几张给悬停提示(胶片条和本弹窗共用) */
export function compareHintText(ftsCount: number): string {
    const missing = 2 - ftsCount;
    return `Needs 2 full-tank shots (FTS) to compare — add ${missing} more. Pick “Full-tank shot (FTS)” as the type when adding a photo.`;
}

interface FilterChip {
    key: 'all' | PhotoType;
    label: string;
    count: number;
}

interface MonthGroup {
    key: string;
    /** 该月 1 号的 ISO,喂给 DatePipe 输出 "June 2026" */
    monthDate: string;
    photos: Photo[];
}

// 全量照片弹窗:按月分组的网格(最新月在前),All/FTS/Livestock/Problem 筛选。
// 点照片 → 发出「筛选后的列表 + 下标」,lightbox 的翻页范围跟着当前筛选走。
// Compare / Add 也从这里透传给 tank-gallery(它统一持有各层弹窗的开关)。
@Component({
    selector: 'gallery-dialog',
    imports: [DatePipe],
    template: `
    <div class="overlay" (click)="close.emit()">
      <div class="card" (click)="$event.stopPropagation()">
        <div class="hh">
          <div>
            <h2>Gallery</h2>
            <p class="sub">{{ tank().name }} · {{ photos().length }} photos, grouped by month</p>
          </div>
          <div class="hh-actions">
            <button class="btn-compare" type="button"
                    [disabled]="!compareAvailable()"
                    [title]="compareHint()"
                    (click)="openCompare.emit()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v18" /><path d="M5 8l-3 4 3 4" /><path d="M19 8l3 4-3 4" />
              </svg>
              Compare
            </button>
            <button class="btn-add" type="button" (click)="add.emit()"><span class="plus">＋</span> Add</button>
            <button class="x" aria-label="Close" (click)="close.emit()">✕</button>
          </div>
        </div>

        <div class="filter-bar">
          <span class="filter-lbl">Filter</span>
          @for (chip of chips(); track chip.key) {
            <button class="chip" type="button" [class.on]="filter() === chip.key" (click)="filter.set(chip.key)">
              {{ chip.label }} <span class="chip-count">{{ chip.count }}</span>
            </button>
          }
        </div>

        <div class="body">
          @if (groups().length === 0) {
            <div class="empty">No photos in this filter yet.</div>
          }
          @for (group of groups(); track group.key) {
            <div class="month">
              <div class="month-head">
                <h3>{{ group.monthDate | date: 'MMMM y' }}</h3>
                <span class="month-count">{{ group.photos.length }}</span>
              </div>
              <div class="grid">
                @for (photo of group.photos; track photo.id) {
                  <button class="tile" type="button" (click)="pick(photo)">
                    <div class="thumb">
                      <img [src]="photo.src" [alt]="photo.caption || 'Tank photo'" />
                      <span class="badge" [style.background]="badge(photo).color">{{ badge(photo).label }}</span>
                    </div>
                    <div class="date">{{ photo.date | date: 'MMM d' }}</div>
                    @if (photo.caption) { <div class="cap">{{ photo.caption }}</div> }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
    styles: `
    @keyframes gd-backdrop { from { opacity: 0; } to { opacity: 1; } }
    @keyframes gd-pop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
    .overlay {
      position: fixed; inset: 0; z-index: 62; background: rgba(12,38,36,0.42); backdrop-filter: blur(3px);
      display: flex; align-items: flex-start; justify-content: center; padding: 28px 20px;
      animation: gd-backdrop 0.16s ease; overflow: auto;
    }
    .card {
      width: 100%; max-width: 1120px; max-height: calc(100vh - 56px);
      display: flex; flex-direction: column; background: #fff; border-radius: 14px; overflow: hidden;
      box-shadow: 0 30px 80px rgba(12,38,36,0.3); animation: gd-pop 0.22s cubic-bezier(0.2,0.8,0.3,1);
    }

    .hh { flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 26px 16px; border-bottom: 1px solid #eef2f2; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 26px; margin: 0; color: #0f2e2c; }
    .sub { margin: 4px 0 0; font-size: 13px; color: #7d9391; }
    .hh-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
    .btn-compare {
      appearance: none; border: 1px solid #d3e0e0; background: #fff; color: #2c6e6b; font: inherit;
      font-weight: 700; font-size: 13px; padding: 9px 14px; border-radius: 8px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
    }
    .btn-compare:hover:enabled { background: #f2fafa; border-color: #0f8a8d; color: #0f8a8d; }
    .btn-compare:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-add {
      appearance: none; border: none; background: #0f8a8d; color: #fff; font: inherit; font-weight: 700;
      font-size: 13px; padding: 9px 15px; border-radius: 8px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(15,138,141,0.28);
    }
    .btn-add:hover { filter: brightness(1.06); }
    .plus { font-size: 16px; line-height: 1; }
    .x { appearance: none; border: 1px solid #dcecec; background: #f7fafa; width: 34px; height: 34px; border-radius: 8px; font-size: 16px; color: #5a7371; cursor: pointer; line-height: 1; flex: 0 0 auto; }
    .x:hover { background: #eef2f2; }

    .filter-bar { flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 13px 26px; border-bottom: 1px solid #eef2f2; background: #f7fafa; }
    .filter-lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8aa19f; margin-right: 2px; }
    .chip {
      appearance: none; border: 1px solid #d3e0e0; background: #fff; color: #3c5a5c; padding: 7px 14px;
      border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 7px;
    }
    .chip-count { font-size: 11px; font-weight: 700; color: #9aacaa; }
    .chip.on { background: #0f8a8d; border-color: #0f8a8d; color: #fff; }
    .chip.on .chip-count { color: rgba(255,255,255,0.72); }

    .body { flex: 1 1 auto; overflow: auto; padding: 4px 26px 28px; }
    .empty { padding: 60px 26px; text-align: center; color: #8aa19f; font-size: 15px; }
    .month { margin-top: 22px; }
    .month-head { display: flex; align-items: baseline; gap: 10px; position: sticky; top: 0; background: #fff; padding: 6px 0 10px; z-index: 1; }
    h3 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 19px; margin: 0; color: #0f2e2c; }
    .month-count { font-size: 12px; font-weight: 700; color: #a3b6b4; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 16px; }

    .tile { appearance: none; border: none; background: none; padding: 0; cursor: pointer; text-align: left; font: inherit; }
    .thumb {
      position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 10px; overflow: hidden;
      background: #dfeceb; box-shadow: inset 0 0 0 1px #e4ecec;
    }
    .tile:hover .thumb { box-shadow: inset 0 0 0 1px #cddddb, 0 8px 20px rgba(18,49,47,0.14); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badge {
      position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 999px; color: #fff;
      font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .date { margin-top: 9px; font-size: 13px; font-weight: 700; color: #12312f; }
    .cap {
      font-size: 12px; color: #7d9391; line-height: 1.35; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
  `,
})
export class GalleryDialog {
    readonly tank = input.required<Tank>();
    readonly close = output<void>();
    readonly openCompare = output<void>();
    readonly add = output<void>();
    /** 列表 = 当前筛选(倒序),lightbox 的翻页范围就是它 */
    readonly openPhoto = output<{ list: Photo[]; index: number }>();

    readonly filter = signal<'all' | PhotoType>('all');

    readonly photos = computed(() => this.tank().photos ?? []);
    readonly ftsCount = computed(() => ftsPhotosAsc(this.tank()).length);
    readonly compareAvailable = computed(() => this.ftsCount() >= 2);
    readonly compareHint = computed(() => (this.compareAvailable() ? '' : compareHintText(this.ftsCount())));

    readonly chips = computed<FilterChip[]>(() => {
        const photos = this.photos();
        const count = (t: PhotoType) => photos.filter(p => photoType(p) === t).length;
        return [
            { key: 'all', label: 'All', count: photos.length },
            { key: 'fts', label: 'FTS', count: count('fts') },
            { key: 'livestock', label: 'Livestock', count: count('livestock') },
            { key: 'problem', label: 'Problem', count: count('problem') },
        ];
    });

    readonly filtered = computed<Photo[]>(() => {
        const f = this.filter();
        const photos = sortPhotosDesc(this.photos());
        return f === 'all' ? photos : photos.filter(p => photoType(p) === f);
    });

    readonly groups = computed<MonthGroup[]>(() =>
        photosByMonth(this.filtered()).map(g => ({ ...g, monthDate: `${g.key}-01` })),
    );

    badge(photo: Photo) {
        return PHOTO_TYPES[photoType(photo)];
    }

    pick(photo: Photo): void {
        const list = this.filtered();
        this.openPhoto.emit({ list, index: list.findIndex(p => p.id === photo.id) });
    }
}
