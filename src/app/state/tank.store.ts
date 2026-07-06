import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AquaticPlant, Count, Livestock, Photo, Tank, WaterTest } from '../domain/tank.model';
import { ClassificationInput, normalizeClassification } from '../domain/tank-classification';
import {
    activeInhabitants,
    addCountEntry,
    addLivestock,
    addPhoto,
    addPlant,
    addWaterTest,
    clearDeparture,
    latestWaterTest,
    markDeparture,
    mergeCloudTanks,
    removePhoto,
    removeWaterTest,
    updateLivestock,
    updatePlant,
    updateWaterTest,
} from '../domain/tank.logic';
import { buildSampleTank } from '../domain/sample-tank';
import { newId } from '../domain/tank.model';
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

    readonly allTanks = this.tanks.asReadonly();
    readonly hasTanks = computed(() => this.tanks().length > 0);

    /** 云端水合完成的次数(只在登录/会话恢复后发生)。App 据此把多缸用户先带到总览页。 */
    readonly cloudHydrated = signal(0);

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

    /** 从云端拉取:与本地合并(不整份覆盖,避免丢掉登录前攒的本地缸);云端为空(首次登录)则把本地数据上传作为初始。 */
    private async hydrateFromCloud(): Promise<void> {
        const remote = await this.cloud.pull();
        if (remote === undefined) return; // 未登录/出错,保持本地不动
        if (remote === null) {
            this.cloud.push(this.tanks()); // 云端还没有数据 → 首次上传本地
            this.cloudHydrated.update(n => n + 1);
            return;
        }
        const merged = mergeCloudTanks(this.tanks(), remote);
        this.tanks.set(merged);
        // 合并进了本地独有的内容(新缸或缸内新记录)→ 补传上云;与云端一致则不回推,避免回声
        if (JSON.stringify(merged) !== JSON.stringify(remote)) this.cloud.push(merged);
        if (!this.tanks().some(t => t.id === this.selectedTankId())) {
            this.selectedTankId.set(this.tanks()[0]?.id ?? '');
        }
        this.cloudHydrated.update(n => n + 1);
    }

    /** 切到某个缸(overview 卡片点击);id 不存在则忽略。 */
    selectTank(id: string): void {
        if (this.tanks().some(t => t.id === id)) this.selectedTankId.set(id);
    }

    /** 新建一个空缸并选中它(首次使用的入口)。水体类型必填,风格/技术路线可留空。 */
    createTank(input: { name: string; startDate: string; volume?: string } & ClassificationInput): void {
        const tank: Tank = {
            id: newId(),
            name: input.name.trim(),
            startDate: input.startDate,
            ...(input.volume?.trim() ? { volume: input.volume.trim() } : {}),
            ...normalizeClassification(input),
            waterTests: [],
            livestock: [],
            aquaticPlants: [],
        };
        this.addTank(tank);
    }

    /** 编辑当前缸的基本信息与分类标签。分类是描述性标签,缸会演变(裸缸种草、low-tech 上 CO2),改了没有数据完整性问题。 */
    updateTankDetails(input: { name: string; startDate: string; volume?: string } & ClassificationInput): void {
        this.updateCurrentTank(tank => {
            // 先剥掉旧的可选字段:清空(如改水体后 style 失效)时不能残留旧值
            const { volume: _v, waterType: _w, setupStyle: _s, techLevel: _t, ...rest } = tank;
            return {
                ...rest,
                name: input.name.trim(),
                startDate: input.startDate,
                ...(input.volume?.trim() ? { volume: input.volume.trim() } : {}),
                ...normalizeClassification(input),
            };
        });
    }

    /** 加载预填的示例缸(约 3 个月数据)并选中它。 */
    loadSampleTank(): void {
        this.addTank(buildSampleTank());
    }

    /** 删除所有示例缸。删完若没有缸了,app.html 自动切回 first-run。 */
    clearSampleTank(): void {
        this.removeTanks(t => !!t.isSample);
    }

    /** 删除一个缸及其全部记录(不可恢复)。删完没缸了回 first-run;否则选中剩下的第一个。 */
    deleteTank(id: string): void {
        this.removeTanks(t => t.id === id);
    }

    private removeTanks(shouldRemove: (tank: Tank) => boolean): void {
        this.tanks.update(tanks => tanks.filter(t => !shouldRemove(t)));
        if (!this.tanks().some(t => t.id === this.selectedTankId())) {
            this.selectedTankId.set(this.tanks()[0]?.id ?? '');
        }
        this.cloud.push(this.tanks());
    }

    private addTank(tank: Tank): void {
        this.tanks.update(tanks => [...tanks, tank]);
        this.selectedTankId.set(tank.id);
        this.cloud.push(this.tanks()); // 与 updateCurrentTank 一致:本地 effect 落盘,云端尽力而为
    }

    addWaterTest(test: WaterTest): void {
        this.updateCurrentTank(tank => addWaterTest(tank, test));
    }

    updateWaterTest(test: WaterTest): void {
        this.updateCurrentTank(tank => updateWaterTest(tank, test));
    }

    removeWaterTest(id: string): void {
        this.updateCurrentTank(tank => removeWaterTest(tank, id));
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

    addPhoto(photo: Photo): void {
        this.updateCurrentTank(tank => addPhoto(tank, photo));
    }

    removePhoto(id: string): void {
        this.updateCurrentTank(tank => removePhoto(tank, id));
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
