import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AquaticPlant, Livestock, newId, todayISO } from '../../domain/tank.model';
import { TankStore } from '../../state/tank.store';
import { SWATCH_PALETTE } from '../ui/tokens';

// Manage 弹窗的「Add new」标签体:添加生物或水草;livestock 带颜色标签。
@Component({
    selector: 'inhabitant-form',
    imports: [ReactiveFormsModule],
    template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div>
        <span class="lbl">Type</span>
        <select formControlName="type">
          <option value="livestock">Livestock</option>
          <option value="plant">Plant</option>
        </select>
      </div>

      <div>
        <span class="lbl">Species</span>
        <input type="text" formControlName="species" placeholder="e.g. Amano Shrimp" />
      </div>

      <div class="row">
        <div class="count-col">
          <span class="lbl">Count</span>
          <input type="number" min="1" step="1" formControlName="count" class="num" />
        </div>
        <div class="date-col">
          <span class="lbl">On-board date</span>
          <input type="date" formControlName="onBoardDate" />
        </div>
      </div>

      @if (form.controls.type.value === 'livestock') {
        <div>
          <span class="lbl">Color <span class="hint">livestock tag</span></span>
          <select formControlName="color">
            @for (sw of swatches; track sw.value) {
              <option [value]="sw.value">{{ sw.label }}</option>
            }
          </select>
        </div>
      }

      <div>
        <span class="lbl">Note</span>
        <input type="text" formControlName="note" placeholder="Optional" />
      </div>

      <div class="actions">
        <button type="button" class="btn-ghost" (click)="cancel.emit()">Cancel</button>
        <button type="submit" class="btn-primary" [disabled]="form.invalid">Add inhabitant</button>
      </div>
    </form>
  `,
    styles: `
    form { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
    .lbl { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #5a7371; margin-bottom: 6px; }
    .hint { text-transform: none; letter-spacing: 0; color: #a3b6b4; font-weight: 600; }
    input, select {
      width: 100%; border: 1px solid #cfe0df; border-radius: 8px; padding: 10px; font: inherit;
      font-size: 14px; color: #12312f; background: #f7fafa; box-sizing: border-box;
    }
    input:focus, select:focus { outline: none; border-color: #0f8a8d; background: #fff; }
    .row { display: flex; gap: 12px; }
    .count-col { flex: 0 0 108px; }
    .date-col { flex: 1 1 0; min-width: 0; }
    .num { text-align: right; font-feature-settings: 'tnum'; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
    button { font: inherit; font-weight: 700; font-size: 15px; border-radius: 8px; cursor: pointer; }
    .btn-ghost { border: 1px solid #dcecec; background: #fff; color: #5a7371; font-weight: 600; padding: 11px 18px; }
    .btn-ghost:hover { background: #f7fafa; }
    .btn-primary { border: none; background: #0f8a8d; color: #fff; padding: 11px 22px; }
    .btn-primary:hover { filter: brightness(1.06); }
  `,
})
export class InhabitantForm {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);

    readonly swatches = SWATCH_PALETTE;
    readonly saved = output<void>();
    readonly cancel = output<void>();

    readonly form = this.fb.nonNullable.group({
        type: this.fb.nonNullable.control<'livestock' | 'plant'>('livestock'),
        species: this.fb.nonNullable.control('', Validators.required),
        color: this.fb.nonNullable.control(SWATCH_PALETTE[4].value), // Teal
        count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
        onBoardDate: this.fb.nonNullable.control(todayISO(), Validators.required),
        note: this.fb.nonNullable.control(''),
    });

    submit(): void {
        const raw = this.form.getRawValue();
        const base = {
            id: newId(),
            species: raw.species.trim(),
            onBoardDate: raw.onBoardDate,
            countHistory: [{ date: raw.onBoardDate, count: raw.count }],
            ...(raw.note.trim() ? { note: raw.note.trim() } : {}),
        };

        if (raw.type === 'livestock') {
            const item: Livestock = { ...base, color: raw.color, kind: 'group' };
            this.store.addLivestock(item);
        } else {
            const item: AquaticPlant = base;
            this.store.addPlant(item);
        }
        this.form.reset({ type: raw.type, color: raw.color, count: 1, onBoardDate: todayISO(), note: '' });
        this.saved.emit();
    }
}
