import { Component, output } from '@angular/core';

// 通用弹窗外壳:半透明背景 + 居中对话框 + 进场动画。
// 点背景关闭;点对话框内部不冒泡。内容用 <ng-content> 投影。
@Component({
    selector: 'ui-modal',
    template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
    styles: `
    @keyframes aq-backdrop { from { opacity: 0; } to { opacity: 1; } }
    @keyframes aq-pop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
    .backdrop {
      position: fixed; inset: 0; background: rgba(12,38,36,0.42); backdrop-filter: blur(3px);
      display: flex; align-items: flex-start; justify-content: center; padding: 48px 20px;
      z-index: 50; animation: aq-backdrop 0.16s ease; overflow: auto;
    }
    .dialog {
      width: 100%; max-width: 560px; background: #fff; border-radius: 12px;
      padding: 26px 28px 28px; box-shadow: 0 30px 80px rgba(12,38,36,0.3);
      animation: aq-pop 0.22s cubic-bezier(0.2,0.8,0.3,1);
    }
  `,
})
export class Modal {
    readonly close = output<void>();
}
