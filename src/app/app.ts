import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TankStore } from './state/tank.store';
import { AuthService } from './data/auth.service';
import { WaterTest } from './domain/tank.model';
import { currentCount } from './domain/tank.logic';
import { classificationLabel } from './domain/tank-classification';
import { PLANT_COLOR } from './features/ui/tokens';
import { Modal } from './features/ui/modal';
import { WaterTestCard } from './features/water-test/water-test-card';
import { WaterTestForm } from './features/water-test/water-test-form';
import { TestHistoryDialog } from './features/water-test/test-history-dialog';
import { WaterTestTrend } from './features/water-test/water-test-trend';
import { ActivityLog } from './features/activity-log';
import { ManageInhabitantsDialog } from './features/inhabitants/manage-inhabitants-dialog';
import { FirstRun } from './features/first-run';
import { EditTankDialog } from './features/edit-tank-dialog';
import { SettingsDialog } from './features/settings-dialog';
import { TankGallery } from './features/gallery/tank-gallery';
import { TankOverview } from './features/tank-overview/tank-overview';

interface Chip {
    species: string;
    countLabel: string;
    dotColor: string;
}

// Dashboard 容器:注入 store、组织展示数据;弹窗开关是本地 state。
@Component({
    selector: 'app-root',
    imports: [DatePipe, Modal, WaterTestCard, WaterTestForm, TestHistoryDialog, WaterTestTrend, ActivityLog, ManageInhabitantsDialog, FirstRun, EditTankDialog, SettingsDialog, TankGallery, TankOverview],
    templateUrl: './app.html',
    styleUrl: './app.css',
})
export class App {
    readonly store = inject(TankStore);
    private readonly auth = inject(AuthService);

    // 示例缸横幅按钮文案:未登录时提示"登录后才能建自己的缸"(点击都是清掉示例缸,
    // 回到 first-run;那边按登录态给登录页或建缸表单)。
    readonly needsSignIn = computed(() => this.auth.enabled && !this.auth.user());

    readonly addTestOpen = signal(false);
    // 正在编辑的水质记录(从 history 弹窗点铅笔进来);和 addTestOpen 共用同一个表单弹窗
    readonly editingTest = signal<WaterTest | undefined>(undefined);
    readonly manageOpen = signal(false);
    readonly editTankOpen = signal(false);
    readonly historyOpen = signal(false);
    // 设置入口按缸数分流:多缸 → 总览页齿轮,单缸 → 缸页齿轮;弹窗全局只有一个。
    readonly settingsOpen = signal(false);

    // 多缸总览:有 2+ 个缸时作为落地页(有东西可分诊才值得先看总览);单缸直接进 dashboard。
    readonly overviewOpen = signal(this.store.allTanks().length > 1);
    // 加缸流程:复用 first-run 全屏表单(带 "← Back to tanks" 返回)。
    readonly createOpen = signal(false);

    constructor() {
        // 登录后云端数据是异步拉回来的,构造时的 overviewOpen 初值看不到它——
        // 水合完成时若是多缸,同样先落总览页(和刷新时本地已有多缸的行为一致)。
        effect(() => {
            if (this.store.cloudHydrated() === 0) return;
            untracked(() => {
                if (this.store.allTanks().length > 1) {
                    this.overviewOpen.set(true);
                    this.createOpen.set(false);
                }
            });
        });
    }

    closeTestForm(): void {
        this.addTestOpen.set(false);
        this.editingTest.set(undefined);
    }

    openTank(id: string): void {
        this.store.selectTank(id);
        this.overviewOpen.set(false);
    }

    /** first-run 建完缸(store 已选中新缸)→ 收起加缸屏,直接看新缸。 */
    tankCreated(): void {
        this.createOpen.set(false);
        this.overviewOpen.set(false);
    }

    // 分类 eyebrow:如 "Freshwater · Planted · Low-tech";空字段跳过,全空则整行不渲染
    readonly eyebrow = computed(() => {
        const tank = this.store.currentTank();
        return tank ? classificationLabel(tank) : '';
    });

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
