import { Injectable, effect, signal } from '@angular/core';
import { HardnessUnit } from '../domain/hardness';

const STORAGE_KEY = 'aqua-app.settings';

interface StoredSettings {
    hardnessUnit?: HardnessUnit;
}

// 设备级偏好:存 localStorage,不随账号云同步("Applies everywhere on this device")。
// 单缸用户在缸页设置、多缸用户在总览页设置,读写的都是同一份——
// 单缸时期选的单位在变成多缸后自动延续。
@Injectable({ providedIn: 'root' })
export class SettingsStore {
    readonly hardnessUnit = signal<HardnessUnit>(load().hardnessUnit === 'ppm' ? 'ppm' : 'degrees');

    constructor() {
        // 一变就落盘,和 TankStore 的 repository effect 同一套路
        effect(() => {
            const data: StoredSettings = { hardnessUnit: this.hardnessUnit() };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        });
    }

    setHardnessUnit(unit: HardnessUnit): void {
        this.hardnessUnit.set(unit);
    }
}

function load(): StoredSettings {
    try {
        return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}) as StoredSettings;
    } catch {
        return {}; // 数据损坏时退回默认,不让 app 崩掉
    }
}
