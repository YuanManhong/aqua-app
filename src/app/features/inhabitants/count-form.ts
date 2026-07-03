import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

// 给某个生物/水草记一次数量变化;纯展示组件,结果通过 output 交给上层
@Component({
    selector: 'count-form',
    imports: [ReactiveFormsModule],
    template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input type="number" min="0" placeholder="new count" formControlName="count" />
      <input type="text" placeholder="reason (optional)" formControlName="reason" />
      <button type="submit" [disabled]="form.invalid">Save</button>
      <button type="button" (click)="cancel.emit()">Cancel</button>
    </form>
  `,
    styles: `
    form { display: flex; gap: 0.5rem; align-items: center; }
    input[type='number'] { width: 6rem; }
  `,
})
export class CountForm {
    private readonly fb = inject(FormBuilder);

    readonly save = output<{ count: number; reason?: string }>();
    readonly cancel = output<void>();

    readonly form = this.fb.group({
        count: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
        reason: this.fb.nonNullable.control(''),
    });

    submit(): void {
        const { count, reason } = this.form.getRawValue();
        if (count === null) return;
        this.save.emit({ count, reason: reason.trim() || undefined });
        this.form.reset({ reason: '' });
    }
}
