import { Injectable, inject, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SUPABASE } from './supabase.client';

// 认证:邮箱 magic-link(无密码)。
// user() 是全局登录状态,store 和 UI 都 react 它。
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly supabase = inject(SUPABASE);

    /** 当前登录用户;未登录或未配置 Supabase 时为 null */
    readonly user = signal<User | null>(null);
    /** Supabase 是否可用(已填配置) */
    readonly enabled = this.supabase !== null;

    constructor() {
        if (!this.supabase) return;
        // 恢复已有会话 + 监听登录/登出(magic-link 回跳也走这里)
        this.supabase.auth.getSession().then(({ data }) => this.user.set(data.session?.user ?? null));
        this.supabase.auth.onAuthStateChange((_event, session) => this.user.set(session?.user ?? null));
    }

    /** 发送登录链接到邮箱。用户点邮件里的链接后回跳本站即完成登录。 */
    async signIn(email: string): Promise<{ error: string | null }> {
        if (!this.supabase) return { error: 'Cloud sync not configured' };
        const { error } = await this.supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        return { error: error?.message ?? null };
    }

    async signOut(): Promise<void> {
        await this.supabase?.auth.signOut();
    }
}
