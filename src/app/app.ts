import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TankStore } from './state/tank.store';
import { currentCount } from './domain/tank.logic';
import { PLANT_COLOR } from './features/ui/tokens';
import { Modal } from './features/ui/modal';
import { WaterTestCard } from './features/water-test/water-test-card';
import { WaterTestForm } from './features/water-test/water-test-form';
import { WaterTestTrend } from './features/water-test/water-test-trend';
import { ActivityLog } from './features/activity-log';
import { ManageInhabitantsDialog } from './features/inhabitants/manage-inhabitants-dialog';

interface Chip {
    species: string;
    countLabel: string;
    dotColor: string;
}

// Dashboard 容器:注入 store、组织展示数据;弹窗开关是本地 state。
@Component({
    selector: 'app-root',
    imports: [DatePipe, Modal, WaterTestCard, WaterTestForm, WaterTestTrend, ActivityLog, ManageInhabitantsDialog],
    templateUrl: './app.html',
    styleUrl: './app.css',
})
export class App {
    readonly store = inject(TankStore);

    readonly addTestOpen = signal(false);
    readonly manageOpen = signal(false);

    readonly daysIn = computed(() => {
        const tank = this.store.currentTank();
        if (!tank) return 0;
        return Math.max(0, Math.round((Date.now() - Date.parse(tank.startDate + 'T00:00:00')) / 86400000));
    });

    readonly livestockChips = computed<Chip[]>(() =>
        this.store.activeInhabitants().livestock.map(i => ({
            species: i.species,
            countLabel: '×' + currentCount(i),
            dotColor: i.color || '#c0392b',
        })),
    );

    readonly plantChips = computed<Chip[]>(() =>
        this.store.activeInhabitants().aquaticPlants.map(i => ({
            species: i.species,
            countLabel: '×' + currentCount(i),
            dotColor: PLANT_COLOR,
        })),
    );
}
