import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { App } from './app';
import { TankRepository } from './data/tank.repository';
import { AuthService } from './data/auth.service';
import { TankCloudSync } from './data/tank.cloud-sync';
import { SUPABASE } from './data/supabase.client';
import { TankStore } from './state/tank.store';
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

// 可控的登录态:enabled=true 走"必须登录才能建缸"的正式流程;
// SUPABASE 置 null 让云同步全部 no-op,测试不发网络请求。
class FakeAuthService {
  user = signal<User | null>(null);
  enabled = true;
  async signInWithGoogle(): Promise<{ error: string | null }> {
    return { error: null };
  }
  async signOut(): Promise<void> {
    this.user.set(null);
  }
}

// 可控的云端数据:remote 置为 Tank[] 模拟"登录后从云端拉回缸"。
class FakeCloudSync {
  remote: Tank[] | null | undefined = undefined;
  async pull(): Promise<Tank[] | null | undefined> {
    return this.remote;
  }
  async push(_tanks: Tank[]): Promise<void> {}
}

describe('App', () => {
  let auth: FakeAuthService;
  let cloud: FakeCloudSync;

  const signIn = () => auth.user.set({ id: 'u1', email: 'me@example.com' } as User);

  beforeEach(async () => {
    auth = new FakeAuthService();
    cloud = new FakeCloudSync();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: TankRepository, useClass: InMemoryTankRepository },
        { provide: AuthService, useValue: auth },
        { provide: TankCloudSync, useValue: cloud },
        { provide: SUPABASE, useValue: null },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should offer only sign-in and sample when signed out with no tanks', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Welcome to Aqua');
    expect(compiled.querySelector('first-run .btn-google')?.textContent).toContain('Sign in with Google');
    expect(compiled.querySelector('first-run .btn-ghost')?.textContent).toContain('View the sample tank');
    // 未登录没有建缸表单
    expect(compiled.querySelector('first-run form')).toBeNull();
  });

  it('should show the create form once signed in', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    signIn();
    await fixture.whenStable();

    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Create your first tank');
    expect(compiled.querySelector('first-run form')).not.toBeNull();
    expect(compiled.querySelector('first-run .side-text')?.textContent).toContain('me@example.com');
  });

  it('should switch to the dashboard after creating a tank', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    signIn();
    const store = TestBed.inject(TankStore);
    store.createTank({
      name: '  Shrimp Tank  ',
      startDate: '2026-07-04',
      volume: '',
      waterType: 'freshwater',
      setupStyle: 'planted',
      techLevel: '',
    });
    await fixture.whenStable();

    expect(compiled.querySelector('first-run')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('Shrimp Tank');
    expect(store.currentTank()?.volume).toBeUndefined(); // 空 volume 不落字段
    expect(store.currentTank()?.techLevel).toBeUndefined(); // 空分类不落字段
    // eyebrow 渲染已填的分类,跳过空值
    expect(compiled.querySelector('.eyebrow')?.textContent).toBe('Freshwater · Planted');
  });

  it('should switch to the dashboard after loading the sample tank', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    TestBed.inject(TankStore).loadSampleTank();
    await fixture.whenStable();

    expect(compiled.querySelector('first-run')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('Shrimp Tank');
    // 示例缸横幅可见;未登录时按钮引导去登录
    expect(compiled.querySelector('.sample-title')?.textContent).toContain('exploring a sample tank');
    expect(compiled.querySelector('.sample-create')?.textContent).toContain('Sign in to create your own tank');
  });

  it('should return to the sign-in landing after leaving the sample tank', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const store = TestBed.inject(TankStore);
    store.loadSampleTank();
    await fixture.whenStable();

    (compiled.querySelector('.sample-create') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(store.currentTank()).toBeUndefined();
    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Welcome to Aqua');
    expect(compiled.querySelector('first-run .btn-google')).not.toBeNull();
  });

  it('should land on the tank overview with 2+ tanks and open a tank on card click', async () => {
    const repo = TestBed.inject(TankRepository) as InMemoryTankRepository;
    repo.tanks = [
      { id: 'a', name: 'Alpha', startDate: '2026-06-01' },
      { id: 'b', name: 'Beta', startDate: '2026-06-01' },
    ];
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    // 落地页是总览,两张缸卡 + ghost 卡
    expect(compiled.querySelector('tank-overview h1')?.textContent).toContain('All tanks');
    const cards = compiled.querySelectorAll<HTMLButtonElement>('.tank-card');
    expect(cards.length).toBe(2);

    // 都没测试 → 同分,按名字排;点第一张进 Alpha 的 dashboard
    cards[0].click();
    await fixture.whenStable();
    expect(compiled.querySelector('tank-overview')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('Alpha');
    // dashboard 有回总览的链接
    expect(compiled.querySelector('.nav-link')?.textContent).toContain('All tanks');
  });

  it('should land multi-tank users on the overview after signing in', async () => {
    // 新设备:本地没缸,云端有两个缸
    cloud.remote = [
      { id: 'a', name: 'Alpha', startDate: '2026-06-01' },
      { id: 'b', name: 'Beta', startDate: '2026-06-01' },
    ];
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('first-run .btn-google')).not.toBeNull();

    signIn();
    await fixture.whenStable();

    // 登录 → 云端水合 → 多缸,先落总览页而不是某个缸的 dashboard
    expect(compiled.querySelector('tank-overview h1')?.textContent).toContain('All tanks');
  });

  it('should go straight to the dashboard with a single tank and offer "+ New tank"', async () => {
    const repo = TestBed.inject(TankRepository) as InMemoryTankRepository;
    repo.tanks = [{ id: 'a', name: 'Alpha', startDate: '2026-06-01' }];
    signIn();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('tank-overview')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('Alpha');

    // "+ New tank" → 加缸屏(带返回);返回 → 回到 dashboard
    (compiled.querySelector('.nav-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Add a new tank');
    (compiled.querySelector('first-run .back-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(compiled.querySelector('h1')?.textContent).toContain('Alpha');
  });

  it('should ask a signed-out user to sign in before adding a tank', async () => {
    const repo = TestBed.inject(TankRepository) as InMemoryTankRepository;
    repo.tanks = [{ id: 'a', name: 'Alpha', startDate: '2026-06-01' }];
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.nav-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Sign in to add your own tank');
    expect(compiled.querySelector('first-run form')).toBeNull();
    // 已有缸时 landing 不再提供"再加载一个示例缸"
    expect(compiled.querySelector('first-run .btn-ghost')).toBeNull();
  });

  it('should delete the current tank from the edit dialog after confirming', async () => {
    const repo = TestBed.inject(TankRepository) as InMemoryTankRepository;
    repo.tanks = [{ id: 'a', name: 'Alpha', startDate: '2026-06-01' }];
    signIn();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.edit-tank') as HTMLButtonElement).click();
    await fixture.whenStable();

    // 两步确认:先点链接,再点真正的删除
    (compiled.querySelector('.link-danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    (compiled.querySelector('.btn-danger') as HTMLButtonElement).click();
    await fixture.whenStable();

    const store = TestBed.inject(TankStore);
    expect(store.allTanks().length).toBe(0);
    // 没缸了 → 回到建缸表单(已登录)
    expect(compiled.querySelector('first-run .title')?.textContent).toContain('Create your first tank');
  });

  it('should not show the sample banner on a user-created tank', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    TestBed.inject(TankStore).createTank({
      name: 'My Tank',
      startDate: '2026-07-04',
      waterType: 'freshwater',
      setupStyle: '',
      techLevel: '',
    });
    await fixture.whenStable();

    expect(compiled.querySelector('.sample-banner')).toBeNull();
  });
});
