import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, formatDate } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Photo, PhotoType, Tank, newId, todayISO } from '../../domain/tank.model';
import { activityLog, ftsPhotosAsc, photoType, sortPhotosDesc } from '../../domain/tank.logic';
import { TankStore } from '../../state/tank.store';
import { PHOTO_TYPES } from '../ui/tokens';
import { Modal } from '../ui/modal';
import { PhotoLightbox } from './photo-lightbox';
import { compareHintText, GalleryDialog } from './gallery-dialog';
import { ProgressCompare } from './progress-compare';

interface GalleryItem extends Photo {
    linkLabel?: string; // 关联事件的标题(如 "Water test logged"),失效时不显示
}

interface LinkOption {
    value: string; // ActivityEvent.key
    label: string;
}

const TYPE_OPTIONS: { value: PhotoType; label: string }[] = [
    { value: 'other', label: 'Other' },
    { value: 'fts', label: 'Full-tank shot (FTS)' },
    { value: 'livestock', label: 'Livestock' },
    { value: 'problem', label: 'Problem / diagnostic' },
];

// Gallery 胶片条:只放最新 4 张,作为三个入口 —— 全量弹窗(按月分组)、
// 进程对比(FTS 前后擦拭)、lightbox v2(带当天水质/活动的上下文面板)。
// 选完文件不直接入库,先弹小窗补齐日期/类型/caption/可选关联再保存。
// 图片在客户端缩到 ≤1280px JPEG 再存 data URL,避免撑爆 localStorage 配额和 Supabase 行。
// 层级:gallery-dialog(62) < progress-compare(70) < photo-lightbox(82),
// 上层弹窗盖在 gallery 弹窗之上,关掉回到它;开关状态都收在这个组件里。
@Component({
    selector: 'tank-gallery',
    imports: [DatePipe, ReactiveFormsModule, Modal, PhotoLightbox, GalleryDialog, ProgressCompare],
    template: `
    <section class="card">
      <div class="head">
        <div>
          <h2>Gallery</h2>
          <p class="sub">Your tank over time · newest first</p>
        </div>
        <div class="head-actions">
          <button class="btn-compare" type="button"
                  [disabled]="!compareAvailable()"
                  [title]="compareHint()"
                  (click)="compareOpen.set(true)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18" /><path d="M5 8l-3 4 3 4" /><path d="M19 8l3 4-3 4" />
            </svg>
            Compare progress
          </button>
          @if (items().length > 0) {
            <button class="view-all" type="button" (click)="galleryOpen.set(true)">View all <span aria-hidden="true">→</span></button>
          }
          <span class="count">{{ items().length }} photos</span>
        </div>
      </div>
      <div class="track">
        <button class="add" type="button" (click)="picker.click()">
          <span class="add-circle">＋</span>
          <span class="add-title">Add photo</span>
          <span class="add-sub">drag or click</span>
        </button>
        <input #picker type="file" accept="image/*" hidden (change)="onPick($event)" />
        @for (photo of stripItems(); track photo.id) {
          <div class="item">
            <div class="photo-wrap">
              <img class="photo" [src]="photo.src" [alt]="photo.caption || 'Tank photo'" (click)="openLightbox(photo)" />
              <span class="badge" [style.background]="badge(photo).color">{{ badge(photo).label }}</span>
              <button class="del" type="button" aria-label="Remove photo" title="Remove photo" (click)="store.removePhoto(photo.id)">✕</button>
            </div>
            <div class="date">{{ photo.date | date: 'MMM d' }}</div>
            @if (photo.caption) { <div class="cap">{{ photo.caption }}</div> }
            @if (photo.linkLabel) { <div class="tag">{{ photo.linkLabel }}</div> }
          </div>
        }
      </div>
    </section>

    @if (draftSrc(); as src) {
      <ui-modal (close)="cancelDraft()">
        <div class="dlg-head">
          <div>
            <h2 class="dlg-title">Add photo</h2>
            <p class="dlg-sub">Log a shot to your tank timeline</p>
          </div>
          <button class="x" (click)="cancelDraft()">✕</button>
        </div>

        <img class="preview" [src]="src" alt="New photo preview" />

        <form [formGroup]="form" (ngSubmit)="saveDraft()">
          <div class="grid">
            <div>
              <span class="lbl">Date</span>
              <input type="date" formControlName="date" />
            </div>
            <div>
              <span class="lbl">Type</span>
              <select formControlName="type">
                @for (o of typeOptions; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </div>
          </div>

          <div>
            <span class="lbl">Linked activity <span class="hint">optional</span></span>
            <select formControlName="linkedTo">
              <option value="">None — progress photo</option>
              @for (o of linkOptions(); track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </div>

          <div>
            <span class="lbl">Caption <span class="hint">optional</span></span>
            <input type="text" formControlName="caption" placeholder="e.g. Cycle complete — first shrimp" />
          </div>

          <div class="dlg-actions">
            <button type="button" class="btn-ghost" (click)="cancelDraft()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid">Add photo</button>
          </div>
        </form>
      </ui-modal>
    }

    @if (galleryOpen()) {
      <gallery-dialog
        [tank]="tank()"
        (close)="galleryOpen.set(false)"
        (openCompare)="compareOpen.set(true)"
        (add)="picker.click()"
        (openPhoto)="lightbox.set($event)" />
    }

    @if (compareOpen()) {
      <progress-compare [tank]="tank()" (close)="compareOpen.set(false)" />
    }

    @if (lightbox(); as lb) {
      <photo-lightbox [photos]="lb.list" [index]="lb.index" [tank]="tank()" (close)="lightbox.set(null)" />
    }
  `,
    styles: `
    .card { background:#fff; border:1px solid #dcecec; border-radius:8px; padding:22px 24px 20px; box-shadow:0 1px 2px rgba(18,49,47,0.04); }
    .head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
    h2 { font-family:'Newsreader',serif; font-weight:500; font-size:22px; margin:0; color:#0f2e2c; }
    .sub { margin:3px 0 0; font-size:13px; color:#5a7371; }
    .head-actions { display:flex; align-items:center; gap:12px; }
    .btn-compare {
      appearance:none; border:1px solid #d3e0e0; background:#fff; color:#2c6e6b; font:inherit;
      font-weight:700; font-size:13px; padding:8px 14px; border-radius:999px; cursor:pointer;
      display:inline-flex; align-items:center; gap:8px; white-space:nowrap;
    }
    .btn-compare:hover:enabled { background:#f2fafa; border-color:#0f8a8d; color:#0f8a8d; }
    .btn-compare:disabled { opacity:0.45; cursor:not-allowed; }
    .view-all { appearance:none; border:none; background:none; color:#0f8a8d; font:inherit; font-weight:700; font-size:13px; padding:0; cursor:pointer; white-space:nowrap; }
    .view-all:hover { text-decoration:underline; }
    .count { font-size:12px; font-weight:600; color:#7d9391; letter-spacing:0.03em; white-space:nowrap; }

    .track { display:flex; gap:14px; overflow-x:auto; padding-bottom:6px; }
    .add {
      flex:0 0 auto; width:150px; height:186px; border:1.5px dashed #cbdcda; border-radius:10px;
      background:#f7fafa; color:#5a8180; font:inherit; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
    }
    .add:hover { border-color:#0f8a8d; color:#0f8a8d; background:#f2fafa; }
    .add-circle {
      width:34px; height:34px; border-radius:50%; background:#fff; border:1px solid #dcecec;
      display:flex; align-items:center; justify-content:center; font-size:20px; line-height:1;
    }
    .add-title { font-size:13px; font-weight:700; }
    .add-sub { font-size:11px; color:#9aacaa; font-weight:500; }

    .item { flex:0 0 auto; width:210px; }
    .photo-wrap { position:relative; }
    .photo { width:210px; height:140px; border-radius:10px; object-fit:cover; display:block; background:#eef4f4; cursor:zoom-in; box-shadow:inset 0 0 0 1px #e4ecec; }
    .badge {
      position:absolute; top:8px; left:8px; padding:3px 8px; border-radius:999px; color:#fff;
      font-size:10px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;
      box-shadow:0 1px 3px rgba(0,0,0,0.2); pointer-events:none;
    }
    .del {
      position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:6px;
      border:none; background:rgba(12,38,36,0.55); color:#fff; font-size:12px; line-height:1;
      cursor:pointer; opacity:0; transition:opacity 0.12s;
    }
    .photo-wrap:hover .del { opacity:1; }
    .del:hover { background:rgba(12,38,36,0.8); }
    .date { margin-top:10px; font-size:13px; font-weight:700; color:#12312f; }
    .cap {
      font-size:12px; color:#7d9391; line-height:1.35; max-width:210px; overflow:hidden;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    }
    .tag {
      display:inline-flex; margin-top:5px; padding:2px 9px; border-radius:999px;
      background:#f6faf9; border:1px solid #e4ecec; font-size:11px; font-weight:600; color:#2c4f4d;
    }

    /* ---- add-photo dialog ---- */
    .dlg-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .dlg-title { font-family:'Newsreader',serif; font-weight:500; font-size:24px; margin:0 0 4px; color:#0f2e2c; }
    .dlg-sub { margin:0; font-size:13px; color:#7d9391; }
    .x { appearance:none; border:none; background:none; font-size:15px; color:#93a8a6; cursor:pointer; padding:4px; line-height:1; }
    .x:hover { color:#2c4f4d; }
    .preview { width:100%; max-height:260px; object-fit:cover; border-radius:8px; margin-top:16px; background:#eef4f4; display:block; }
    form { margin-top:16px; display:flex; flex-direction:column; gap:14px; }
    .lbl { display:block; font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#5a7371; margin-bottom:6px; }
    .hint { text-transform:none; letter-spacing:0; color:#a3b6b4; font-weight:600; }
    input, select {
      width:100%; border:1px solid #cfe0df; border-radius:8px; padding:10px; font:inherit;
      font-size:14px; color:#12312f; background:#f7fafa; box-sizing:border-box;
    }
    input:focus, select:focus { outline:none; border-color:#0f8a8d; background:#fff; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width:420px) { .grid { grid-template-columns:1fr; } }
    .dlg-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:4px; }
    .dlg-actions button { font:inherit; font-weight:700; font-size:15px; border-radius:8px; cursor:pointer; }
    .btn-ghost { border:1px solid #dcecec; background:#fff; color:#5a7371; font-weight:600; padding:11px 18px; }
    .btn-ghost:hover { background:#f7fafa; }
    .btn-primary { border:none; background:#0f8a8d; color:#fff; padding:11px 22px; }
    .btn-primary:hover:enabled { filter:brightness(1.06); }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
  `,
})
export class TankGallery {
    private readonly fb = inject(FormBuilder);
    readonly store = inject(TankStore);
    readonly tank = input.required<Tank>();

    readonly typeOptions = TYPE_OPTIONS;

    /** 待保存照片的 data URL;非空即弹出补充信息的小窗 */
    readonly draftSrc = signal<string | null>(null);
    /** 全量照片弹窗 / 进程对比弹窗 */
    readonly galleryOpen = signal(false);
    readonly compareOpen = signal(false);
    /** lightbox:list 决定翻页范围(胶片条给全量倒序,gallery 弹窗给当前筛选) */
    readonly lightbox = signal<{ list: Photo[]; index: number } | null>(null);

    readonly form = this.fb.nonNullable.group({
        date: [todayISO(), Validators.required],
        type: ['other' as PhotoType],
        caption: [''],
        linkedTo: [''],
    });

    readonly items = computed<GalleryItem[]>(() => {
        const tank = this.tank();
        const byKey = new Map(activityLog(tank, Infinity).map(e => [e.key, e]));
        return sortPhotosDesc(tank.photos ?? []).map(p => {
            const linked = p.linkedTo ? byKey.get(p.linkedTo) : undefined;
            return { ...p, ...(linked ? { linkLabel: linked.title } : {}) };
        });
    });

    /** 胶片条只放最新 4 张;点开 lightbox 仍在全量列表里翻页 */
    readonly stripItems = computed(() => this.items().slice(0, 4));

    readonly ftsCount = computed(() => ftsPhotosAsc(this.tank()).length);
    readonly compareAvailable = computed(() => this.ftsCount() >= 2);
    /** 不可用时的悬停提示;可用时留空(动作本身已自解释) */
    readonly compareHint = computed(() => (this.compareAvailable() ? '' : compareHintText(this.ftsCount())));

    // 关联下拉:全部活动条目(最新在前),照片类事件除外(照片挂照片没有意义)
    readonly linkOptions = computed<LinkOption[]>(() =>
        activityLog(this.tank(), Infinity)
            .filter(e => e.category !== 'photo')
            .map(e => ({ value: e.key, label: `${formatDate(e.date, 'MMM d', 'en-US')} · ${e.title}` })),
    );

    badge(photo: Photo) {
        return PHOTO_TYPES[photoType(photo)];
    }

    openLightbox(photo: Photo): void {
        const list = this.items();
        this.lightbox.set({ list, index: list.findIndex(p => p.id === photo.id) });
    }

    async onPick(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ''; // 允许再次选同一个文件
        if (!file) return;
        try {
            const src = await downscaleToDataUrl(file);
            this.form.reset({ date: todayISO(), type: 'other', caption: '', linkedTo: '' });
            this.draftSrc.set(src);
        } catch {
            // 解码失败(损坏文件、不支持的格式如部分 HEIC):静默忽略
        }
    }

    saveDraft(): void {
        const src = this.draftSrc();
        if (!src || this.form.invalid) return;
        const raw = this.form.getRawValue();
        const photo: Photo = {
            id: newId(),
            src,
            date: raw.date,
            ...(raw.type !== 'other' ? { type: raw.type } : {}), // 缺省即 'other',不落冗余字段
            ...(raw.caption.trim() ? { caption: raw.caption.trim() } : {}),
            ...(raw.linkedTo ? { linkedTo: raw.linkedTo } : {}),
        };
        this.store.addPhoto(photo);
        this.draftSrc.set(null);
    }

    cancelDraft(): void {
        this.draftSrc.set(null);
    }
}

/** 长边压到 ≤1280px、JPEG q0.8 —— 一张照片 ~100-200KB,localStorage 装得下几十张 */
async function downscaleToDataUrl(file: File, maxDim = 1280): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    } finally {
        bitmap.close();
    }
}
