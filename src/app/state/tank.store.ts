import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AquaticPlant, Count, Livestock, Tank, WaterTest } from '../domain/tank.model';
import {
    activeInhabitants,
    addCountEntry,
    addLivestock,
    addPlant,
    addWaterTest,
    clearDeparture,
    latestWaterTest,
    markDeparture,
    updateLivestock,
    updatePlant,
} from '../domain/tank.logic';
import { TankRepository } from '../data/tank.repository';
import { TankCloudSync } from '../data/tank.cloud-sync';
import { AuthService } from '../data/auth.service';

// 状态层:唯一数据源。组件不直接改数据,只调这里的方法;
// 所有变更走 domain 的不可变更新函数,repository 只在这里被触碰。
//
// 存储采用 local-first:localStorage 是同步缓存(秒开、离线可用),Supabase 叠在上面做跨设备同步。
// 未登录时行为和以前完全一致;登录后:进入时从云端拉取覆盖本地,之后每次改动写回云端。
@Injectable({ providedIn: 'root' })
export class TankStore {
    private readonly repository = inject(TankRepository);
    private readonly cloud = inject(TankCloudSync);
    private readonly auth = inject(AuthService);

    private readonly tanks = signal<Tank[]>(this.repository.loadAll());
    readonly selectedTankId = signal<string>(this.tanks()[0]?.id ?? '');

    readonly currentTank = computed<Tank | undefined>(() =>
        this.tanks().find(t => t.id === this.selectedTankId()),
    );
    readonly latestTest = computed(() => {
        const tank = this.currentTank();
        return tank ? latestWaterTest(tank) : undefined;
    });
    readonly activeInhabitants = computed(() => {
        const tank = this.currentTank();
        return tank ? activeInhabitants(tank) : { aquaticPlants: [], livestock: [] };
    });

    constructor() {
        // tanks 一变就落盘本地 → "刷新不丢"
        effect(() => this.repository.saveAll(this.tanks()));

        // 登录状态一变(含首次加载恢复会话、magic-link 回跳)就从云端水合。
        // untracked:只 react user 的变化,别把内部对 tanks 的读写也纳入依赖。
        effect(() => {
            const user = this.auth.user();
            if (user) untracked(() => this.hydrateFromCloud());
        });
    }

    /** 从云端拉取:有记录则覆盖本地;云端为空(首次登录)则把本地数据上传作为初始。 */
    private async hydrateFromCloud(): Promise<void> {
        const remote = await this.cloud.pull();
        if (remote === undefined) return; // 未登录/出错,保持本地不动
        if (remote === null) {
            this.cloud.push(this.tanks()); // 云端还没有数据 → 首次上传本地
            return;
        }
        this.tanks.set(remote); // 云端有数据 → 以云端为准(不回推,避免回声)
        if (!this.tanks().some(t => t.id === this.selectedTankId())) {
            this.selectedTankId.set(this.tanks()[0]?.id ?? '');
        }
    }

    addWaterTest(test: WaterTest): void {
        this.updateCurrentTank(tank => addWaterTest(tank, test));
    }

    addLivestock(item: Livestock): void {
        this.updateCurrentTank(tank => addLivestock(tank, item));
    }

    addPlant(item: AquaticPlant): void {
        this.updateCurrentTank(tank => addPlant(tank, item));
    }

    addLivestockCount(id: string, count: Count): void {
        this.updateCurrentTank(tank => updateLivestock(tank, id, item => addCountEntry(item, count)));
    }

    addPlantCount(id: string, count: Count): void {
        this.updateCurrentTank(tank => updatePlant(tank, id, item => addCountEntry(item, count)));
    }

    markLivestockDeparture(id: string, date: string): void {
        this.updateCurrentTank(tank => updateLivestock(tank, id, item => markDeparture(item, date)));
    }

    markPlantDeparture(id: string, date: string): void {
        this.updateCurrentTank(tank => updatePlant(tank, id, item => markDeparture(item, date)));
    }

    returnLivestock(id: string): void {
        this.updateCurrentTank(tank => updateLivestock(tank, id, clearDeparture));
    }

    returnPlant(id: string): void {
        this.updateCurrentTank(tank => updatePlant(tank, id, clearDeparture));
    }

    private updateCurrentTank(fn: (tank: Tank) => Tank): void {
        const id = this.selectedTankId();
        this.tanks.update(tanks => tanks.map(t => (t.id === id ? fn(t) : t)));
        this.cloud.push(this.tanks()); // 本地改动写回云端(未登录时静默 no-op)
    }
}
