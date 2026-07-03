import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WaterTest } from '../../domain/tank.model';
import { formatValueRange } from '../../domain/tank.logic';
import { WATER_PARAMS } from './water-params';

// 纯展示组件:只有 input,不注入任何 service
@Component({
    selector: 'water-test-card',
    imports: [DatePipe],
    template: `
    <div class="card">
      <p class="card-date">{{ test().date | date }}</p>
      <dl class="param-grid">
        @for (param of params; track param.key) {
          @if (test()[param.key] !== undefined) {
            <dt>{{ param.label }}</dt>
            <dd>{{ format(test()[param.key]) }}</dd>
          }
        }
      </dl>
      @if (test().note) {
        <p class="card-note">{{ test().note }}</p>
      }
    </div>
  `,
    styles: `
    .card-date { font-weight: 600; margin: 0 0 0.5rem; }
    .param-grid {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 1rem;
      margin: 0;
    }
    .param-grid dt { color: #666; }
    .param-grid dd { margin: 0; }
    .card-note { color: #666; font-style: italic; margin: 0.5rem 0 0; }
  `,
})
export class WaterTestCard {
    readonly test = input.required<WaterTest>();
    readonly params = WATER_PARAMS;
    readonly format = formatValueRange;
}
