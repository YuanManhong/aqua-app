import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AquaticPlant, Livestock } from '../../domain/tank.model';
import { currentCount } from '../../domain/tank.logic';
import { CountForm } from './count-form';

// 展示组件:列出生物或水草,动作通过 output 上抛,由 Dashboard 调 store。
// 一次只展开一个 count-form(openCountId)。
@Component({
    selector: 'inhabitant-list',
    imports: [DatePipe, CountForm],
    template: `
    @for (item of items(); track item.id) {
      <div class="row" [class.departed]="!!item.departureDate">
        <div class="summary">
          <strong>{{ item.species }}</strong>
          @if (livestockOf(item); as ls) {
            <span class="meta">{{ ls.color }} · {{ ls.kind }}</span>
          }
          <span class="meta">count: {{ currentCount(item) }}</span>
          <span class="meta">since {{ item.onBoardDate | date }}</span>
          @if (item.departureDate) {
            <span class="badge">left {{ item.departureDate | date }}</span>
          } @else {
            <span class="actions">
              <button (click)="toggleCountForm(item.id)">Update count</button>
              <button (click)="depart.emit(item.id)">Mark departed</button>
            </span>
          }
        </div>

        @if (openCountId() === item.id) {
          <count-form (save)="onSaveCount(item.id, $event)" (cancel)="openCountId.set(null)" />
        }

        @if (item.countHistory.length > 1) {
          <details>
            <summary>Count history ({{ item.countHistory.length }})</summary>
            <ul>
              @for (entry of item.countHistory; track $index) {
                <li>
                  {{ entry.date | date }} — {{ entry.count }}
                  @if (entry.reason) { <span class="meta">({{ entry.reason }})</span> }
                </li>
              }
            </ul>
          </details>
        }
      </div>
    } @empty {
      <p class="meta">Nothing here yet.</p>
    }
  `,
    styles: `
    :host { display: flex; flex-direction: column; gap: 0.5rem; }
    .row { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    .row.departed { opacity: 0.55; }
    .summary { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .meta { color: #666; font-size: 0.9em; }
    .badge { background: #eee; border-radius: 4px; padding: 0 0.4rem; font-size: 0.85em; }
    .actions { display: flex; gap: 0.5rem; margin-left: auto; }
    details { margin-top: 0.25rem; }
    details summary { cursor: pointer; color: #666; font-size: 0.9em; }
    ul { margin: 0.25rem 0 0; padding-left: 1.25rem; }
  `,
})
export class InhabitantList {
    readonly items = input.required<(Livestock | AquaticPlant)[]>();

    readonly addCount = output<{ id: string; count: number; reason?: string }>();
    readonly depart = output<string>();

    readonly openCountId = signal<string | null>(null);
    readonly currentCount = currentCount;

    // 模板里没法用 `in` 做类型收窄,用这个 helper 区分 Livestock
    livestockOf(item: Livestock | AquaticPlant): Livestock | null {
        return 'kind' in item ? item : null;
    }

    toggleCountForm(id: string): void {
        this.openCountId.update(open => (open === id ? null : id));
    }

    onSaveCount(id: string, payload: { count: number; reason?: string }): void {
        this.addCount.emit({ id, ...payload });
        this.openCountId.set(null);
    }
}
