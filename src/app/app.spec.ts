import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { TankRepository } from './data/tank.repository';
import { Tank } from './domain/tank.model';
import { seedTanks } from './domain/seed-data';

// repository 抽象的价值:测试里换成内存实现,不碰 localStorage
class InMemoryTankRepository extends TankRepository {
  tanks: Tank[] = structuredClone(seedTanks);
  loadAll(): Tank[] {
    return this.tanks;
  }
  saveAll(tanks: Tank[]): void {
    this.tanks = tanks;
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: TankRepository, useClass: InMemoryTankRepository }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the current tank name', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('My First Tank');
  });
});
