export interface BrowserPlatformInfo {
    userAgent?: string;
    vendor?: string;
    platform?: string;
    maxTouchPoints?: number;
}

const NON_SAFARI_BROWSERS = /Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|OPiOS|Firefox|FxiOS|SamsungBrowser|DuckDuckGo|YaBrowser/i;

export function shouldShowApplePlatformWarning(platformInfo: BrowserPlatformInfo = navigator): boolean {
    const userAgent = platformInfo.userAgent ?? '';
    const vendor = platformInfo.vendor ?? '';
    const platform = platformInfo.platform ?? '';
    const maxTouchPoints = platformInfo.maxTouchPoints ?? 0;

    const isAppleMobile =
        /iPad|iPhone|iPod/i.test(userAgent) ||
        /iPad|iPhone|iPod/i.test(platform) ||
        (platform === 'MacIntel' && maxTouchPoints > 1);

    const isSafari = /Safari/i.test(userAgent) && /Apple/i.test(vendor) && !NON_SAFARI_BROWSERS.test(userAgent);
    const isMacSafari = /Mac/i.test(platform) && isSafari;

    return isAppleMobile || isMacSafari;
}
