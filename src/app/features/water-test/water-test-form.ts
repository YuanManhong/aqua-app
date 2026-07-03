import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ValueRange, WaterTest, newId, todayISO } from '../../domain/tank.model';
import { TankStore } from '../../state/tank.store';
import { WATER_PARAMS } from './water-params';

@Component({
    selector: 'water-test-form',
    imports: [ReactiveFormsModule],
    template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label class="field">
        Date
        <input type="date" formControlName="date" />
      </label>

      <div class="param-rows" formGroupName="values">
        @for (param of params; track param.key) {
          <div class="param-row" [formGroupName]="param.key">
            <span class="param-label">{{ param.label }}</span>
            <input type="number" step="any" placeholder="value" formControlName="value" />
            <span>~</span>
            <input type="number" step="any" placeholder="max (optional)" formControlName="max" />
          </div>
        }
      </div>

      <label class="field">
        Note
        <input type="text" formControlName="note" placeholder="optional" />
      </label>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button type="submit" [disabled]="form.invalid">Add water test</button>
    </form>
  `,
    styles: `
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.25rem; max-width: 16rem; }
    .param-rows { display: flex; flex-direction: column; gap: 0.5rem; }
    .param-row { display: flex; align-items: center; gap: 0.5rem; }
    .param-label { width: 10rem; }
    .param-row input { width: 7rem; }
    .error { color: #c0392b; margin: 0; }
    button { align-self: flex-start; }
  `,
})
export class WaterTestForm {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);

    readonly params = WATER_PARAMS;
    readonly error = signal('');

    // 每个参数两个输入:只填 value 存 number,两个都填存 ValueRange
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
    }
}
