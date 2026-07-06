import { Component, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SetupStyle, TechLevel, WaterType } from '../domain/tank.model';
import { TECH_LEVELS, WATER_TYPES, setupStylesFor, techLevelApplies } from '../domain/tank-classification';
import { TankStore } from '../state/tank.store';
import { Modal } from './ui/modal';

/** 和 Validators.required 的区别:纯空白也算空。 */
const requiredTrimmed = (c: AbstractControl) => (String(c.value ?? '').trim() ? null : { required: true });

// Edit tank 弹窗:改名字/日期/容量,以及三个分类标签。
// 分类必须可编辑——缸会演变(裸缸种草、low-tech 上 CO2、混养缸变虾缸),
// 这些是描述性标签不是身份标识,改了没有数据完整性问题。
@Component({
    selector: 'edit-tank-dialog',
    imports: [ReactiveFormsModule, Modal],
    template: `
    <ui-modal (close)="close.emit()">
      <div class="head">
        <div>
          <h2>Edit tank</h2>
          <p class="sub">Details and labels — tanks evolve, change these anytime</p>
        </div>
        <button class="x" (click)="close.emit()">✕</button>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()">
        <div>
          <span class="lbl">Tank name</span>
          <input type="text" formControlName="name" />
        </div>

        <div class="grid">
          <div>
            <span class="lbl">Start date</span>
            <input type="date" formControlName="startDate" />
          </div>
          <div>
            <span class="lbl">Volume <span class="hint">optional</span></span>
            <input type="text" placeholder="e.g. 5.5 gal" formControlName="volume" />
          </div>
        </div>

        <div>
          <span class="lbl">Water type</span>
          <select formControlName="waterType">
            <option value="" disabled>Select water type…</option>
            @for (o of waterTypes; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </div>

        <div class="grid">
          <div>
            <span class="lbl">Setup style <span class="hint">optional</span></span>
            <select formControlName="setupStyle">
              <option value="">None / not sure</option>
              @for (o of styleOptions(); track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </div>
          @if (showTechLevel()) {
            <div>
              <span class="lbl">Tech level <span class="hint">optional</span></span>
              <select formControlName="techLevel">
                <option value="">None / not sure</option>
                @for (o of techLevels; track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </div>
          }
        </div>

        <div class="actions">
          <button type="button" class="btn-ghost" (click)="close.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="form.invalid">Save changes</button>
        </div>
      </form>

      <div class="danger">
        @if (confirmingDelete()) {
          <span class="danger-text">Delete this tank and all its records? This can’t be undone.</span>
          <div class="danger-actions">
            <button type="button" class="btn-ghost" (click)="confirmingDelete.set(false)">Keep it</button>
            <button type="button" class="btn-danger" (click)="deleteTank()">Delete tank</button>
          </div>
        } @else {
          <button type="button" class="link-danger" (click)="confirmingDelete.set(true)">Delete this tank…</button>
        }
      </div>
    </ui-modal>
  `,
    styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 24px; margin: 0 0 4px; color: #0f2e2c; }
    .sub { margin: 0; font-size: 13px; color: #7d9391; }
    .x {
      appearance: none; border: none; background: none; font-size: 15px; color: #93a8a6;
      cursor: pointer; padding: 4px; line-height: 1;
    }
    .x:hover { color: #2c4f4d; }

    form { margin-top: 18px; display: flex; flex-direction: column; gap: 14px; }
    .lbl { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #5a7371; margin-bottom: 6px; }
    .hint { text-transform: none; letter-spacing: 0; color: #a3b6b4; font-weight: 600; }
    input, select {
      width: 100%; border: 1px solid #cfe0df; border-radius: 8px; padding: 10px; font: inherit;
      font-size: 14px; color: #12312f; background: #f7fafa; box-sizing: border-box;
    }
    input:focus, select:focus { outline: none; border-color: #0f8a8d; background: #fff; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid > :only-child { grid-column: 1 / -1; } /* 非淡水时 Tech level 隐藏,Setup style 占满整行 */
    @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }

    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
    button { font: inherit; font-weight: 700; font-size: 15px; border-radius: 8px; cursor: pointer; }
    .btn-ghost { border: 1px solid #dcecec; background: #fff; color: #5a7371; font-weight: 600; padding: 11px 18px; }
    .btn-ghost:hover { background: #f7fafa; }
    .btn-primary { border: none; background: #0f8a8d; color: #fff; padding: 11px 22px; }
    .btn-primary:hover:enabled { filter: brightness(1.06); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    /* 危险区:删缸走两步确认,避免误触 */
    .danger {
      margin-top: 18px; padding-top: 14px; border-top: 1px solid #eee3e1;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .link-danger {
      appearance: none; border: none; background: none; padding: 2px 0;
      font: inherit; font-size: 13px; font-weight: 600; color: #c0392b; cursor: pointer;
    }
    .link-danger:hover { text-decoration: underline; }
    .danger-text { font-size: 13px; color: #8c2f22; line-height: 1.4; }
    .danger-actions { display: flex; gap: 8px; margin-left: auto; }
    .btn-danger { border: none; background: #c0392b; color: #fff; padding: 10px 16px; font-size: 14px; }
    .btn-danger:hover { filter: brightness(1.08); }
  `,
})
export class EditTankDialog {
    private readonly fb = inject(FormBuilder);
    private readonly store = inject(TankStore);

    readonly close = output<void>();
    readonly waterTypes = WATER_TYPES;
    readonly techLevels = TECH_LEVELS;

    readonly form = this.fb.nonNullable.group({
        name: [this.store.currentTank()?.name ?? '', requiredTrimmed],
        startDate: [this.store.currentTank()?.startDate ?? '', Validators.required],
        volume: [this.store.currentTank()?.volume ?? ''],
        // 旧数据可能没有 waterType:留空可保存,不逼人补填
        waterType: this.fb.nonNullable.control<WaterType | ''>(this.store.currentTank()?.waterType ?? ''),
        setupStyle: this.fb.nonNullable.control<SetupStyle | ''>(this.store.currentTank()?.setupStyle ?? ''),
        techLevel: this.fb.nonNullable.control<TechLevel | ''>(this.store.currentTank()?.techLevel ?? ''),
    });

    // dependent picklist,和 first-run 同一套规则
    private readonly waterType = toSignal(this.form.controls.waterType.valueChanges, {
        initialValue: this.form.controls.waterType.value,
    });
    readonly styleOptions = computed(() => setupStylesFor(this.waterType()));
    readonly showTechLevel = computed(() => techLevelApplies(this.waterType()));

    constructor() {
        this.form.controls.waterType.valueChanges.pipe(takeUntilDestroyed()).subscribe(wt => {
            const style = this.form.controls.setupStyle.value;
            if (style && !setupStylesFor(wt).some(o => o.value === style)) {
                this.form.controls.setupStyle.setValue('');
            }
            if (!techLevelApplies(wt)) this.form.controls.techLevel.setValue('');
        });
    }

    save(): void {
        if (this.form.invalid) return;
        this.store.updateTankDetails(this.form.getRawValue());
        this.close.emit();
    }

    readonly confirmingDelete = signal(false);

    deleteTank(): void {
        const id = this.store.currentTank()?.id;
        if (id) this.store.deleteTank(id);
        // 删完当前缸后 store 已切走(或没缸了回 first-run),弹窗跟着关
        this.close.emit();
    }
}
