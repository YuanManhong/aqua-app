import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ValueRange, WaterTest, newId, todayISO } from '../../domain/tank.model';
import { UNITS } from '../../domain/water-status';
import { TankStore } from '../../state/tank.store';
import { WATER_PARAMS } from './water-params';

// Add test 弹窗的表单体:每个参数一个 value + 可选 max(两个都填 → ValueRange)。
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
              {{ param.label }} <span class="unit">{{ units[param.key] }}</span>
            </span>
            <div class="inputs">
              <input type="number" step="any" placeholder="value" formControlName="value" />
              <span class="sep">–</span>
              <input type="number" step="any" placeholder="max" formControlName="max" />
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
        <button type="submit" class="btn-primary">Save test</button>
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
export class WaterTestForm {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);

    readonly params = WATER_PARAMS;
    readonly units = UNITS;
    readonly error = signal('');
    readonly saved = output<void>();
    readonly cancel = output<void>();

    readonly form = this.fb.group({
        date: this.fb.nonNullable.control(todayISO(), Validators.required),
        note: this.fb.nonNullable.control(''),
        values: this.fb.group(
            Object.fromEntries(
                WATER_PARAMS.map(p => [
                    p.key,
                    this.fb.group({
                        value: this.fb.control<number | null>(null),
                        max: this.fb.control<number | null>(null),
                    }),
                ]),
            ),
        ),
    });

    submit(): void {
        const raw = this.form.getRawValue();
        const test: WaterTest = { id: newId(), date: raw.date };

        let measured = 0;
        for (const param of WATER_PARAMS) {
            const { value, max } = raw.values[param.key] as { value: number | null; max: number | null };
            if (value === null) continue;
            test[param.key] = max === null ? value : ({ min: value, max } satisfies ValueRange);
            measured++;
        }
        if (measured === 0) {
            this.error.set('At least one parameter is required.');
            return;
        }
        if (raw.note.trim()) test.note = raw.note.trim();

        this.store.addWaterTest(test);
        this.error.set('');
        this.form.reset({ date: todayISO(), note: '' });
        this.saved.emit();
    }
}
