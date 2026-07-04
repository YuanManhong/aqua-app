import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../data/auth.service';

// 头部的云同步小控件:未登录显示邮箱输入 + 发送链接;已登录显示邮箱 + 登出。
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
      } @else if (sent()) {
        <div class="sync"><span class="sync-msg">✓ Check your email for a sign-in link</span></div>
      } @else {
        <form class="sync" (submit)="send($event)">
          <input class="sync-input" type="email" name="email" placeholder="you@email.com"
                 [value]="email()" (input)="email.set($any($event.target).value)" required />
          <button class="sync-link" type="submit" [disabled]="busy()">
            {{ busy() ? 'Sending…' : 'Sync' }}
          </button>
          @if (error(); as e) { <span class="sync-err">{{ e }}</span> }
        </form>
      }
    }
  `,
    styles: `
    .sync { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .sync-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
    .sync-email { color: #64748b; }
    .sync-msg { color: #16a34a; }
    .sync-err { color: #dc2626; }
    .sync-input {
      padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 13px; width: 160px;
    }
    .sync-link {
      background: none; border: none; color: #2563eb; cursor: pointer;
      font-size: 13px; font-weight: 600; padding: 4px 6px;
    }
    .sync-link:disabled { color: #94a3b8; cursor: default; }
  `,
})
export class SyncControl {
    readonly auth = inject(AuthService);

    readonly email = signal('');
    readonly busy = signal(false);
    readonly sent = signal(false);
    readonly error = signal<string | null>(null);

    async send(e: Event): Promise<void> {
        e.preventDefault();
        if (!this.email()) return;
        this.busy.set(true);
        this.error.set(null);
        const { error } = await this.auth.signIn(this.email().trim());
        this.busy.set(false);
        if (error) this.error.set(error);
        else this.sent.set(true);
    }
}
