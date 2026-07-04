import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Tank } from '../domain/tank.model';
import { activityLog } from '../domain/tank.logic';
import { CATEGORY_COLORS, hexToRgba } from './ui/tokens';

interface EventRow {
    date: string;
    title: string;
    detail?: string;
    color: string;
    ring: string;
    notLast: boolean;
}

// 活动时间线:从 activityLog(tank) 派生,最新在前。纯展示。
@Component({
    selector: 'activity-log',
    imports: [DatePipe],
    template: `
    <section class="card">
      <div class="head">
        <h2>Activity log</h2>
        <span class="count">Recent {{ rows().length }}</span>
      </div>
      <div>
        @for (ev of rows(); track $index) {
          <div class="row">
            <div class="rail">
              <span class="dot" [style.background]="ev.color" [style.box-shadow]="'0 0 0 3px ' + ev.ring"></span>
              @if (ev.notLast) { <span class="line"></span> }
            </div>
            <div class="body">
              <div class="title-row">
                <span class="title">{{ ev.title }}</span>
                <span class="date">{{ ev.date | date: 'MMM d' }}</span>
              </div>
              @if (ev.detail) { <span class="detail">{{ ev.detail }}</span> }
            </div>
          </div>
        }
      </div>
    </section>
  `,
    styles: `
    .card {
      background: #fff; border: 1px solid #dcecec; border-radius: 8px;
      padding: 22px 24px 12px; box-shadow: 0 1px 2px rgba(18,49,47,0.04);
    }
    .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 22px; margin: 0; color: #0f2e2c; }
    .count { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #8aa19f; }
    .row { display: grid; grid-template-columns: 16px 1fr; gap: 13px; }
    .rail { display: flex; flex-direction: column; align-items: center; }
    .dot { width: 13px; height: 13px; border-radius: 50%; margin-top: 3px; flex: 0 0 auto; }
    .line { width: 2px; flex: 1 1 auto; min-height: 14px; background: #e8eeee; margin: 4px 0 0; }
    .body { padding-bottom: 18px; min-width: 0; }
    .title-row { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    .title { font-size: 14px; font-weight: 600; color: #12312f; line-height: 1.3; }
    .date { font-size: 12px; font-weight: 600; color: #8aa19f; white-space: nowrap; }
    .detail { display: block; margin-top: 3px; font-size: 12.5px; color: #7d9391; line-height: 1.35; }
  `,
})
export class ActivityLog {
    readonly tank = input.required<Tank>();

    readonly rows = computed<EventRow[]>(() => {
        const events = activityLog(this.tank());
        return events.map((e, i) => {
            const color = e.color ?? CATEGORY_COLORS[e.category];
            return {
                date: e.date,
                title: e.title,
                detail: e.detail,
                color,
                ring: hexToRgba(color, 0.16),
                notLast: i < events.length - 1,
            };
        });
    });
}
