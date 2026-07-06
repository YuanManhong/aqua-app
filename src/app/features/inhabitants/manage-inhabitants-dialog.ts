import { Component, computed, inject, output, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { AquaticPlant, Livestock, todayISO } from '../../domain/tank.model';
import { currentCount } from '../../domain/tank.logic';
import { TankStore } from '../../state/tank.store';
import { PLANT_COLOR } from '../ui/tokens';
import { Modal } from '../ui/modal';
import { InhabitantForm } from './inhabitant-form';

interface Row {
    id: string;
    species: string;
    onBoardDate: string;
    dotColor: string;
    isPlant: boolean;
    current: number;
    display: number;
    changed: boolean;
}

interface DepartedRow {
    id: string;
    species: string;
    departureDate: string;
    isPlant: boolean;
}

// Manage inhabitants 弹窗:默认展示当前列表,标题栏 + 按钮切到新增表单。
// stepper 是本地草稿;Save 才落库。直接注入 store 做增改。
@Component({
    selector: 'manage-inhabitants-dialog',
    imports: [DatePipe, NgTemplateOutlet, Modal, InhabitantForm],
    template: `
    <ui-modal (close)="close.emit()">
      <div class="head">
        <div>
          <h2>Manage inhabitants</h2>
          <p class="sub">{{ tankName() }} · update counts, add, or mark departed</p>
        </div>
        <div class="head-actions">
          @if (tab() === 'manage') {
            <button class="x add" (click)="tab.set('add')" aria-label="Add inhabitant">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          }
          <button class="x" (click)="close.emit()" aria-label="Close">✕</button>
        </div>
      </div>

      @if (tab() === 'manage') {
        <div class="scroll">
          @if (livestock().length) {
            <div class="group">Livestock</div>
            @for (r of livestock(); track r.id) {
              <ng-container [ngTemplateOutlet]="rowTpl" [ngTemplateOutletContext]="{ $implicit: r }" />
            }
          }
          @if (plants().length) {
            <div class="group">Plants</div>
            @for (r of plants(); track r.id) {
              <ng-container [ngTemplateOutlet]="rowTpl" [ngTemplateOutletContext]="{ $implicit: r }" />
            }
          }
          @if (departed().length) {
            <div class="group muted">Departed</div>
            @for (r of departed(); track r.id) {
              <div class="drow">
                <span class="ddot"></span>
                <div class="dinfo">
                  <div class="dname">{{ r.species }}</div>
                  <div class="dsub">Departed {{ r.departureDate | date: 'MMM d' }}</div>
                </div>
                <button class="btn-return" (click)="onReturn(r)">Return</button>
              </div>
            }
          }
          @if (!livestock().length && !plants().length && !departed().length) {
            <div class="empty">
              <div>No inhabitants yet.</div>
              <button class="btn-outline" (click)="tab.set('add')">Add your first</button>
            </div>
          }
        </div>
      } @else {
        <inhabitant-form (saved)="tab.set('manage')" (cancel)="tab.set('manage')" />
      }
    </ui-modal>

    <ng-template #rowTpl let-r>
      <div class="row">
        <span class="dot" [style.background]="r.dotColor"></span>
        <div class="info">
          <div class="name">{{ r.species }}</div>
          <div class="since">Since {{ r.onBoardDate | date: 'MMM d' }}</div>
        </div>
        <div class="stepper">
          <button (click)="step(r, -1)">−</button>
          <span class="cnt">{{ r.display }}</span>
          <button (click)="step(r, 1)">+</button>
        </div>
        @if (r.changed) {
          <button class="btn-save" (click)="onSave(r)">Save</button>
        }
        <button class="btn-depart" (click)="onDepart(r)">Depart</button>
      </div>
    </ng-template>
  `,
    styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 6px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 26px; margin: 0; color: #0f2e2c; }
    .sub { margin: 4px 0 0; font-size: 13px; color: #7d9391; }
    .x { border: 1px solid #dcecec; background: #f7fafa; width: 34px; height: 34px; border-radius: 8px; font-size: 18px; color: #5a7371; cursor: pointer; line-height: 1; flex: 0 0 auto; }
    .x:hover { background: #eef2f2; }
    .head-actions { display: flex; gap: 8px; flex: 0 0 auto; }
    .x.add { color: #0f8a8d; font-size: 20px; font-weight: 400; }
    .scroll { margin-top: 8px; max-height: 54vh; overflow: auto; }
    .group { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8aa19f; margin: 16px 0 0; }
    .group:first-child { margin-top: 8px; }
    .group.muted { color: #b0a08f; }
    .row { display: flex; align-items: center; gap: 11px; padding: 11px 0; border-bottom: 1px solid #f0f4f4; }
    .dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 auto; }
    .info { flex: 1 1 0; min-width: 0; }
    .name { font-size: 14.5px; font-weight: 600; color: #12312f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .since { font-size: 12px; color: #8aa19f; }
    .stepper { display: flex; align-items: stretch; border: 1px solid #d3e0e0; border-radius: 8px; overflow: hidden; height: 32px; flex: 0 0 auto; }
    .stepper button { appearance: none; border: none; background: #f4f8f8; color: #2c4f4d; width: 30px; font-size: 18px; line-height: 1; cursor: pointer; }
    .stepper button:hover { background: #e6efef; }
    .cnt { min-width: 36px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-feature-settings: 'tnum'; color: #12312f; border-left: 1px solid #e4ecec; border-right: 1px solid #e4ecec; }
    .btn-save { appearance: none; border: none; background: #0f8a8d; color: #fff; font: inherit; font-weight: 700; font-size: 12.5px; padding: 8px 12px; border-radius: 7px; cursor: pointer; white-space: nowrap; flex: 0 0 auto; }
    .btn-save:hover { filter: brightness(1.06); }
    .btn-depart { appearance: none; border: 1px solid #efd9d1; background: #fff; color: #b0785f; font: inherit; font-weight: 600; font-size: 12.5px; padding: 8px 11px; border-radius: 7px; cursor: pointer; white-space: nowrap; flex: 0 0 auto; }
    .btn-depart:hover { background: #fbf1ee; }
    .drow { display: flex; align-items: center; gap: 11px; padding: 10px 0; border-bottom: 1px solid #f5f2ee; }
    .ddot { width: 11px; height: 11px; border-radius: 50%; background: #dfe6e5; flex: 0 0 auto; }
    .dinfo { flex: 1 1 0; min-width: 0; }
    .dname { font-size: 14px; font-weight: 600; color: #9aacaa; text-decoration: line-through; }
    .dsub { font-size: 12px; color: #b0a08f; }
    .btn-return { appearance: none; border: 1px solid #dcecec; background: #fff; color: #5a7371; font: inherit; font-weight: 600; font-size: 12.5px; padding: 8px 12px; border-radius: 7px; cursor: pointer; white-space: nowrap; flex: 0 0 auto; }
    .btn-return:hover { background: #f7fafa; }
    .empty { text-align: center; padding: 28px 0 22px; color: #9aacaa; }
    .btn-outline { margin-top: 12px; appearance: none; border: 1px solid #0f8a8d; background: #fff; color: #0f8a8d; font: inherit; font-weight: 700; font-size: 13.5px; padding: 9px 16px; border-radius: 8px; cursor: pointer; }
  `,
})
export class ManageInhabitantsDialog {
    private readonly store = inject(TankStore);

    readonly close = output<void>();
    readonly tab = signal<'manage' | 'add'>('manage');
    private readonly drafts = signal<Record<string, number>>({});

    readonly tankName = computed(() => this.store.currentTank()?.name ?? '');

    readonly livestock = computed<Row[]>(() =>
        this.store.activeInhabitants().livestock.map(i => this.toRow(i, false)),
    );
    readonly plants = computed<Row[]>(() =>
        this.store.activeInhabitants().aquaticPlants.map(i => this.toRow(i, true)),
    );
    readonly departed = computed<DepartedRow[]>(() => {
        const tank = this.store.currentTank();
        if (!tank) return [];
        const all: DepartedRow[] = [
            ...(tank.livestock ?? []).filter(i => i.departureDate).map(i => this.toDeparted(i, false)),
            ...(tank.aquaticPlants ?? []).filter(i => i.departureDate).map(i => this.toDeparted(i, true)),
        ];
        return all.sort((a, b) => b.departureDate.localeCompare(a.departureDate));
    });

    private toRow(item: Livestock | AquaticPlant, isPlant: boolean): Row {
        const current = currentCount(item);
        const draft = this.drafts()[item.id];
        const display = draft ?? current;
        return {
            id: item.id,
            species: item.species,
            onBoardDate: item.onBoardDate ?? item.countHistory[0]?.date ?? '',
            dotColor: isPlant ? PLANT_COLOR : (item as Livestock).color || '#c0392b',
            isPlant,
            current,
            display,
            changed: draft !== undefined && draft !== current,
        };
    }

    private toDeparted(item: Livestock | AquaticPlant, isPlant: boolean): DepartedRow {
        return { id: item.id, species: item.species, departureDate: item.departureDate!, isPlant };
    }

    step(r: Row, delta: number): void {
        const base = this.drafts()[r.id] ?? r.current;
        const next = Math.max(0, base + delta);
        this.drafts.update(d => ({ ...d, [r.id]: next }));
    }

    onSave(r: Row): void {
        const draft = this.drafts()[r.id];
        if (draft === undefined || draft === r.current) return;
        const count = { date: todayISO(), count: draft };
        if (r.isPlant) this.store.addPlantCount(r.id, count);
        else this.store.addLivestockCount(r.id, count);
        this.clearDraft(r.id);
    }

    onDepart(r: Row): void {
        if (r.isPlant) this.store.markPlantDeparture(r.id, todayISO());
        else this.store.markLivestockDeparture(r.id, todayISO());
        this.clearDraft(r.id);
    }

    onReturn(r: DepartedRow): void {
        if (r.isPlant) this.store.returnPlant(r.id);
        else this.store.returnLivestock(r.id);
    }

    private clearDraft(id: string): void {
        this.drafts.update(d => {
            const { [id]: _, ...rest } = d;
            return rest;
        });
    }
}
