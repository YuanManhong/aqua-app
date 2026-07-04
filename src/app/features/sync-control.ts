import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../data/auth.service';

// 头部的云同步小控件:未登录显示 Google 登录按钮;已登录显示邮箱 + 登出。
// Supabase 未配置时整个控件不渲染。
@Component({
    selector: 'sync-control',
    template: `
    @if (auth.enabled) {
      @if (auth.user(); as user) {
        <div class="sync">
          <span class="sync-dot" title="Synced across devices"></span>
          <span class="sync-email">{{ user.email }}</span>
          <button class="sync-link" (click)="auth.signOut()">Sign out</button>
        </div>
      } @else {
        <div class="sync">
          <button class="sync-google" type="button" (click)="google()" [disabled]="busy()">
            <svg class="sync-google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z"/>
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.2 21.2 7.3 24 12 24z"/>
              <path fill="#FBBC05" d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.1 0 12s.4 3.6 1.2 5.2l3.9-2.9z"/>
              <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4L19 2.8C17 1 14.2 0 12 0 7.3 0 3.2 2.8 1.2 6.8l3.9 2.9c1-3 3.7-5.1 6.9-5.1z"/>
            </svg>
            {{ busy() ? 'Redirecting…' : 'Sync with Google' }}
          </button>
          @if (error(); as e) { <span class="sync-err">{{ e }}</span> }
        </div>
      }
    }
  `,
    styles: `
    .sync { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .sync-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .sync-email { color: #64748b; }
    .sync-err { color: #dc2626; }
    .sync-google {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      background: #fff; color: #334155; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .sync-google:disabled { color: #94a3b8; cursor: default; }
    .sync-google-icon { width: 14px; height: 14px; }
    .sync-link {
      background: none; border: none; color: #2563eb; cursor: pointer;
      font-size: 13px; font-weight: 600; padding: 4px 6px;
    }
    .sync-link:disabled { color: #94a3b8; cursor: default; }
  `,
})
export class SyncControl {
    readonly auth = inject(AuthService);

    readonly busy = signal(false);
    readonly error = signal<string | null>(null);

    async google(): Promise<void> {
        this.busy.set(true);
        this.error.set(null);
        const { error } = await this.auth.signInWithGoogle();
        // 成功时页面会跳转到 Google,不用复位 busy;失败才留在本页
        if (error) {
            this.busy.set(false);
            this.error.set(error);
        }
    }
}
