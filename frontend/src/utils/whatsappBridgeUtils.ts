/**
 * Zamzam Foods - WhatsApp Web Bridge Utilities
 * Interacts with the local WhatsApp background service (port 3005)
 * to send PDF or Image invoices directly to customer chats.
 */

import { toJpeg } from 'html-to-image';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { getApiBaseUrl } from '../services/apiClient';

/**
 * Returns the base URL for the WhatsApp Web Bridge.
 * 
 * In a multi-PC / client-server setup:
 * - On the Server PC, this resolves to http://localhost:3005
 * - On a Client PC (connecting across LAN):
 *   1. Explicit override in localStorage ('zamzam_whatsapp_bridge_url')
 *   2. Extracted host from the active API_BASE_URL (e.g. http://192.168.1.50:8000 -> http://192.168.1.50:3005)
 *   3. Extracted host from window.location.hostname
 *   4. Fallback to http://localhost:3005
 */
export function getWhatsAppBridgeBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3005';

  // 1. Explicit override in localStorage
  const saved = localStorage.getItem('zamzam_whatsapp_bridge_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // 2. Derive host from backend API URL (e.g. http://192.168.1.50:8000/api/v1 -> http://192.168.1.50:3005)
  try {
    const apiUrl = getApiBaseUrl();
    if (apiUrl) {
      const parsed = new URL(apiUrl);
      const host = parsed.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'tauri.localhost') {
        const protocol = parsed.protocol === 'https:' ? 'https:' : 'http:';
        return `${protocol}//${host}:3005`;
      }
    }
  } catch {
    // ignore
  }

  // 3. Derive host from window.location
  try {
    if (window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'tauri.localhost') {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${protocol}//${host}:3005`;
      }
    }
  } catch {
    // ignore
  }

  return 'http://localhost:3005';
}

export function setWhatsAppBridgeBaseUrl(url: string): string {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('zamzam_whatsapp_bridge_url');
      return getWhatsAppBridgeBaseUrl();
    }
    const clean = url.trim().replace(/\/+$/, '');
    const normalized = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `http://${clean}`;
    localStorage.setItem('zamzam_whatsapp_bridge_url', normalized);
    return normalized;
  }
  return 'http://localhost:3005';
}

export function getWhatsAppBridgeQrUrl(): string {
  return `${getWhatsAppBridgeBaseUrl()}/qr`;
}

export interface BridgeStatus {
  connected: boolean;
  hasQr: boolean;
  info?: {
    phone?: string;
    name?: string;
  } | null;
}

/**
 * Check if the local WhatsApp Bridge service is running and connected.
 */
export async function checkWhatsAppBridgeStatus(): Promise<BridgeStatus> {
  try {
    const bridgeUrl = getWhatsAppBridgeBaseUrl();
    const res = await fetch(`${bridgeUrl}/status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2000), // Quick timeout
    });
    if (!res.ok) {
      return { connected: false, hasQr: false };
    }
    const data = await res.json();
    return {
      connected: Boolean(data.connected),
      hasQr: Boolean(data.hasQr),
      info: data.info || null,
    };
  } catch {
    return { connected: false, hasQr: false };
  }
}

export interface SendInvoiceFileOptions {
  phone: string;
  element: HTMLElement;
  orderNumber: string;
  format?: 'PDF' | 'IMAGE';
  caption?: string;
}

/**
 * Captures the HTML invoice element and sends it as a PDF or Image
 * via the local WhatsApp Bridge.
 */
export async function sendInvoiceFileViaBridge({
  phone,
  element,
  orderNumber,
  format = 'PDF',
  caption,
}: SendInvoiceFileOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Check bridge status first
    const status = await checkWhatsAppBridgeStatus();
    const bridgeUrl = getWhatsAppBridgeBaseUrl();
    if (!status.connected) {
      return {
        success: false,
        error: status.hasQr
          ? 'WhatsApp is not linked on your laptop/server yet. Please scan the QR code first.'
          : `WhatsApp bridge is not reachable at ${bridgeUrl}. Ensure start_whatsapp_bridge.bat is running on your server PC.`,
      };
    }

    // 2. Render element into a high-resolution image using html-to-image (Native Browser Engine)
    const width = element.offsetWidth || 760;
    const height = element.offsetHeight || 900;

    let base64Data: string;
    let filename: string;
    let mimetype: string;

    try {
      // Primary: html-to-image uses native browser SVG foreignObject rendering.
      // It eliminates all text kerning, missing spaces, and overlapping bugs.
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        style: {
          position: 'static',
          left: '0px',
          top: '0px',
          margin: '0px',
          opacity: '1',
          visibility: 'visible',
          display: 'block',
        },
      });

      if (format === 'IMAGE') {
        base64Data = dataUrl;
        filename = `Invoice_${orderNumber}.jpg`;
        mimetype = 'image/jpeg';
      } else {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        base64Data = pdf.output('datauristring');
        filename = `Bill_${orderNumber}.pdf`;
        mimetype = 'application/pdf';
      }
    } catch (renderError) {
      console.warn('html-to-image failed, falling back to html2canvas:', renderError);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        onclone: (clonedDoc, clonedElement) => {
          clonedElement.style.position = 'static';
          clonedElement.style.left = '0px';
          clonedElement.style.top = '0px';
          clonedElement.style.opacity = '1';
          clonedElement.style.display = 'block';
        },
      });

      if (format === 'IMAGE') {
        base64Data = canvas.toDataURL('image/jpeg', 0.95);
        filename = `Invoice_${orderNumber}.jpg`;
        mimetype = 'image/jpeg';
      } else {
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
        base64Data = pdf.output('datauristring');
        filename = `Bill_${orderNumber}.pdf`;
        mimetype = 'application/pdf';
      }
    }

    // 3. Post to local bridge
    const response = await fetch(`${bridgeUrl}/send-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        base64: base64Data,
        filename,
        mimetype,
        caption: caption || `📄 Zamzam Foods Invoice #${orderNumber}`,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send file via WhatsApp Bridge.',
      };
    }

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during WhatsApp file sending.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a plain text message via the local WhatsApp Bridge.
 */
export async function sendWhatsAppTextMessageViaBridge({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const status = await checkWhatsAppBridgeStatus();
    const bridgeUrl = getWhatsAppBridgeBaseUrl();
    if (!status.connected) {
      return {
        success: false,
        error: status.hasQr
          ? 'WhatsApp is not linked on your laptop/server yet. Please scan the QR code first.'
          : `WhatsApp bridge is not reachable at ${bridgeUrl}. Ensure start_whatsapp_bridge.bat is running on your server PC.`,
      };
    }

    const response = await fetch(`${bridgeUrl}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send WhatsApp message.',
      };
    }

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during WhatsApp text sending.';
    return { success: false, error: errorMsg };
  }
}

