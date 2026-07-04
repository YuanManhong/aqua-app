// Supabase 连接配置。
// anon key 是公开密钥,设计上就能安全放进前端 —— 真正的数据保护靠数据库的 RLS 策略,
// 不是靠藏这个 key(见 supabase.schema.sql)。所以提交进 git 没问题。
//
// 填法:登录 https://supabase.com → 你的项目 → Settings → API,
// 把 "Project URL" 和 "anon public" key 粘到下面。
export const SUPABASE_CONFIG = {
    url: 'https://jickydxrozvucvuphgab.supabase.co',
    anonKey: 'sb_publishable__JAaUOXcTd43ZoRBf5U5Hg_dTElqp4c',
};

/** 是否已填入真实配置(占位符还在时,云同步整体关闭,app 退化为纯 localStorage) */
export function isSupabaseConfigured(): boolean {
    return !SUPABASE_CONFIG.url.includes('YOUR-PROJECT') && !SUPABASE_CONFIG.anonKey.includes('YOUR-ANON');
}
