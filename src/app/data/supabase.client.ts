import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from './supabase.config';

// 单例 Supabase 客户端,作为 DI token 注入。
// 未配置时为 null —— 下游据此关闭所有云功能,不报错。
export const SUPABASE = new InjectionToken<SupabaseClient | null>('SUPABASE_CLIENT', {
    providedIn: 'root',
    factory: () => {
        if (!isSupabaseConfigured()) return null;
        return createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: true, // 会话存 localStorage,刷新不用重新登录
                autoRefreshToken: true,
                detectSessionInUrl: true, // magic-link 回跳后自动读取 URL 里的会话
            },
        });
    },
});
