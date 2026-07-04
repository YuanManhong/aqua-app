import { Injectable, computed, effect, inject, signal } from '@angular/core';
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

// 状态层:唯一数据源。组件不直接改数据,只调这里的方法;
// 所有变更走 domain 的不可变更新函数,repository 只在这里被触碰。
@Injectable({ providedIn: 'root' })
export class TankStore {
    private readonly repository = inject(TankRepository);

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
        // tanks 一变就落盘 → "刷新不丢"
        effect(() => this.repository.saveAll(this.tanks()));
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
    }
}
