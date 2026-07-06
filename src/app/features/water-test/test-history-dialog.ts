import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WaterParam, WaterTest, ValueRange, todayISO } from '../../domain/tank.model';
import { sortByDateDesc } from '../../domain/tank.logic';
import { statusOf } from '../../domain/water-status';
import { HardnessUnit, formatParamValue, toDisplayValue, unitOf } from '../../domain/hardness';
import { WATER_PARAMS } from '../../domain/water-params';
import { STATUS_COLORS } from '../ui/tokens';
import { Modal } from '../ui/modal';
import { SettingsStore } from '../../state/settings.store';
import { TankStore } from '../../state/tank.store';

interface Cell {
    display: string;
    bg: string;
    color: string;
}

interface Row {
    id: string;
    date: string;
    relative: string;
    note: string;
    cells: Cell[];
}

const PRESETS = [
    { key: 'all', label: 'All' },
    { key: '3', label: '3 mo' },
    { key: '6', label: '6 mo' },
    { key: '12', label: '1 yr' },
];

// 全部水质测试的历史弹窗:日期为行、6 参数为列、按状态着色;支持日期范围过滤 + 导出。
// 每行可编辑(edit 事件交给 app 打开编辑弹窗)/删除(行内二次确认后直接走 store)。
@Component({
    selector: 'test-history-dialog',
    imports: [DatePipe, Modal],
    template: `
    <ui-modal wide (close)="close.emit()">
      <div class="hh">
        <div>
          <h2>Test history</h2>
          <p class="sub">{{ tankName() }} · every water test, newest first</p>
        </div>
        <button class="x" (click)="close.emit()" aria-label="Close">✕</button>
      </div>

      <div class="tb">
        <div class="range">
          <span class="lbl">Range</span>
          @for (p of presets; track p.key) {
            <button class="pill" [class.on]="preset() === p.key" (click)="setPreset(p.key)">{{ p.label }}</button>
          }
          <span class="sep"></span>
          <input type="date" [value]="from()" [max]="today" (change)="onFrom($event)" />
          <span class="dash">–</span>
          <input type="date" [value]="to()" [max]="today" (change)="onTo($event)" />
        </div>
        <div class="exports">
          <button class="btn-copy" (click)="copy()">{{ copied() ? 'Copied!' : 'Copy' }}</button>
          <button class="btn-csv" (click)="exportCsv()">Export CSV</button>
        </div>
      </div>

      <div class="scroll">
        <div class="grid head">
          <div class="c-date">Date</div>
          @for (p of params(); track p.key) {
            <div class="c-num">{{ p.label }} @if (p.unit) { <span class="u">{{ p.unit }}</span> }</div>
          }
          <div class="c-note">Note</div>
          <div class="c-act"></div>
        </div>
        @if (rows().length === 0) {
          <div class="empty">No tests in this range. Widen the dates to see more.</div>
        }
        @for (row of rows(); track row.id) {
          <div class="grid row">
            <div class="c-date">
              <span class="d1">{{ row.date | date: 'MMM d, y' }}</span>
              <span class="d2">{{ row.relative }}</span>
            </div>
            @for (cell of row.cells; track $index) {
              <div class="c-num val" [style.background]="cell.bg" [style.color]="cell.color">{{ cell.display }}</div>
            }
            <div class="c-note note">{{ row.note }}</div>
            <div class="c-act act">
              @if (confirmingId() === row.id) {
                <button class="sure" (click)="deleteTest(row.id)">Delete?</button>
              } @else {
                <button class="ico" aria-label="Edit test" title="Edit test" (click)="editTest(row.id)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                </button>
                <button class="ico danger" aria-label="Delete test" title="Delete test" (click)="confirmingId.set(row.id)">✕</button>
              }
            </div>
          </div>
        }
      </div>

      <div class="ft">
        <div class="legend">
          <span class="lg"><i style="background:#e8f5ee;border-color:#c9e8d7"></i>Safe</span>
          <span class="lg"><i style="background:#fbf1dd;border-color:#f0dcb0"></i>Watch</span>
          <span class="lg"><i style="background:#fbe7e2;border-color:#f0cabf"></i>Danger</span>
        </div>
        <span class="count">{{ shownLabel() }}</span>
      </div>
    </ui-modal>
  `,
    styles: `
    .hh { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 26px 16px; border-bottom: 1px solid #eef2f2; }
    .hh h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 26px; margin: 0; color: #0f2e2c; }
    .hh .sub { margin: 4px 0 0; font-size: 13px; color: #7d9391; }
    .x { appearance: none; border: 1px solid #dcecec; background: #f7fafa; width: 34px; height: 34px; border-radius: 8px; font-size: 16px; color: #5a7371; cursor: pointer; flex: 0 0 auto; }
    .x:hover { background: #eef2f2; }

    .tb { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 26px; border-bottom: 1px solid #eef2f2; background: #f7fafa; }
    .range { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .range .lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8aa19f; }
    .pill { appearance: none; border: 1px solid #d3e0e0; background: #fff; color: #3c5a5c; padding: 6px 13px; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .pill.on { background: #0f8a8d; border-color: #0f8a8d; color: #fff; }
    .sep { width: 1px; height: 20px; background: #dbe6e5; margin: 0 4px; }
    .range input[type=date] { border: 1px solid #cfe0df; border-radius: 7px; padding: 7px 9px; font: inherit; font-size: 13px; color: #12312f; background: #fff; }
    .dash { color: #a3b6b4; font-size: 13px; }
    .exports { display: flex; align-items: center; gap: 8px; }
    .btn-copy { appearance: none; border: 1px solid #d3e0e0; background: #fff; color: #2c6e6b; font: inherit; font-weight: 700; font-size: 13px; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
    .btn-copy:hover { background: #f2fafa; border-color: #0f8a8d; }
    .btn-csv { appearance: none; border: none; background: #0f8a8d; color: #fff; font: inherit; font-weight: 700; font-size: 13px; padding: 9px 15px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(15,138,141,0.28); }
    .btn-csv:hover { filter: brightness(1.06); }

    .scroll { flex: 1 1 auto; overflow: auto; }
    .grid { display: grid; grid-template-columns: 148px repeat(6, minmax(84px, 1fr)) minmax(150px, 1.3fr) 82px; }
    .grid.head { position: sticky; top: 0; z-index: 1; background: #f7fafa; box-shadow: inset 0 -1px 0 #e4ecec; }
    .grid.head > div { padding: 11px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #5a7371; }
    .grid.head .c-date, .grid.head .c-note { padding-left: 16px; padding-right: 16px; letter-spacing: 0.06em; }
    .c-num { text-align: right; }
    .c-num .u { color: #a3b6b4; font-weight: 600; text-transform: none; letter-spacing: 0; }
    .grid.row { border-bottom: 1px solid #eef2f2; }
    .c-date { padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; }
    .c-date .d1 { font-size: 14px; font-weight: 700; color: #12312f; }
    .c-date .d2 { font-size: 11.5px; color: #9aacaa; margin-top: 1px; }
    .val { padding: 12px; display: flex; align-items: center; justify-content: flex-end; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; font-weight: 700; font-size: 14px; }
    .note { padding: 12px 16px; display: flex; align-items: center; font-size: 13px; font-style: italic; color: #5a7371; }
    .empty { padding: 60px 26px; text-align: center; color: #8aa19f; font-size: 15px; }

    .act { padding: 12px 14px 12px 6px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
    .ico { appearance: none; border: 1px solid #dcecec; background: #fff; width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #5a7371; cursor: pointer; }
    .ico:hover { background: #f2fafa; border-color: #0f8a8d; color: #0f8a8d; }
    .ico.danger:hover { background: #fdf3f1; border-color: #c0392b; color: #c0392b; }
    .sure { appearance: none; border: 1px solid #c0392b; background: #c0392b; color: #fff; font: inherit; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 7px; cursor: pointer; }
    .sure:hover { filter: brightness(1.08); }

    .ft { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 26px; border-top: 1px solid #eef2f2; }
    .legend { display: flex; align-items: center; gap: 16px; }
    .lg { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #5a7371; }
    .lg i { width: 11px; height: 11px; border-radius: 3px; border: 1px solid; display: inline-block; }
    .count { font-size: 12.5px; font-weight: 600; color: #7d9391; }
  `,
})
export class TestHistoryDialog {
    readonly tests = input.required<WaterTest[]>();
    readonly tankName = input('');
    readonly close = output<void>();
    /** 请求编辑某条记录 → app 在本弹窗之上打开编辑表单 */
    readonly edit = output<WaterTest>();

    private readonly settings = inject(SettingsStore);
    private readonly store = inject(TankStore);
    readonly presets = PRESETS;
    readonly params = computed(() =>
        WATER_PARAMS.map(p => ({ key: p.key, label: p.label, unit: unitOf(p.key, this.settings.hardnessUnit()) })),
    );
    readonly today = todayISO();

    readonly from = signal('');
    readonly to = signal('');
    readonly preset = signal<string>('all');
    readonly copied = signal(false);
    /** 待确认删除的记录 id(二次点击才真删;点编辑或删别的行会重置) */
    readonly confirmingId = signal('');

    // 过滤 + 按日期倒序(最新在上;同日后录入的在上)
    readonly filtered = computed(() => {
        const f = this.from(), t = this.to();
        return sortByDateDesc(this.tests().filter(x => (!f || x.date >= f) && (!t || x.date <= t)));
    });

    readonly rows = computed<Row[]>(() => {
        const unit = this.settings.hardnessUnit();
        return this.filtered().map(test => ({
            id: test.id,
            date: test.date,
            relative: relativeFromToday(test.date),
            note: test.note ?? '',
            cells: WATER_PARAMS.map(p => {
                const v = test[p.key];
                if (v === undefined) return { display: '—', bg: STATUS_COLORS.none.bg, color: '#9aacaa' };
                return { display: formatParamValue(p.key, v, unit), bg: STATUS_COLORS[statusOf(p.key, v)].bg, color: '#12312f' };
            }),
        }));
    });

    readonly shownLabel = computed(() => {
        const shown = this.filtered().length, total = this.tests().length;
        return shown === total ? `All ${total} tests` : `${shown} of ${total} tests`;
    });

    setPreset(key: string): void {
        this.preset.set(key);
        if (key === 'all') { this.from.set(''); this.to.set(''); }
        else { this.from.set(monthsAgoISO(this.today, Number(key))); this.to.set(''); }
    }
    onFrom(e: Event): void { this.from.set((e.target as HTMLInputElement).value); this.preset.set('custom'); }
    onTo(e: Event): void { this.to.set((e.target as HTMLInputElement).value); this.preset.set('custom'); }

    editTest(id: string): void {
        this.confirmingId.set('');
        const test = this.tests().find(t => t.id === id);
        if (test) this.edit.emit(test);
    }

    deleteTest(id: string): void {
        this.confirmingId.set('');
        this.store.removeWaterTest(id);
    }

    // Copy = TSV(粘进 Sheets/Excel 自动分列);Export = CSV 文件
    copy(): void {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1600);
        navigator.clipboard?.writeText(this.delimited('\t')).catch(() => {});
    }

    exportCsv(): void {
        const blob = new Blob([this.delimited(',')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(this.tankName() || 'tank').trim().replace(/\s+/g, '-').toLowerCase()}-water-tests.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 导出跟随当前硬度单位("Entry, tiles, trend, history & exports" 一致口径)
    private delimited(delim: string): string {
        const unit = this.settings.hardnessUnit();
        const header = ['Date', ...WATER_PARAMS.map(p => {
            const u = unitOf(p.key, unit);
            return p.label + (u ? ` (${u})` : '');
        }), 'Note'];
        const esc = delim === '\t'
            ? (s: string) => s.replace(/[\t\n]/g, ' ')
            : (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
        const lines = this.filtered().map(t => [t.date, ...WATER_PARAMS.map(p => csvValue(p.key, t[p.key], unit)), t.note ?? '']);
        return [header, ...lines].map(r => r.map(c => esc(String(c))).join(delim)).join('\n');
    }
}

function csvValue(param: WaterParam, v: number | ValueRange | undefined, unit: HardnessUnit): string {
    if (v === undefined) return '';
    const d = toDisplayValue(param, v, unit);
    return typeof d === 'number' ? String(d) : `${d.min}-${d.max}`;
}

function monthsAgoISO(todayIso: string, n: number): string {
    const [y, m, d] = todayIso.split('-').map(Number);
    const dt = new Date(y, m - 1 - n, d);
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function relativeFromToday(iso: string): string {
    const days = Math.round((Date.now() - Date.parse(iso + 'T00:00:00')) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
}
