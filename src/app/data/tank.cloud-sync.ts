import { Injectable, inject } from '@angular/core';
import { Tank } from '../domain/tank.model';
import { SUPABASE } from './supabase.client';
import { AuthService } from './auth.service';

const TABLE = 'tank_data';

// 云同步:把整份 Tank[] 当一条 JSONB 存/取(每个用户一行,主键 user_id)。
// 整份状态很小,一条 blob 足够 —— 不做关系建模,换来 push/pull 极简、RLS 极简。
// 冲突策略:last-write-wins。个人应用、轻量使用,够用;多设备并发编辑可能覆盖,已知取舍。
@Injectable({ providedIn: 'root' })
export class TankCloudSync {
    private readonly supabase = inject(SUPABASE);
    private readonly auth = inject(AuthService);

    /** 拉取当前用户的云端数据;无记录返回 null,未登录/未配置返回 undefined(表示"不适用") */
    async pull(): Promise<Tank[] | null | undefined> {
        const uid = this.auth.user()?.id;
        if (!this.supabase || !uid) return undefined;
        const { data, error } = await this.supabase
            .from(TABLE)
            .select('data')
            .eq('user_id', uid)
            .maybeSingle();
        if (error) {
            console.error('Cloud pull failed:', error.message);
            return undefined;
        }
        return (data?.data as Tank[] | undefined) ?? null;
    }

    /** 写回当前用户的云端数据(upsert)。未登录/未配置时静默跳过。 */
    async push(tanks: Tank[]): Promise<void> {
        const uid = this.auth.user()?.id;
        if (!this.supabase || !uid) return;
        const { error } = await this.supabase
            .from(TABLE)
            .upsert({ user_id: uid, data: tanks, updated_at: new Date().toISOString() });
        if (error) console.error('Cloud push failed:', error.message);
    }
}
