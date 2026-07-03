import { Injectable } from '@angular/core';
import { Tank } from '../domain/tank.model';
import { seedTanks } from '../domain/seed-data';

const STORAGE_KEY = 'aqua-app.tanks';

// 持久层:只管存取,不认识业务规则。
// 接口抽象的价值:测试时可注入内存实现;序列化的脏活锁死在这一个文件里。
export abstract class TankRepository {
    abstract loadAll(): Tank[];
    abstract saveAll(tanks: Tank[]): void;
}

@Injectable({ providedIn: 'root' })
export class LocalStorageTankRepository extends TankRepository {
    loadAll(): Tank[] {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return seedTanks;
        try {
            return JSON.parse(raw) as Tank[];
        } catch {
            // 数据损坏时退回种子数据,不让 app 崩掉
            console.error('Failed to parse stored tanks, falling back to seed data');
            return seedTanks;
        }
    }

    saveAll(tanks: Tank[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tanks));
    }
}
