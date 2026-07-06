import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ValueRange, WaterTest, newId, todayISO } from '../../domain/tank.model';
import { TYPICAL_VALUES } from '../../domain/water-status';
import { fromDisplayValue, toDisplayNumber, toDisplayValue, unitOf } from '../../domain/hardness';
import { TankStore } from '../../state/tank.store';
import { SettingsStore } from '../../state/settings.store';
import { WATER_PARAMS } from '../../domain/water-params';

// Add/Edit test 弹窗的表单体:每个参数一个 value + 可选 max(两个都填 → ValueRange)。
// 传入 editTest 即编辑模式:表单预填该条记录,保存时原 id 整条替换。
@Component({
    selector: 'water-test-form',
    imports: [ReactiveFormsModule],
    template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="field">
        <span class="lbl">Date</span>
        <input type="date" formControlName="date" class="date-input" />
      </div>

      <div class="param-grid" formGroupName="values">
        @for (param of params; track param.key) {
          <div class="param" [formGroupName]="param.key">
            <span class="lbl">
              {{ param.label }} <span class="unit">{{ units()[param.key] }}</span>
            </span>
            <div class="inputs">
              <input type="number" step="0.1" placeholder="value" formControlName="value" />
              <span class="sep">–</span>
              <input type="number" step="0.1" placeholder="max" formControlName="max" />
            </div>
          </div>
        }
      </div>

      <div class="field">
        <span class="lbl">Note</span>
        <input type="text" formControlName="note" placeholder="Optional — e.g. did a 30% water change" />
      </div>

      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="actions">
        <button type="button" class="btn-ghost" (click)="cancel.emit()">Cancel</button>
        <button type="submit" class="btn-primary">{{ editTest() ? 'Save changes' : 'Save test' }}</button>
      </div>
    </form>
  `,
    styles: `
    form { margin-top: 4px; }
    .lbl { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #5a7371; margin-bottom: 6px; }
    .unit { text-transform: none; letter-spacing: 0; color: #a3b6b4; font-weight: 600; }
    .field { margin-bottom: 18px; }
    .date-input { max-width: 220px; }
    input {
      width: 100%; border: 1px solid #cfe0df; border-radius: 8px; padding: 10px; font: inherit;
      font-size: 14px; color: #12312f; background: #f7fafa; box-sizing: border-box;
    }
    input:focus { outline: none; border-color: #0f8a8d; background: #fff; }
    .param-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 18px; margin-bottom: 18px; }
    .inputs { display: flex; align-items: center; gap: 8px; }
    .inputs input { text-align: right; font-feature-settings: 'tnum'; padding: 9px 10px; min-width: 0; flex: 1 1 0; }
    .sep { color: #b3c5c3; }
    .error { color: #c0392b; margin: 0 0 12px; font-size: 13px; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 2px; }
    button { font: inherit; font-weight: 700; font-size: 15px; border-radius: 8px; cursor: pointer; }
    .btn-ghost { border: 1px solid #dcecec; background: #fff; color: #5a7371; font-weight: 600; padding: 11px 18px; }
    .btn-ghost:hover { background: #f7fafa; }
    .btn-primary { border: none; background: #0f8a8d; color: #fff; padding: 11px 22px; }
    .btn-primary:hover { filter: brightness(1.06); }
  `,
})
export class WaterTestForm implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);
    private readonly settings = inject(SettingsStore);

    readonly params = WATER_PARAMS;
    readonly units = computed(() =>
        Object.fromEntries(WATER_PARAMS.map(p => [p.key, unitOf(p.key, this.settings.hardnessUnit())])),
    );
    readonly error = signal('');
    /** 编辑模式:要改的那条记录(不传 = 新增) */
    readonly editTest = input<WaterTest | undefined>(undefined);
    readonly saved = output<void>();
    readonly cancel = output<void>();

    readonly form = this.fb.group({
        date: this.fb.nonNullable.control(todayISO(), Validators.required),
        note: this.fb.nonNullable.control(''),
        // 预填:有上次测试就沿用上次的值(区间则拆回 min/max);
        // 上次没测该参数或首次测试 → 填该参数的「正常值」。
        // 存储永远是度,GH/KH 按当前硬度单位换算成展示值再填。
        values: this.fb.group(
            Object.fromEntries(
                WATER_PARAMS.map(p => {
                    const unit = this.settings.hardnessUnit();
                    const stored = this.store.latestTest()?.[p.key];
                    const prev = stored === undefined ? undefined : toDisplayValue(p.key, stored, unit);
                    return [
                        p.key,
                        this.fb.group({
                            value: this.fb.control<number | null>(
                                prev === undefined ? toDisplayNumber(p.key, TYPICAL_VALUES[p.key], unit)
                                    : typeof prev === 'number' ? prev
                                    : prev.min,
                            ),
                            max: this.fb.control<number | null>(typeof prev === 'object' ? prev.max : null),
                        }),
                    ];
                }),
            ),
        ),
    });

    // 编辑模式:用被编辑记录的值覆盖默认预填(没测的参数清空,而不是留着上次/典型值)
    ngOnInit(): void {
        const editing = this.editTest();
        if (!editing) return;
        const unit = this.settings.hardnessUnit();
        this.form.patchValue({
            date: editing.date,
            note: editing.note ?? '',
            values: Object.fromEntries(
                WATER_PARAMS.map(p => {
                    const stored = editing[p.key];
                    const d = stored === undefined ? undefined : toDisplayValue(p.key, stored, unit);
                    return [p.key, {
                        value: d === undefined ? null : typeof d === 'number' ? d : d.min,
                        max: typeof d === 'object' ? d.max : null,
                    }];
                }),
            ),
        });
    }

    submit(): void {
        const raw = this.form.getRawValue();
        const editing = this.editTest();
        const test: WaterTest = { id: editing?.id ?? newId(), date: raw.date };

        // GH/KH 在 ppm 模式下输入的是 ppm,入库前换回度(存储单位唯一)
        const unit = this.settings.hardnessUnit();
        let measured = 0;
        for (const param of WATER_PARAMS) {
            const { value, max } = raw.values[param.key] as { value: number | null; max: number | null };
            if (value === null) continue;
            const lo = fromDisplayValue(param.key, value, unit);
            test[param.key] = max === null ? lo : ({ min: lo, max: fromDisplayValue(param.key, max, unit) } satisfies ValueRange);
            measured++;
        }
        if (measured === 0) {
            this.error.set('At least one parameter is required.');
            return;
        }
        if (raw.note.trim()) test.note = raw.note.trim();

        if (editing) this.store.updateWaterTest(test);
        else this.store.addWaterTest(test);
        this.error.set('');
        this.form.reset({ date: todayISO(), note: '' });
        this.saved.emit();
    }
}
