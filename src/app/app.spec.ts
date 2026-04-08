import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { FsService } from './services/fs.service';
import { MarpService } from './services/marp.service';
import { ProseService } from './services/prose.service';
import { PrefsService } from './services/prefs.service';
import { signal } from '@angular/core';

describe('App', () => {
  let fsServiceMock: any;
  let marpServiceMock: any;
  let proseServiceMock: any;
  let prefsServiceMock: any;

  beforeEach(async () => {
    fsServiceMock = {
      init: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
    };

    marpServiceMock = {
      render: vi.fn().mockReturnValue({ html: '', css: '', slideCount: 1 }),
      buildSrcdoc: vi.fn().mockReturnValue(''),
    };

    proseServiceMock = {
      render: vi.fn().mockReturnValue({ html: '' }),
      buildSrcdoc: vi.fn().mockReturnValue(''),
    };

    prefsServiceMock = {
      init: vi.fn().mockResolvedValue({
        lastOpenFile: null,
        preferredTheme: 'default',
        editorFontSize: 16,
        darkMode: 'system',
      }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: FsService, useValue: fsServiceMock },
        { provide: MarpService, useValue: marpServiceMock },
        { provide: ProseService, useValue: proseServiceMock },
        { provide: PrefsService, useValue: prefsServiceMock },
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render brand name', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.toolbar__brand')?.textContent).toContain('Folio');
  });
});
