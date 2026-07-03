import { Component, computed, input } from '@angular/core';
import { WaterTest } from '../../domain/tank.model';
import { WaterTestCard } from './water-test-card';

// 历史记录:按日期倒序(最新在前)
@Component({
    selector: 'water-test-list',
    imports: [WaterTestCard],
    template: `
    @for (test of newestFirst(); track test.id) {
      <water-test-card [test]="test" />
    } @empty {
      <p>No water tests yet.</p>
    }
  `,
    styles: `
    :host { display: flex; flex-direction: column; gap: 0.75rem; }
  `,
})
export class WaterTestList {
    readonly tests = input.required<WaterTest[]>();
    readonly newestFirst = computed(() => [...this.tests()].reverse());
}
