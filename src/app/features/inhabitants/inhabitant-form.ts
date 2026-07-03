import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AquaticPlant, Livestock, newId, todayISO } from '../../domain/tank.model';
import { TankStore } from '../../state/tank.store';

// 添加生物或水草;type 切换决定是否显示 color/kind
@Component({
    selector: 'inhabitant-form',
    imports: [ReactiveFormsModule],
    template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label class="field">
        Type
        <select formControlName="type">
          <option value="livestock">Livestock</option>
          <option value="plant">Plant</option>
        </select>
      </label>

      <label class="field">
        Species
        <input type="text" formControlName="species" />
      </label>

      @if (form.controls.type.value === 'livestock') {
        <label class="field">
          Color
          <input type="text" formControlName="color" />
        </label>
        <label class="field">
          Kind
          <select formControlName="kind">
            <option value="individual">Individual</option>
            <option value="group">Group</option>
          </select>
        </label>
      }

      <label class="field">
        Initial count
        <input type="number" min="1" formControlName="count" />
      </label>

      <label class="field">
        On-board date
        <input type="date" formControlName="onBoardDate" />
      </label>

      <button type="submit" [disabled]="form.invalid">Add</button>
    </form>
  `,
    styles: `
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    .field { display: flex; flex-direction: column; gap: 0.25rem; max-width: 16rem; }
    button { align-self: flex-start; }
  `,
})
export class InhabitantForm {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);

    readonly form = this.fb.nonNullable.group({
        type: this.fb.nonNullable.control<'livestock' | 'plant'>('livestock'),
        species: this.fb.nonNullable.control('', Validators.required),
        color: this.fb.nonNullable.control(''),
        kind: this.fb.nonNullable.control<'individual' | 'group'>('individual'),
        count: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
        onBoardDate: this.fb.nonNullable.control(todayISO(), Validators.required),
    });

    submit(): void {
        const raw = this.form.getRawValue();
        const base = {
            id: newId(),
            species: raw.species.trim(),
            onBoardDate: raw.onBoardDate,
            countHistory: [{ date: raw.onBoardDate, count: raw.count }],
        };

        if (raw.type === 'livestock') {
            const item: Livestock = { ...base, color: raw.color.trim(), kind: raw.kind };
            this.store.addLivestock(item);
        } else {
            const item: AquaticPlant = base;
            this.store.addPlant(item);
        }
        this.form.reset({ type: raw.type, count: 1, onBoardDate: todayISO() });
    }
}
