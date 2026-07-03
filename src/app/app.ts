import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TankStore } from './state/tank.store';
import { todayISO } from './domain/tank.model';
import { WaterTestCard } from './features/water-test/water-test-card';
import { WaterTestForm } from './features/water-test/water-test-form';
import { WaterTestList } from './features/water-test/water-test-list';
import { WaterTestTrend } from './features/water-test/water-test-trend';
import { InhabitantList } from './features/inhabitants/inhabitant-list';
import { InhabitantForm } from './features/inhabitants/inhabitant-form';

// Dashboard 容器:注入 store、组织数据;展示组件只拿 input/output
@Component({
  selector: 'app-root',
  imports: [DatePipe, WaterTestCard, WaterTestForm, WaterTestList, WaterTestTrend, InhabitantList, InhabitantForm],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly store = inject(TankStore);
  readonly todayISO = todayISO;

  onLivestockCount(e: { id: string; count: number; reason?: string }): void {
    this.store.addLivestockCount(e.id, { date: todayISO(), count: e.count, reason: e.reason });
  }

  onPlantCount(e: { id: string; count: number; reason?: string }): void {
    this.store.addPlantCount(e.id, { date: todayISO(), count: e.count, reason: e.reason });
  }
}
