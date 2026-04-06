import { Injectable, inject } from '@angular/core';
import { MarpService } from './marp.service';
import { AppStore } from '../store/app-store';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly marpService = inject(MarpService);
  private readonly store = inject(AppStore);

  downloadMarkdown(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/markdown' });
    this.download(filename, blob);
  }

  downloadHtml(filename: string, markdown: string): void {
    const type = this.store.documentType();
    let fullHtml = '';

    if (type === 'slides') {
      const { html, css } = this.marpService.render(markdown);
      fullHtml = this.marpService.buildSrcdoc(html, css, true, 'slides');
    } else {
      const { html } = this.marpService.renderProse(markdown);
      fullHtml = this.marpService.buildSrcdoc(html, '', true, 'prose', 'paged');
    }

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const htmlFilename = filename.replace(/\.md$/, '') + '.html';
    this.download(htmlFilename, blob);
  }

  print(markdown: string): void {
    const type = this.store.documentType();
    let fullHtml = '';

    if (type === 'slides') {
      const { html, css } = this.marpService.render(markdown);
      fullHtml = this.marpService.buildSrcdoc(html, css, true, 'slides');
    } else {
      const { html } = this.marpService.renderProse(markdown);
      fullHtml = this.marpService.buildSrcdoc(html, '', true, 'prose', 'paged');
    }
    
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    printFrame.srcdoc = fullHtml;
    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      // Cleanup after a delay to ensure print dialog is shown
      setTimeout(() => document.body.removeChild(printFrame), 1000);
    };
  }

  private download(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
