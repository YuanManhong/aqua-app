import { Component, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

/** 和 Validators.required 的区别:纯空白也算空。 */
const requiredTrimmed = (c: AbstractControl) => (String(c.value ?? '').trim() ? null : { required: true });
import { SetupStyle, TechLevel, WaterType, todayISO } from '../domain/tank.model';
import { TECH_LEVELS, WATER_TYPES, setupStylesFor, techLevelApplies } from '../domain/tank-classification';
import { TankStore } from '../state/tank.store';
import { AuthService } from '../data/auth.service';

// 入口界面:还没有任何缸时替代 dashboard 显示;有缸时作为"加缸"屏(带返回)。
// 未登录时只给两个选择:登录 / 看示例缸——建缸必须先登录(纯本地模式即 Supabase
// 未配置时例外,直接给表单)。登录或建缸后 app.html 的 @if 自动切换,无需路由。
@Component({
    selector: 'first-run',
    imports: [ReactiveFormsModule],
    template: `
    <div class="page">
      @if (store.hasTanks()) {
        <button class="back-link" type="button" (click)="back.emit()">← Back to tanks</button>
      }
      <div class="wordmark">
        <span class="mark"><span class="drop"></span></span>
        <span class="name">Aqua</span>
      </div>

      @if (needsSignIn()) {
        <h1 class="title">{{ store.hasTanks() ? 'Sign in to add your own tank' : 'Welcome to Aqua' }}</h1>
        <p class="tagline">Every water test and creature, logged and trended over time.</p>

        <div class="card landing">
          <div class="accent"></div>
          <div class="landing-body">
            <button class="btn-google" type="button" (click)="signIn()" [disabled]="busy()">
              <svg class="g-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.7z"/>
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.2 21.2 7.3 24 12 24z"/>
                <path fill="#FBBC05" d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.1 0 12s.4 3.6 1.2 5.2l3.9-2.9z"/>
                <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4L19 2.8C17 1 14.2 0 12 0 7.3 0 3.2 2.8 1.2 6.8l3.9 2.9c1-3 3.7-5.1 6.9-5.1z"/>
              </svg>
              {{ busy() ? 'Redirecting…' : 'Sign in with Google' }}
            </button>
            @if (error(); as e) { <span class="side-err">{{ e }}</span> }
            <p class="landing-note">Your tanks live in your account and sync across devices.</p>

            @if (!store.hasTanks()) {
              <div class="landing-or"><span>or</span></div>
              <button class="btn-ghost" type="button" (click)="loadSample()">View the sample tank</button>
              <p class="landing-note">A filled example with ~3 months of data — no account needed.</p>
            }
          </div>
        </div>
      } @else {
      <h1 class="title">{{ store.hasTanks() ? 'Add a new tank' : 'Create your first tank' }}</h1>
      <p class="tagline">Every water test and creature, logged and trended over time.</p>

      <form class="card" [formGroup]="form" (ngSubmit)="create()">
        <div class="accent"></div>
        <div class="cols">
        <div class="body">
          <div>
            <label class="lbl" for="fr-name">Tank name</label>
            <input id="fr-name" type="text" placeholder="e.g. Shrimp Tank" formControlName="name" />
          </div>

          <div class="grid">
            <div>
              <label class="lbl" for="fr-date">Start date</label>
              <input id="fr-date" type="date" formControlName="startDate" />
            </div>
            <div>
              <label class="lbl" for="fr-vol">Volume <span class="opt">· optional</span></label>
              <input id="fr-vol" type="text" placeholder="e.g. 5.5 gal" formControlName="volume" />
            </div>
          </div>

          <div>
            <label class="lbl" for="fr-water">Water type</label>
            <select id="fr-water" formControlName="waterType">
              <option value="" disabled>Select water type…</option>
              @for (o of waterTypes; track o.value) {
                <option [value]="o.value">{{ o.label }}</option>
              }
            </select>
          </div>

          <div class="grid">
            <div>
              <label class="lbl" for="fr-style">Setup style <span class="opt">· optional</span></label>
              <select id="fr-style" formControlName="setupStyle">
                <option value="">None / not sure</option>
                @for (o of styleOptions(); track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </div>
            @if (showTechLevel()) {
              <div>
                <label class="lbl" for="fr-tech">Tech level <span class="opt">· optional</span></label>
                <select id="fr-tech" formControlName="techLevel">
                  <option value="">None / not sure</option>
                  @for (o of techLevels; track o.value) {
                    <option [value]="o.value">{{ o.label }}</option>
                  }
                </select>
              </div>
            }
          </div>

          <button class="btn-primary" type="submit" [disabled]="form.invalid">Create tank</button>
        </div>

        <aside class="side">
          @if (auth.user(); as user) {
            <div class="side-sec">
              <h3 class="side-title">Signed in</h3>
              <p class="side-text">{{ user.email }} — new tanks sync to your account.</p>
              <button class="btn-ghost" type="button" (click)="auth.signOut()">Sign out</button>
            </div>
            <div class="side-div"></div>
          }
          <div class="side-sec">
            <h3 class="side-title">Just exploring?</h3>
            <p class="side-text">Peek at a filled example — ~3 months of data.</p>
            <button class="btn-ghost" type="button" (click)="loadSample()">Load sample tank</button>
          </div>
        </aside>
        </div>
      </form>

      <p class="footer">{{ auth.user() ? 'New tanks sync to your account across devices.' : 'Saved on this device — nothing leaves your browser.' }}</p>
      }
    </div>
  `,
    styles: `
    .page {
      min-height: 100vh;
      background: radial-gradient(1200px 600px at 80% -10%, #dcecec 0%, #eaf1f2 55%);
      padding: 56px 40px 64px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #12312f; box-sizing: border-box;
      position: relative;
    }
    /* 水彩插画铺底;卡片半透明+模糊,保证表单可读。 */
    .page::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background: url('/first-tank-bg.jpg') center / cover no-repeat;
      opacity: 0.5;
    }
    .page > * { position: relative; }
    /* 已有缸时(从 overview 进来加缸)左上角给条回去的路 */
    .back-link {
      position: absolute; top: 22px; left: 26px;
      appearance: none; border: none; background: none; padding: 4px 6px; width: auto;
      font: inherit; font-size: 12.5px; font-weight: 700; color: #5a8180; cursor: pointer;
    }
    .back-link:hover { color: #0f8a8d; text-decoration: underline; }
    .wordmark { display: flex; align-items: center; gap: 11px; margin-bottom: 28px; }
    .mark {
      width: 34px; height: 34px; border-radius: 10px; background: #0f8a8d;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 5px 14px rgba(15, 138, 141, 0.32);
    }
    .drop { width: 12px; height: 12px; background: #fff; border-radius: 50% 50% 50% 0; transform: rotate(45deg); }
    .name { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #0f2e2c; }

    .title {
      font-family: 'Newsreader', serif; font-weight: 500; font-size: 35px; line-height: 1.1;
      letter-spacing: -0.01em; color: #0f2e2c; text-align: center; margin: 0 0 11px;
    }
    .tagline {
      font-family: 'Newsreader', serif; font-style: italic; font-size: 17px; line-height: 1.45;
      color: #4a6b69; text-align: center; margin: 0 0 32px; max-width: 400px;
    }

    .card {
      width: 100%; max-width: 920px; background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(10px); border: 1px solid #dcecec;
      border-radius: 14px; box-shadow: 0 14px 44px rgba(18, 49, 47, 0.11); overflow: hidden;
    }
    .accent { height: 4px; background: linear-gradient(90deg, #0f8a8d, #2f9e6d); }
    .cols { display: grid; grid-template-columns: 1.7fr 1fr; }
    .body { padding: 30px 34px 34px; display: flex; flex-direction: column; gap: 17px; }

    .side {
      border-left: 1px solid #e4ecec; padding: 30px 28px;
      display: flex; flex-direction: column; gap: 22px;
    }
    .side-sec { display: flex; flex-direction: column; gap: 10px; }
    .side-title { margin: 0; font-size: 17px; font-weight: 700; color: #12312f; letter-spacing: -0.01em; }
    .side-text { margin: 0; font-size: 14px; line-height: 1.55; color: #4a6b69; }
    .side-div { height: 1px; background: #e4ecec; }
    .side-err { color: #c0392b; font-size: 12.5px; text-align: center; }

    /* 未登录 landing:窄卡片,登录为主、看示例为辅 */
    .landing { max-width: 440px; }
    .landing-body { padding: 30px 34px 32px; display: flex; flex-direction: column; gap: 12px; }
    .landing-note { margin: 0; font-size: 13px; line-height: 1.5; color: #4a6b69; text-align: center; }
    .landing-or {
      display: flex; align-items: center; gap: 12px; margin: 10px 0 2px;
      color: #a9bcba; font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .landing-or::before, .landing-or::after { content: ''; height: 1px; background: #e4ecec; flex: 1; }

    .btn-google {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      border: 1px solid #cfe0df; background: #fff; color: #12312f;
      font-size: 15px; padding: 13px 16px; margin-top: 4px;
    }
    .btn-google:hover:enabled { background: #f7fafa; border-color: #bcdad9; }
    .btn-google:disabled { color: #8aa19f; cursor: default; }
    .g-icon { width: 18px; height: 18px; flex: none; }

    @media (max-width: 760px) {
      .cols { grid-template-columns: 1fr; }
      .side { border-left: none; border-top: 1px solid #e4ecec; }
    }

    .lbl {
      display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase; color: #5a7371; margin-bottom: 7px;
    }
    .opt { text-transform: none; letter-spacing: 0; color: #a9bcba; font-weight: 600; font-size: 11px; }

    input, select {
      width: 100%; border: 1px solid #cfe0df; border-radius: 9px; padding: 11px 12px;
      font: inherit; font-size: 14px; color: #12312f; background: #f7fafa; box-sizing: border-box;
    }
    input:focus, select:focus { outline: none; border-color: #0f8a8d; background: #fff; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid > :only-child { grid-column: 1 / -1; } /* 非淡水时 Tech level 隐藏,Setup style 占满整行 */
    @media (max-width: 380px) { .grid { grid-template-columns: 1fr; } }

    button { appearance: none; font: inherit; font-weight: 700; border-radius: 9px; width: 100%; cursor: pointer; }
    .btn-primary {
      border: none; background: #0f8a8d; color: #fff; font-size: 15px; padding: 13px 20px;
      box-shadow: 0 8px 20px rgba(15, 138, 141, 0.26); margin-top: 2px;
    }
    .btn-primary:hover:enabled { filter: brightness(1.06); }
    .btn-primary:disabled { opacity: 0.5; box-shadow: none; cursor: not-allowed; }

    .btn-ghost { border: 1px solid #cfe0df; background: #fff; color: #2c4f4d; font-size: 14.5px; padding: 12px 20px; margin-top: 4px; }
    .btn-ghost:hover { background: #f2fafa; border-color: #bcdad9; }

    .footer { margin: 24px 0 0; font-size: 12.5px; color: #4a6b69; text-align: center; max-width: 420px; line-height: 1.5; }
  `,
})
export class FirstRun {
    private readonly fb = inject(FormBuilder);
    readonly store = inject(TankStore);
    readonly auth = inject(AuthService);

    /** 建好缸(或加载示例缸)后通知父级——已有缸时该屏是"加缸"弹层,父级据此收起它。 */
    readonly created = output<void>();
    /** "← Back to tanks":不建缸,原路返回。 */
    readonly back = output<void>();

    // 建缸必须先登录(示例缸除外);Supabase 未配置时退化为纯本地,直接给表单。
    readonly needsSignIn = computed(() => this.auth.enabled && !this.auth.user());

    // 登录成功后 store.hydrateFromCloud 拉回云端数据;有缸则 app.html 自动切到 dashboard,
    // 没缸则本组件切到建缸表单。
    readonly busy = signal(false);
    readonly error = signal<string | null>(null);

    async signIn(): Promise<void> {
        this.busy.set(true);
        this.error.set(null);
        const { error } = await this.auth.signInWithGoogle();
        // 成功时页面跳转到 Google,不用复位 busy;失败才留在本页
        if (error) {
            this.busy.set(false);
            this.error.set(error);
        }
    }

    readonly waterTypes = WATER_TYPES;
    readonly techLevels = TECH_LEVELS;

    readonly form = this.fb.nonNullable.group({
        name: ['', requiredTrimmed],
        startDate: [todayISO(), Validators.required],
        volume: [''],
        waterType: this.fb.nonNullable.control<WaterType | ''>('', Validators.required),
        setupStyle: this.fb.nonNullable.control<SetupStyle | ''>(''),
        techLevel: this.fb.nonNullable.control<TechLevel | ''>(''),
    });

    // dependent picklist:水体决定风格选项(Reef/FOWLR 只在海水下出现),Tech level 只对淡水有意义
    private readonly waterType = toSignal(this.form.controls.waterType.valueChanges, { initialValue: '' as const });
    readonly styleOptions = computed(() => setupStylesFor(this.waterType()));
    readonly showTechLevel = computed(() => techLevelApplies(this.waterType()));

    constructor() {
        // 切换水体后,已选的依赖值若不再合法就静默清空(store 侧还有 normalize 兜底)
        this.form.controls.waterType.valueChanges.pipe(takeUntilDestroyed()).subscribe(wt => {
            const style = this.form.controls.setupStyle.value;
            if (style && !setupStylesFor(wt).some(o => o.value === style)) {
                this.form.controls.setupStyle.setValue('');
            }
            if (!techLevelApplies(wt)) this.form.controls.techLevel.setValue('');
        });
    }

    create(): void {
        if (this.form.invalid) return;
        this.store.createTank(this.form.getRawValue());
        // 首次:currentTank() 有值,app.html 自动切到 dashboard;加缸:父级收起本屏。
        this.created.emit();
    }

    loadSample(): void {
        this.store.loadSampleTank();
        this.created.emit();
    }
}
