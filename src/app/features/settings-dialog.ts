import { Component, inject, output } from '@angular/core';
import { Modal } from './ui/modal';
import { SettingsStore } from '../state/settings.store';

// 设置弹窗:设备级偏好,目前只有 GH/KH 硬度单位。
// 入口按缸数分流(多缸 → 总览页,单缸 → 缸页),弹窗本身两边共用。
@Component({
    selector: 'settings-dialog',
    imports: [Modal],
    template: `
    <ui-modal (close)="close.emit()">
      <div class="head">
        <div>
          <h2>Settings</h2>
          <p class="sub">Applies everywhere on this device</p>
        </div>
        <button class="x" (click)="close.emit()" aria-label="Close">✕</button>
      </div>

      <div class="sec-label">Units</div>
      <div class="sec">
        <h3 class="sec-title">GH &amp; KH hardness</h3>
        <p class="sec-sub">Entry, tiles, trend, history &amp; exports</p>
        <div class="segmented" role="radiogroup" aria-label="GH and KH hardness unit">
          <button
            type="button" role="radio"
            [attr.aria-checked]="settings.hardnessUnit() === 'degrees'"
            [class.active]="settings.hardnessUnit() === 'degrees'"
            (click)="settings.setHardnessUnit('degrees')"
          >dGH / dKH</button>
          <button
            type="button" role="radio"
            [attr.aria-checked]="settings.hardnessUnit() === 'ppm'"
            [class.active]="settings.hardnessUnit() === 'ppm'"
            (click)="settings.setHardnessUnit('ppm')"
          >ppm CaCO₃</button>
        </div>
        <p class="note">1 dGH ≈ 17.85 ppm CaCO₃. Readings are stored once and converted for display — switching units never changes your data.</p>
      </div>
    </ui-modal>
  `,
    styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    h2 { font-family: 'Newsreader', serif; font-weight: 500; font-size: 28px; margin: 0 0 4px; color: #0f2e2c; }
    .sub { margin: 0; font-size: 13.5px; color: #7d9391; }
    .x {
      appearance: none; border: 1px solid #dcecec; background: #f7fafa; width: 34px; height: 34px;
      border-radius: 8px; font-size: 15px; color: #5a7371; cursor: pointer; line-height: 1; flex: 0 0 auto;
    }
    .x:hover { background: #eef2f2; }

    .sec-label {
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      color: #8aa19f; margin-bottom: 9px;
    }
    .sec { border: 1px solid #e4ecec; border-radius: 12px; padding: 18px 20px 16px; }
    .sec-title { margin: 0 0 3px; font-size: 16px; font-weight: 700; color: #12312f; letter-spacing: -0.01em; }
    .sec-sub { margin: 0 0 14px; font-size: 13.5px; color: #7d9391; }

    .segmented {
      display: inline-flex; background: #eef2f2; border-radius: 11px; padding: 4px; gap: 2px;
    }
    .segmented button {
      appearance: none; border: none; background: transparent; border-radius: 8px;
      font: inherit; font-size: 14.5px; font-weight: 700; color: #5a7371;
      padding: 9px 20px; cursor: pointer; white-space: nowrap;
    }
    .segmented button:hover { color: #2c4f4d; }
    .segmented button.active {
      background: #fff; color: #0f8a8d;
      box-shadow: 0 1px 4px rgba(18, 49, 47, 0.14);
    }

    .note { margin: 13px 0 0; font-size: 13px; line-height: 1.55; color: #a3b6b4; }
  `,
})
export class SettingsDialog {
    readonly settings = inject(SettingsStore);
    readonly close = output<void>();
}
