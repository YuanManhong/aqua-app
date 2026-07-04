import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { TankRepository } from './data/tank.repository';
import { Tank } from './domain/tank.model';

// repository 抽象的价值:测试里换成内存实现,不碰 localStorage
class InMemoryTankRepository extends TankRepository {
  tanks: Tank[] = [];
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

  it('should show the empty state when there are no tanks', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.no-tank')?.textContent).toContain('No tank selected');
  });
});
