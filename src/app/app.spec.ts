import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { App } from './app';
import { FsService } from './services/fs.service';
import { MarpService } from './services/marp.service';
import { ProseService } from './services/prose.service';
import { PrefsService } from './services/prefs.service';
import { ExportService } from './services/export.service';
import * as platformWarning from './services/platform-warning';

describe('shouldShowApplePlatformWarning', () => {
  it('returns true for Safari on macOS', () => {
    expect(
      platformWarning.shouldShowApplePlatformWarning({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        vendor: 'Apple Computer, Inc.',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(true);
  });

  it('returns true for iPhone Safari', () => {
    expect(
      platformWarning.shouldShowApplePlatformWarning({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        vendor: 'Apple Computer, Inc.',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('returns false for Chromium browsers', () => {
    expect(
      platformWarning.shouldShowApplePlatformWarning({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        vendor: 'Google Inc.',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});

describe('App', () => {
  let fsServiceMock: any;
  let marpServiceMock: any;
  let proseServiceMock: any;
  let prefsServiceMock: any;
  let dialogOpenSpy: any;
  let breakpointObserverMock: any;
  let exportServiceMock: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
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
        lastTab: 0,
        preferredTheme: 'default',
        appTheme: 'quiet',
        fontFamily: 'sans-serif',
        editorFontSize: 16,
        darkMode: 'system',
        safariWarningDismissed: false,
      }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    breakpointObserverMock = {
      observe: vi.fn().mockReturnValue(of({ matches: true })),
    };

    exportServiceMock = {
      downloadMarkdown: vi.fn(),
      downloadHtml: vi.fn(),
      print: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: FsService, useValue: fsServiceMock },
        { provide: MarpService, useValue: marpServiceMock },
        { provide: ProseService, useValue: proseServiceMock },
        { provide: PrefsService, useValue: prefsServiceMock },
        { provide: BreakpointObserver, useValue: breakpointObserverMock },
        { provide: ExportService, useValue: exportServiceMock },
      ],
    }).compileComponents();

    dialogOpenSpy = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(undefined),
    } as never);
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

  it('shows the warning dialog the first time on affected Apple browsers', async () => {
    const fixture = TestBed.createComponent(App);
    (fixture.componentInstance as any).shouldShowSafariWarning = () => true;

    await fixture.whenStable();

    expect(dialogOpenSpy).toHaveBeenCalled();
    expect(prefsServiceMock.save).toHaveBeenCalledWith(expect.objectContaining({ safariWarningDismissed: true }));
  });

  it('does not show the warning dialog when the browser is unaffected', async () => {
    const fixture = TestBed.createComponent(App);
    (fixture.componentInstance as any).shouldShowSafariWarning = () => false;

    await fixture.whenStable();

    expect(dialogOpenSpy).not.toHaveBeenCalled();
  });
});
