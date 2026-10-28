import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Product, Route, Driver } from '../types';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Printer,
  Download,
  FileText,
  X,
  CheckSquare,
  Square,
  Search,
  Settings2,
  Check,
  Truck,
  Calendar,
  Layers,
  Eye,
  RotateCcw,
  Sliders,
  Store,
  Sparkles,
  ChevronDown,
  MapPin,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface OrderRowData {
  rowId: string;
  customerId: string;
  customerName: string;
  customerOwner?: string;
  customerPhone?: string;
  customerRouteId?: string;
  customerRoute?: string;
  customerBalance?: string;
  driverId?: string;
  driverName?: string;
  kubbusQty: string;
  romaliQty: string;
  productQuantities?: Record<string, string>;
  cashAmount: string;
  gpayAmount: string;
  discountAmount: string;
  status?: string;
  orderId?: string;
  orderNumber?: string;
}

export interface DynamicProductColumn {
  id: string;
  name: string;
  code?: string;
  unitPrice: number;
  isCustom?: boolean;
}

interface RouteOrderSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDate: string;
  routes: Route[];
  customers: Customer[];
  products: Product[];
  rows: OrderRowData[];
  initialRouteFilter?: string;
  drivers?: Driver[];
}

export const RouteOrderSheetModal: React.FC<RouteOrderSheetModalProps> = ({
  isOpen,
  onClose,
  orderDate,
  routes,
  customers,
  products,
  rows,
  initialRouteFilter = 'ALL',
  drivers = [],
}) => {
  const { businessName, businessPhone, gstNumber, settings } = useSettings();
  const printSheetRef = useRef<HTMLDivElement>(null);

  // 1. Multiple Route Selection State ("Route Selection add multipd selection")
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(() => {
    if (initialRouteFilter && initialRouteFilter !== 'ALL') {
      return new Set([initialRouteFilter]);
    }
    return new Set(routes.map((r) => r.id));
  });

  // Keep route selection updated if routes array loads after mount
  useEffect(() => {
    if (routes.length > 0 && selectedRouteIds.size === 0) {
      if (initialRouteFilter && initialRouteFilter !== 'ALL') {
        setSelectedRouteIds(new Set([initialRouteFilter]));
      } else {
        setSelectedRouteIds(new Set(routes.map((r) => r.id)));
      }
    }
  }, [routes]);

  // 2. Sheet Mode: 'BLANK' (Only shop name column, empty boxes for writing) or 'FILLED' (Today's entered orders & dues)
  const [sheetMode, setSheetMode] = useState<'FILLED' | 'BLANK'>('FILLED');

  // 3. Black & White Sample Sheet Design ("black white sample sheet degise")
  // Default to Black & White clean ink-saver table!
  const [sheetTheme, setSheetTheme] = useState<'BW' | 'NAVY'>('BW');

  // 4. Header & Title Options ("not tital head footer")
  // 'NONE' = Pure Table Grid (No title, No header, table starts right at top)
  // 'MINIMAL' = Single compact line (Route & Date)
  // 'FULL' = Company Letterhead banner
  const [headerStyle, setHeaderStyle] = useState<'NONE' | 'MINIMAL' | 'FULL'>('NONE');

  // 5. Footer / Signatures Option ("not footer")
  const [showSignatures, setShowSignatures] = useState<boolean>(false);

  // 6. Page Layout & A4 Size Selection
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [rowDensity, setRowDensity] = useState<'compact' | 'standard' | 'spacious' | 'auto'>('standard');
  const [fitToOnePage, setFitToOnePage] = useState<boolean>(true); // Strictly 1 A4 Page ("pdf make a4 size next page not show")
  const [showSummaryTotals, setShowSummaryTotals] = useState<boolean>(true);
  const [extraBlankRowsCount, setExtraBlankRowsCount] = useState<number>(0);
  const [lineThickness, setLineThickness] = useState<'THIN' | 'HAIRLINE' | 'STANDARD'>('THIN');

  // 7. Column Visibility Toggles ("only name add there coulem")
  const [showPhone, setShowPhone] = useState<boolean>(false);
  const [showRouteSubtitle, setShowRouteSubtitle] = useState<boolean>(false); // "remove hide rounte name" - strictly false/hidden by default!
  const [showPrevDue, setShowPrevDue] = useState<boolean>(true);
  const [prevDueBlank, setPrevDueBlank] = useState<boolean>(false);
  const [showCash, setShowCash] = useState<boolean>(true);
  const [showGPay, setShowGPay] = useState<boolean>(true);
  const [showTotalBill, setShowTotalBill] = useState<boolean>(true);
  const [showDiscount, setShowDiscount] = useState<boolean>(true); // Disc (₹)
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [showSignatureCol, setShowSignatureCol] = useState<boolean>(true);

  // 7. Dynamic Product Columns ("Product Columns: dymaic")
  // Catalog products from database
  const activeProducts = useMemo((): DynamicProductColumn[] => {
    return products.length > 0
      ? products
          .filter((p) => p.is_active !== false)
          .map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            unitPrice: parseFloat(p.unit_price) || 0,
            isCustom: false,
          }))
      : [
          { id: 'kubbus', name: 'Kubbus', code: 'KUB', unitPrice: 5.0, isCustom: false },
          { id: 'romali', name: 'Romali', code: 'ROM', unitPrice: 6.0, isCustom: false },
        ];
  }, [products]);

  // Dynamically user-added custom writing columns (e.g. Bun, Returns, Crates)
  const [customColumns, setCustomColumns] = useState<Array<{ id: string; name: string }>>([]);
  const [customColInput, setCustomColInput] = useState('');

  // Combined catalog products + custom dynamic columns
  const allDynamicProducts = useMemo((): DynamicProductColumn[] => {
    const list = [...activeProducts];
    customColumns.forEach((c) => {
      list.push({
        id: c.id,
        name: c.name,
        unitPrice: 0,
        isCustom: true,
      });
    });
    return list;
  }, [activeProducts, customColumns]);

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => {
    return new Set(allDynamicProducts.map((p) => p.id));
  });

  useEffect(() => {
    if (activeProducts.length > 0) {
      setSelectedProductIds((prev) => {
        if (prev.size === 0) {
          return new Set(activeProducts.map((p) => p.id));
        }
        return prev;
      });
    }
  }, [activeProducts]);

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        if (next.size > 1) next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAllProducts = () => {
    setSelectedProductIds(new Set(allDynamicProducts.map((p) => p.id)));
  };

  const handleDeselectAllProducts = () => {
    setSelectedProductIds(new Set());
  };

  const handleAddCustomCol = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customColInput.trim();
    if (!trimmed) return;
    const newId = `custom_${Date.now()}`;
    setCustomColumns((prev) => [...prev, { id: newId, name: trimmed }]);
    setSelectedProductIds((prev) => new Set([...prev, newId]));
    setCustomColInput('');
  };

  const handleRemoveCustomCol = (id: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.id !== id));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // 8. Robust Effective Customers List (Merges customers + rows so shops are NEVER 0)
  const effectiveCustomers = useMemo(() => {
    const map = new Map<string, Customer>();

    // Add from master customers
    customers.forEach((c) => {
      if (c && c.id) {
        map.set(String(c.id), c);
      }
    });

    // Merge any customer present in current order rows
    rows.forEach((r) => {
      if (r.customerId && !map.has(String(r.customerId))) {
        map.set(String(r.customerId), {
          id: r.customerId,
          name: r.customerName || 'Shop',
          owner_name: r.customerOwner || '',
          phone: r.customerPhone || '',
          route: r.customerRouteId,
          route_details: r.customerRoute ? { id: r.customerRouteId || '', name: r.customerRoute } : undefined,
          current_balance: r.customerBalance || '0',
          is_active: true,
        } as Customer);
      }
    });

    return Array.from(map.values());
  }, [customers, rows]);

  // 9. Multiple Route Selection Logic
  const isAllRoutesSelected = useMemo(() => {
    return routes.length > 0 && routes.every((r) => selectedRouteIds.has(r.id));
  }, [routes, selectedRouteIds]);

  const handleToggleRoute = (routeId: string) => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const handleSelectAllRoutes = () => {
    setSelectedRouteIds(new Set(routes.map((r) => r.id)));
  };

  const handleDeselectAllRoutes = () => {
    setSelectedRouteIds(new Set());
  };

  // Filter shops belonging to ANY of the selected routes
  const routeCustomers = useMemo(() => {
    if (selectedRouteIds.size === 0) return [];
    if (isAllRoutesSelected || selectedRouteIds.size === routes.length) {
      return effectiveCustomers;
    }

    return effectiveCustomers.filter((c) => {
      const cRouteId = c.route || c.route_details?.id;
      if (cRouteId && selectedRouteIds.has(cRouteId)) return true;

      // Also check route name match
      if (c.route_details?.name) {
        const cNameLower = c.route_details.name.toLowerCase();
        for (const rId of selectedRouteIds) {
          const rObj = routes.find((r) => r.id === rId);
          if (rObj && rObj.name.toLowerCase() === cNameLower) {
            return true;
          }
        }
      }
      return false;
    });
  }, [effectiveCustomers, selectedRouteIds, isAllRoutesSelected, routes]);

  // 10. Selected Shop IDs - Auto-select all shops when route or modal changes
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(() => {
    return new Set(routeCustomers.map((c) => String(c.id)));
  });

  // Whenever route or customer list changes or modal opens, auto-select all shops
  useEffect(() => {
    if (routeCustomers.length > 0) {
      setSelectedShopIds(new Set(routeCustomers.map((c) => String(c.id))));
    }
  }, [routeCustomers, isOpen, selectedRouteIds]);

  // Search filter inside the shop list
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  // Filtered shops in selection list
  const filteredRouteCustomers = useMemo(() => {
    const q = shopSearchQuery.trim().toLowerCase();
    if (!q) return routeCustomers;
    return routeCustomers.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.owner_name && c.owner_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    });
  }, [routeCustomers, shopSearchQuery]);

  // Selected routes display name
  const selectedRouteNamesString = useMemo(() => {
    if (isAllRoutesSelected || selectedRouteIds.size === routes.length || selectedRouteIds.size === 0) {
      return 'ALL ROUTES';
    }
    const names = routes
      .filter((r) => selectedRouteIds.has(r.id))
      .map((r) => r.name);
    return names.length > 0 ? names.join(', ') : 'ALL ROUTES';
  }, [routes, selectedRouteIds, isAllRoutesSelected]);

  // Driver names for selected routes
  const assignedDriversString = useMemo(() => {
    const driverNamesSet = new Set<string>();
    routes.forEach((r) => {
      if (selectedRouteIds.has(r.id) || isAllRoutesSelected) {
        const rDriver = (r as any).driver_name;
        if (rDriver) driverNamesSet.add(rDriver);
        const foundDriver = drivers.find((d) => d.assigned_route === r.id || (d as any).route === r.id);
        if (foundDriver?.driver_name) driverNamesSet.add(foundDriver.driver_name);
      }
    });
    return Array.from(driverNamesSet).join(', ');
  }, [routes, selectedRouteIds, isAllRoutesSelected, drivers]);

  // Map of customer ID -> order row data
  const rowsByCustomerId = useMemo(() => {
    const map = new Map<string, OrderRowData>();
    rows.forEach((r) => {
      if (r.customerId) {
        map.set(String(r.customerId), r);
      }
    });
    return map;
  }, [rows]);

  // Shops that will actually be printed
  const printableShops = useMemo(() => {
    return routeCustomers.filter((c) => selectedShopIds.has(String(c.id)));
  }, [routeCustomers, selectedShopIds]);

  // Toggle single shop
  const handleToggleShop = (customerId: string) => {
    setSelectedShopIds((prev) => {
      const next = new Set(prev);
      const strId = String(customerId);
      if (next.has(strId)) {
        next.delete(strId);
      } else {
        next.add(strId);
      }
      return next;
    });
  };

  // Select all / Deselect all
  const handleSelectAllShops = () => {
    setSelectedShopIds(new Set(routeCustomers.map((c) => String(c.id))));
  };

  const handleDeselectAllShops = () => {
    setSelectedShopIds(new Set());
  };

  // Dynamic calculation of today's total quantities for each product across printable shops
  const todayProductQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    printableShops.forEach((c) => {
      const rowData = rowsByCustomerId.get(String(c.id));
      if (!rowData) return;
      activeProducts.forEach((p) => {
        let qStr = rowData.productQuantities?.[p.id];
        if (qStr === undefined) {
          const pNameLower = p.name.toLowerCase();
          const pCodeLower = (p.code || '').toLowerCase();
          if (pNameLower.includes('kubbus') || pCodeLower.includes('kub') || pCodeLower === 'kbs') {
            qStr = rowData.kubbusQty;
          } else if (pNameLower.includes('romali') || pCodeLower.includes('rom') || pCodeLower === 'pri') {
            qStr = rowData.romaliQty;
          }
        }
        const qty = parseInt(qStr || '0', 10) || 0;
        if (qty > 0) {
          map[p.id] = (map[p.id] || 0) + qty;
        }
      });
    });
    return map;
  }, [printableShops, rowsByCustomerId, activeProducts]);

  const handleSelectOnlyOrderedProducts = () => {
    const orderedIds = new Set<string>();
    activeProducts.forEach((p) => {
      if ((todayProductQuantities[p.id] || 0) > 0) {
        orderedIds.add(p.id);
      }
    });
    customColumns.forEach((c) => {
      orderedIds.add(c.id);
    });
    if (orderedIds.size > 0) {
      setSelectedProductIds(orderedIds);
    } else {
      setSelectedProductIds(new Set(activeProducts.slice(0, 2).map((p) => p.id)));
    }
  };

  // Calculations for Totals row (Dynamic Products + Custom Columns)
  const calculatedTotals = useMemo(() => {
    const productSums: Record<string, number> = {};
    allDynamicProducts.forEach((p) => {
      productSums[p.id] = 0;
    });

    let totalPrevDue = 0;
    let totalCash = 0;
    let totalGPay = 0;
    let totalNetBill = 0;
    let totalDiscount = 0;
    let totalBalance = 0;
    let totalPieces = 0;

    printableShops.forEach((c) => {
      const row = rowsByCustomerId.get(String(c.id));
      const prevDueVal = parseFloat(row?.customerBalance || String(c.current_balance || '0')) || 0;
      totalPrevDue += prevDueVal;

      if (row && sheetMode === 'FILLED') {
        const cashVal = parseFloat(row.cashAmount) || 0;
        const gpayVal = parseFloat(row.gpayAmount) || 0;
        const discVal = parseFloat(row.discountAmount) || 0;
        totalCash += cashVal;
        totalGPay += gpayVal;
        totalDiscount += discVal;

        let rowBill = 0;
        allDynamicProducts.forEach((p) => {
          if (p.isCustom) return;
          let qStr = row.productQuantities?.[p.id];
          if (qStr === undefined) {
            const pNameLower = p.name.toLowerCase();
            const pCodeLower = (p.code || '').toLowerCase();
            if (pNameLower.includes('kubbus') || pCodeLower.includes('kub') || pCodeLower === 'kbs') {
              qStr = row.kubbusQty;
            } else if (pNameLower.includes('romali') || pCodeLower.includes('rom') || pCodeLower === 'pri') {
              qStr = row.romaliQty;
            }
          }
          const qty = parseInt(qStr || '0', 10) || 0;
          if (qty > 0) {
            productSums[p.id] = (productSums[p.id] || 0) + qty;
            totalPieces += qty;
            const unitPrice = p.unitPrice || 0;
            rowBill += qty * unitPrice;
          }
        });

        const netBill = Math.max(0, rowBill - discVal);
        totalNetBill += netBill;
        totalBalance += prevDueVal + netBill - (cashVal + gpayVal);
      } else {
        totalBalance += prevDueVal;
      }
    });

    return {
      productSums,
      totalPrevDue,
      totalCash,
      totalGPay,
      totalNetBill,
      totalDiscount,
      totalBalance,
      totalPieces,
    };
  }, [printableShops, rowsByCustomerId, allDynamicProducts, sheetMode]);

  // Dynamic A4 single-page height & row calculation to prevent A4 over issue ("fix a4 over issus fix it")
  const a4PageHeightPx = useMemo(() => {
    return pageOrientation === 'landscape' ? 794 : 1122; // 210mm vs 297mm in standard CSS 96dpi
  }, [pageOrientation]);

  const effectiveRowHeightPx = useMemo(() => {
    if (rowDensity === 'compact') return 20;
    if (rowDensity === 'spacious') return 32;
    if (rowDensity === 'standard' && (!fitToOnePage || printableShops.length <= 32)) return 24;

    // Auto-fit to 1 A4 page so table NEVER overflows past bottom edge
    const headerHeight = headerStyle === 'FULL' ? 115 : headerStyle === 'MINIMAL' ? 32 : 0;
    const footerHeight = showSignatures ? 60 : 0;
    const totalsHeight = showSummaryTotals ? 26 : 0;
    const paddingHeight = headerStyle === 'NONE' ? 35 : 55;
    const tableHeaderHeight = 26;

    const availableHeightForRows = a4PageHeightPx - (headerHeight + footerHeight + totalsHeight + paddingHeight + tableHeaderHeight);
    const totalRowCount = Math.max(1, printableShops.length + extraBlankRowsCount);

    const calculatedH = Math.floor(availableHeightForRows / totalRowCount);
    return Math.min(26, Math.max(11, calculatedH));
  }, [
    rowDensity,
    fitToOnePage,
    printableShops.length,
    extraBlankRowsCount,
    headerStyle,
    showSignatures,
    showSummaryTotals,
    a4PageHeightPx,
  ]);

  const effectiveFontSize = useMemo(() => {
    if (effectiveRowHeightPx >= 24) return '10px';
    if (effectiveRowHeightPx >= 20) return '9px';
    if (effectiveRowHeightPx >= 16) return '8px';
    return '7.5px';
  }, [effectiveRowHeightPx]);

  // Printable Iframe Action ("print pdf get")
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    if (!printSheetRef.current) return;
    setIsPrinting(true);

    try {
      const oldFrame = document.getElementById('route-sheet-print-frame');
      if (oldFrame) oldFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'route-sheet-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        setIsPrinting(false);
        return;
      }

      const sheetContentHtml = printSheetRef.current.innerHTML;
      const titleName = `Route_Sheet_${selectedRouteNamesString.replace(/[^a-zA-Z0-9]/g, '_')}_${orderDate}`;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${titleName}</title>
            <style>
              @page {
                size: A4 ${pageOrientation};
                margin: ${headerStyle === 'NONE' ? '4mm 5mm' : '5mm 6mm'};
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: ${effectiveFontSize};
                line-height: 1.15;
                width: 100% !important;
                height: auto !important;
              }
              #route-sheet-printable-area {
                width: 100% !important;
                min-height: 0 !important;
                height: auto !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
              }
              th, td {
                border: ${
                  lineThickness === 'THIN'
                    ? '0.5pt solid #555555'
                    : lineThickness === 'HAIRLINE'
                    ? '0.4pt solid #888888'
                    : '1pt solid #000000'
                } !important;
                color: #000000;
                height: ${effectiveRowHeightPx}px !important;
                max-height: ${effectiveRowHeightPx}px !important;
                font-size: ${effectiveFontSize} !important;
                padding: 0 4px !important;
                box-sizing: border-box !important;
                vertical-align: middle !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              th {
                background-color: ${sheetTheme === 'BW' ? '#ffffff' : '#1e293b'};
                color: ${sheetTheme === 'BW' ? '#000000' : '#ffffff'};
                border-bottom: ${
                  lineThickness === 'THIN'
                    ? '1.5pt solid #222222'
                    : lineThickness === 'HAIRLINE'
                    ? '1pt solid #444444'
                    : '2pt solid #000000'
                } !important;
                font-weight: 800;
              }
              tr {
                height: ${effectiveRowHeightPx}px !important;
                max-height: ${effectiveRowHeightPx}px !important;
                box-sizing: border-box !important;
              }
              .shop-name-cell {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                font-weight: 800 !important;
                line-height: 1.2 !important;
              }
              ${
                fitToOnePage
                  ? `
              @media print {
                html, body {
                  height: 100% !important;
                  max-height: 100% !important;
                  overflow: hidden !important;
                }
                #route-sheet-printable-area {
                  height: 100% !important;
                  max-height: 100% !important;
                  overflow: hidden !important;
                  page-break-after: avoid !important;
                  page-break-inside: avoid !important;
                }
                table, tr, td {
                  page-break-inside: avoid !important;
                  page-break-after: avoid !important;
                }
              }
              `
                  : ''
              }
              .print-no-break {
                page-break-inside: avoid;
              }
            </style>
          </head>
          <body>
            ${sheetContentHtml}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
          setIsPrinting(false);
        }, 2000);
      }, 250);
    } catch (err) {
      console.error('Failed to print sheet:', err);
      setIsPrinting(false);
      window.print();
    }
  };

  // Direct PDF Download using html2canvas & jsPDF ("adn pdf make a4 size next page not show")
  const handleDownloadPdf = async () => {
    if (!printSheetRef.current) return;
    setIsDownloadingPdf(true);

    try {
      const element = printSheetRef.current;
      const isLandscape = pageOrientation === 'landscape';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;

      let printWidth = pdfWidth;
      let printHeight = pdfWidth / ratio;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      if (fitToOnePage || printHeight <= pdfHeight + 5) {
        // STRICTLY 1 SINGLE PAGE - NEVER SHOW A NEXT PAGE!
        if (printHeight > pdfHeight) {
          // Scale down proportionally so it fits the exact single A4 page
          printHeight = pdfHeight;
          printWidth = pdfHeight * ratio;
          const xOffset = Math.max(0, (pdfWidth - printWidth) / 2);
          pdf.addImage(imgData, 'JPEG', xOffset, 0, printWidth, printHeight);
        } else {
          pdf.addImage(imgData, 'JPEG', 0, 0, printWidth, printHeight);
        }
      } else {
        // Multi-page only if fitToOnePage is unchecked AND content genuinely spans multiple pages
        let position = 0;
        let remainingHeight = printHeight;

        pdf.addImage(imgData, 'JPEG', 0, position, printWidth, printHeight);
        remainingHeight -= pdfHeight;

        while (remainingHeight > 8) {
          position = position - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, printWidth, printHeight);
          remainingHeight -= pdfHeight;
        }
      }

      const fileName = `Route_Sheet_${selectedRouteNamesString.replace(/[^a-zA-Z0-9]/g, '_')}_${orderDate}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to generate PDF download. You can use the "Print / Save PDF" button to save as PDF via your browser.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(1480px, 98vw)',
          height: 'min(94vh, 920px)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1.15rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                Print Route Order Sheet (A4)
                <span
                  style={{
                    fontSize: '0.66rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    backgroundColor: sheetTheme === 'BW' ? '#334155' : '#1e40af',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  {sheetTheme === 'BW' ? '⬛ Black & White' : '🔷 Navy'}
                </span>
                {headerStyle === 'NONE' && (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 700,
                    }}
                  >
                    No Title/Header/Footer ✓
                  </span>
                )}
              </h3>
              <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                Black & white sample sheet with customizable columns, A4 formats, and zero ink-waste design
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || printableShops.length === 0}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: printableShops.length === 0 ? 'not-allowed' : 'pointer',
                opacity: printableShops.length === 0 ? 0.6 : 1,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.4)',
              }}
              title="Print Sheet / Save as PDF via system dialog"
            >
              <Printer size={15} />
              <span>{isPrinting ? 'Printing...' : 'Print Sheet / PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || printableShops.length === 0}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.45rem 0.8rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: printableShops.length === 0 ? 'not-allowed' : 'pointer',
                opacity: printableShops.length === 0 ? 0.6 : 1,
              }}
              title="Download direct PDF file"
            >
              <Download size={14} />
              <span>{isDownloadingPdf ? 'Generating...' : 'Get PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '0.35rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Controls + Right Preview */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          
          {/* LEFT SIDEBAR: Controls & Filters */}
          <div
            style={{
              width: '370px',
              minWidth: '330px',
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '0.85rem',
              gap: '0.75rem',
              flexShrink: 0,
            }}
          >
            {/* 1. Header & Design ("black white sample sheet degise not tital head footer") */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #0f172a',
                borderRadius: '8px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                }}
              >
                <span>🎨 Sheet Layout & Header ("not title head footer")</span>
              </label>

              {/* Header Style Selector */}
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Title & Header:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setHeaderStyle('NONE')}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: headerStyle === 'NONE' ? 800 : 500,
                      borderRadius: '4px',
                      border: headerStyle === 'NONE' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: headerStyle === 'NONE' ? '#f0fdf4' : '#ffffff',
                      color: headerStyle === 'NONE' ? '#166534' : '#475569',
                    }}
                    title="No title, No header: table starts directly at top of sheet"
                  >
                    🚫 No Header
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeaderStyle('MINIMAL')}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: headerStyle === 'MINIMAL' ? 800 : 500,
                      borderRadius: '4px',
                      border: headerStyle === 'MINIMAL' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: headerStyle === 'MINIMAL' ? '#eff6ff' : '#ffffff',
                      color: headerStyle === 'MINIMAL' ? '#1d4ed8' : '#475569',
                    }}
                    title="1 compact line showing date and route"
                  >
                    📄 1-Line Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeaderStyle('FULL')}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: headerStyle === 'FULL' ? 800 : 500,
                      borderRadius: '4px',
                      border: headerStyle === 'FULL' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: headerStyle === 'FULL' ? '#eff6ff' : '#ffffff',
                      color: headerStyle === 'FULL' ? '#1d4ed8' : '#475569',
                    }}
                    title="Company title, address and full letterhead banner"
                  >
                    🏢 Full Title
                  </button>
                </div>
              </div>

              {/* Theme Selector: B&W vs Navy */}
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Print Color Style:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setSheetTheme('BW')}
                    style={{
                      padding: '0.3rem',
                      fontSize: '0.72rem',
                      fontWeight: sheetTheme === 'BW' ? 800 : 500,
                      borderRadius: '4px',
                      border: sheetTheme === 'BW' ? '1.5px solid #000000' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: sheetTheme === 'BW' ? '#0f172a' : '#ffffff',
                      color: sheetTheme === 'BW' ? '#ffffff' : '#334155',
                    }}
                  >
                    ⬛ Black & White (Clean)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetTheme('NAVY')}
                    style={{
                      padding: '0.3rem',
                      fontSize: '0.72rem',
                      fontWeight: sheetTheme === 'NAVY' ? 800 : 500,
                      borderRadius: '4px',
                      border: sheetTheme === 'NAVY' ? '1.5px solid #1e3a8a' : '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: sheetTheme === 'NAVY' ? '#1e3a8a' : '#ffffff',
                      color: sheetTheme === 'NAVY' ? '#ffffff' : '#334155',
                    }}
                  >
                    🔷 Navy Style
                  </button>
                </div>
              </div>

              {/* Footer toggle ("not footer") */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#1e293b', cursor: 'pointer', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  style={{ accentColor: '#2563eb' }}
                />
                <span>Show Footer & Signatures ({showSignatures ? 'ON' : 'OFF'})</span>
              </label>
            </div>

            {/* 2. Route Selection (Multiple Route Selection) */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#1e293b',
                    margin: 0,
                  }}
                >
                  <MapPin size={13} color="#2563eb" />
                  <span>Route Selection</span>
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '0.08rem 0.35rem',
                      borderRadius: '999px',
                    }}
                  >
                    {isAllRoutesSelected || selectedRouteIds.size === routes.length
                      ? 'All'
                      : `${selectedRouteIds.size}/${routes.length}`}
                  </span>
                </label>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllRoutes}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllRoutes}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Scrollable list of Routes with checkboxes */}
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* All Routes quick toggle item */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.28rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    borderBottom: '1px solid #cbd5e1',
                    backgroundColor: isAllRoutesSelected ? '#eff6ff' : 'transparent',
                    color: isAllRoutesSelected ? '#1d4ed8' : '#334155',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAllRoutesSelected}
                    onChange={() => {
                      if (isAllRoutesSelected) {
                        handleDeselectAllRoutes();
                      } else {
                        handleSelectAllRoutes();
                      }
                    }}
                    style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <span style={{ flex: 1 }}>All Routes</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>({effectiveCustomers.length} shops)</span>
                </label>

                {/* Individual Route checkboxes */}
                {routes.map((r) => {
                  const isChecked = selectedRouteIds.has(r.id);
                  const count = effectiveCustomers.filter(
                    (c) =>
                      c.route === r.id ||
                      c.route_details?.id === r.id ||
                      (c.route_details?.name && c.route_details.name.toLowerCase() === r.name.toLowerCase())
                  ).length;

                  return (
                    <label
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.25rem 0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.73rem',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isChecked ? '#ffffff' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRoute(r.id)}
                        style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                      />
                      <span
                        style={{
                          fontWeight: isChecked ? 700 : 500,
                          color: isChecked ? '#0f172a' : '#64748b',
                          flex: 1,
                        }}
                      >
                        {r.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          padding: '0.04rem 0.25rem',
                          backgroundColor: isChecked ? '#dbeafe' : '#f1f5f9',
                          color: isChecked ? '#1e40af' : '#64748b',
                          borderRadius: '3px',
                          fontWeight: 600,
                        }}
                      >
                        {count} shops
                      </span>
                    </label>
                  );
                })}
              </div>

              {assignedDriversString && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.68rem',
                    color: '#047857',
                    background: '#ecfdf5',
                    padding: '0.2rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  <Truck size={12} />
                  <span>Driver(s): <strong>{assignedDriversString}</strong></span>
                </div>
              )}
            </div>

            {/* 3. Shop Selection ("shopp selction selction") */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#1e293b',
                    margin: 0,
                  }}
                >
                  <Store size={13} color="#2563eb" />
                  <span>Shop Selection</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '0.08rem 0.35rem',
                      borderRadius: '999px',
                    }}
                  >
                    {selectedShopIds.size} / {routeCustomers.length}
                  </span>
                </label>

                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllShops}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllShops}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Shop search input */}
              <div style={{ position: 'relative' }}>
                <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter shops..."
                  value={shopSearchQuery}
                  onChange={(e) => setShopSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '26px',
                    paddingLeft: '24px',
                    paddingRight: '6px',
                    fontSize: '0.72rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                  }}
                />
              </div>

              {/* Scrollable list of shops */}
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  border: '1px solid #f1f5f9',
                  borderRadius: '4px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {filteredRouteCustomers.length === 0 ? (
                  <div style={{ padding: '0.5rem', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                    No shops in route
                  </div>
                ) : (
                  filteredRouteCustomers.map((c) => {
                    const isChecked = selectedShopIds.has(String(c.id));
                    const rowData = rowsByCustomerId.get(String(c.id));
                    const hasTodayOrder = Boolean(
                      rowData &&
                        (parseInt(rowData.kubbusQty || '0', 10) > 0 ||
                          parseInt(rowData.romaliQty || '0', 10) > 0 ||
                          parseFloat(rowData.cashAmount || '0') > 0 ||
                          rowData.orderId)
                    );

                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.3rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: isChecked ? '#ffffff' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleShop(String(c.id))}
                          style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <span
                          style={{
                            fontWeight: isChecked ? 700 : 500,
                            color: isChecked ? '#0f172a' : '#64748b',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </span>

                        {hasTodayOrder && (
                          <span
                            style={{
                              fontSize: '0.6rem',
                              padding: '0.04rem 0.25rem',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              borderRadius: '3px',
                              fontWeight: 700,
                            }}
                          >
                            Order ✓
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. Sheet Mode & Columns ("only name add there coulem") */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  margin: 0,
                }}
              >
                <Sliders size={13} color="#2563eb" />
                <span>Data Mode & Columns</span>
              </label>

              {/* Mode switch */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '3px',
                  background: '#f1f5f9',
                  padding: '2px',
                  borderRadius: '5px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSheetMode('FILLED')}
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: sheetMode === 'FILLED' ? 800 : 600,
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: sheetMode === 'FILLED' ? '#ffffff' : 'transparent',
                    color: sheetMode === 'FILLED' ? '#1e40af' : '#64748b',
                    boxShadow: sheetMode === 'FILLED' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  📋 Today's Orders
                </button>
                <button
                  type="button"
                  onClick={() => setSheetMode('BLANK')}
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: sheetMode === 'BLANK' ? 800 : 600,
                    borderRadius: '3px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: sheetMode === 'BLANK' ? '#ffffff' : 'transparent',
                    color: sheetMode === 'BLANK' ? '#b45309' : '#64748b',
                    boxShadow: sheetMode === 'BLANK' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                  title="Only names in customer column + blank boxes for handwriting"
                >
                  ✍️ Blank Writing Sheet
                </button>
              </div>

              {/* Column checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginTop: '0.2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#0f172a', fontWeight: 700 }}>
                  <input type="checkbox" checked={true} disabled={true} style={{ accentColor: '#2563eb' }} />
                  <span>Shop Name (Fixed)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }} title="Hide/show route name under shop name">
                  <input
                    type="checkbox"
                    checked={showRouteSubtitle}
                    onChange={(e) => setShowRouteSubtitle(e.target.checked)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <span>Show Route Subtitle</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPrevDue} onChange={(e) => setShowPrevDue(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Previous Due</span>
                </label>

                {showPrevDue && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.45rem', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '0.05rem', marginBottom: '0.1rem' }}>
                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#334155' }}>Prev Due Mode:</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button
                        type="button"
                        onClick={() => setPrevDueBlank(false)}
                        style={{
                          padding: '0.12rem 0.35rem',
                          fontSize: '0.66rem',
                          fontWeight: !prevDueBlank ? 800 : 500,
                          borderRadius: '3px',
                          border: !prevDueBlank ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: !prevDueBlank ? '#eff6ff' : '#ffffff',
                          color: !prevDueBlank ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        ₹ Show Dues
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrevDueBlank(true)}
                        style={{
                          padding: '0.12rem 0.35rem',
                          fontSize: '0.66rem',
                          fontWeight: prevDueBlank ? 800 : 500,
                          borderRadius: '3px',
                          border: prevDueBlank ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                          backgroundColor: prevDueBlank ? '#fffbeb' : '#ffffff',
                          color: prevDueBlank ? '#b45309' : '#64748b',
                          cursor: 'pointer',
                        }}
                        title="Leave Prev Due column completely blank for handwriting"
                      >
                        ✍️ Blank Box
                      </button>
                    </div>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Owner / Phone</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showCash} onChange={(e) => setShowCash(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Cash Amount</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showGPay} onChange={(e) => setShowGPay(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>GPay Amount</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showTotalBill} onChange={(e) => setShowTotalBill(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Bill Total</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Disc (₹)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Balance Due</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showSignatureCol} onChange={(e) => setShowSignatureCol(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                  <span>Signature / Note</span>
                </label>
              </div>

              {/* Dynamic Product Columns ("Product Columns: dymaic") */}
              <div style={{ marginTop: '0.3rem', paddingTop: '0.35rem', borderTop: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                    Product Columns (Dynamic)
                  </span>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '0.06rem 0.35rem',
                      borderRadius: '999px',
                    }}
                  >
                    {allDynamicProducts.filter((p) => selectedProductIds.has(p.id)).length} / {allDynamicProducts.length}
                  </span>
                </div>

                {/* Quick Selection Buttons */}
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllProducts}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    All ({allDynamicProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectOnlyOrderedProducts}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.4rem',
                      borderRadius: '3px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      cursor: 'pointer',
                      color: '#047857',
                    }}
                    title="Dynamically show only products with actual orders today"
                  >
                    ⚡ Only Ordered
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllProducts}
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    Clear
                  </button>
                </div>

                {/* List of dynamic products with checkboxes */}
                <div
                  style={{
                    maxHeight: '135px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '0.35rem',
                  }}
                >
                  {allDynamicProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.id);
                    const todayQty = todayProductQuantities[p.id] || 0;

                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.22rem 0.45rem',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected ? '#ffffff' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleProduct(p.id)}
                          style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                        <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f172a' : '#64748b', flex: 1 }}>
                          {p.name}
                          {p.unitPrice > 0 && <span style={{ opacity: 0.65, fontSize: '0.64rem', marginLeft: '3px' }}>(₹{p.unitPrice.toFixed(0)})</span>}
                          {p.isCustom && <span style={{ fontSize: '0.6rem', color: '#b45309', marginLeft: '3px' }}>[Custom]</span>}
                        </span>

                        {todayQty > 0 && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '0.04rem 0.25rem',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              borderRadius: '3px',
                              fontWeight: 700,
                            }}
                          >
                            {todayQty} ps
                          </span>
                        )}

                        {p.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveCustomCol(p.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontSize: '0.85rem',
                              fontWeight: 900,
                              lineHeight: 1,
                            }}
                            title="Delete custom column"
                          >
                            ×
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Add Custom Column Inline Form */}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="text"
                    placeholder="+ Add custom column (e.g. Bun, Returns)..."
                    value={customColInput}
                    onChange={(e) => setCustomColInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCol(e);
                      }
                    }}
                    style={{
                      flex: 1,
                      height: '24px',
                      padding: '0 6px',
                      fontSize: '0.7rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '3px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCol}
                    disabled={!customColInput.trim()}
                    style={{
                      height: '24px',
                      padding: '0 0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: customColInput.trim() ? 'pointer' : 'not-allowed',
                      opacity: customColInput.trim() ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Extra blank rows */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>Extra Blank Rows:</span>
                <select
                  className="form-select"
                  value={extraBlankRowsCount}
                  onChange={(e) => setExtraBlankRowsCount(parseInt(e.target.value, 10))}
                  style={{ height: '24px', fontSize: '0.7rem', padding: '0 0.3rem' }}
                >
                  <option value={0}>None</option>
                  <option value={3}>+3 Rows</option>
                  <option value={5}>+5 Rows</option>
                  <option value={10}>+10 Rows</option>
                </select>
              </div>
            </div>

            {/* 5. A4 Size & Density ("a4 size selction") */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  margin: 0,
                }}
              >
                <Layers size={13} color="#2563eb" />
                <span>A4 Paper & Density</span>
              </label>

              {/* Orientation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setPageOrientation('portrait')}
                  style={{
                    padding: '0.3rem',
                    fontSize: '0.72rem',
                    fontWeight: pageOrientation === 'portrait' ? 800 : 600,
                    borderRadius: '4px',
                    border: pageOrientation === 'portrait' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    backgroundColor: pageOrientation === 'portrait' ? '#eff6ff' : '#ffffff',
                    color: pageOrientation === 'portrait' ? '#1d4ed8' : '#475569',
                  }}
                >
                  📄 A4 Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setPageOrientation('landscape')}
                  style={{
                    padding: '0.3rem',
                    fontSize: '0.72rem',
                    fontWeight: pageOrientation === 'landscape' ? 800 : 600,
                    borderRadius: '4px',
                    border: pageOrientation === 'landscape' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    backgroundColor: pageOrientation === 'landscape' ? '#eff6ff' : '#ffffff',
                    color: pageOrientation === 'landscape' ? '#1d4ed8' : '#475569',
                  }}
                >
                  📑 A4 Landscape
                </button>
              </div>

              {/* Density */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>Row Height:</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {(
                    [
                      { id: 'compact', label: 'Compact' },
                      { id: 'standard', label: 'Standard' },
                      { id: 'spacious', label: 'Spacious' },
                      { id: 'auto', label: '⚡ Auto-Fit' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setRowDensity(d.id)}
                      style={{
                        padding: '0.15rem 0.35rem',
                        fontSize: '0.66rem',
                        fontWeight: rowDensity === d.id ? 800 : 500,
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: rowDensity === d.id ? '#0f172a' : '#f1f5f9',
                        color: rowDensity === d.id ? '#ffffff' : '#475569',
                      }}
                      title={d.id === 'auto' ? 'Automatically fits all shops onto 1 single page' : undefined}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fit strictly to 1 A4 page ("adn pdf make a4 size next page not show") */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  color: '#0f172a',
                  fontWeight: 700,
                  backgroundColor: fitToOnePage ? '#ecfdf5' : '#f8fafc',
                  padding: '0.25rem 0.45rem',
                  borderRadius: '4px',
                  border: fitToOnePage ? '1px solid #10b981' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={fitToOnePage}
                  onChange={(e) => setFitToOnePage(e.target.checked)}
                  style={{ accentColor: '#059669', cursor: 'pointer' }}
                />
                <span style={{ color: fitToOnePage ? '#065f46' : '#475569' }}>
                  🎯 Fit to 1 A4 Page (No Next Page)
                </span>
              </label>

              {/* Grid Lines Thickness ("low line thin") */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>Grid Lines:</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {(
                    [
                      { id: 'THIN', label: 'Thin (Fine)' },
                      { id: 'HAIRLINE', label: 'Hairline' },
                      { id: 'STANDARD', label: 'Standard' },
                    ] as const
                  ).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLineThickness(l.id)}
                      style={{
                        padding: '0.15rem 0.35rem',
                        fontSize: '0.66rem',
                        fontWeight: lineThickness === l.id ? 800 : 500,
                        borderRadius: '3px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: lineThickness === l.id ? '#0f172a' : '#f1f5f9',
                        color: lineThickness === l.id ? '#ffffff' : '#475569',
                      }}
                      title={l.id === 'THIN' ? 'Crisp thin lines (recommended)' : l.id === 'HAIRLINE' ? 'Ultra light hairline' : 'Dark thick borders'}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={showSummaryTotals} onChange={(e) => setShowSummaryTotals(e.target.checked)} style={{ accentColor: '#2563eb' }} />
                <span>Show Totals / Summary Row</span>
              </label>
            </div>

          </div>

          {/* RIGHT SIDE: Real-time Live A4 Visual Preview ("rount perive come") */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#e2e8f0',
              overflowY: 'auto',
              overflowX: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '1rem',
              minWidth: 0,
            }}
          >
            {/* Preview Banner */}
            <div
              style={{
                width: pageOrientation === 'landscape' ? '297mm' : '210mm',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.4rem',
                fontSize: '0.74rem',
                color: '#475569',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Eye size={13} color="#2563eb" />
                <span>
                  Live A4 Preview ({pageOrientation.toUpperCase()}) • <strong>{printableShops.length} Shops</strong>
                  {headerStyle === 'NONE' && ' • (No Title/Header)'}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem' }}>
                A4 Paper Size • {sheetTheme === 'BW' ? 'Black & White' : 'Navy'}
              </div>
            </div>

            {/* The A4 Printable Paper Element */}
            <div
              ref={printSheetRef}
              id="route-sheet-printable-area"
              style={{
                width: pageOrientation === 'landscape' ? '297mm' : '210mm',
                minHeight: pageOrientation === 'landscape' ? '210mm' : '297mm',
                height: fitToOnePage ? (pageOrientation === 'landscape' ? '210mm' : '297mm') : 'auto',
                maxHeight: fitToOnePage ? (pageOrientation === 'landscape' ? '210mm' : '297mm') : undefined,
                overflow: fitToOnePage ? 'hidden' : 'visible',
                backgroundColor: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: headerStyle === 'NONE' ? (pageOrientation === 'landscape' ? '4mm 6mm' : '5mm 7mm') : pageOrientation === 'landscape' ? '5mm 7mm' : '7mm 9mm',
                boxSizing: 'border-box',
                color: '#000000',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: effectiveFontSize,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Optional Header 1: FULL LETTERHEAD BANNER */}
              {headerStyle === 'FULL' && (
                <div style={{ borderBottom: '2px solid #000000', paddingBottom: '0.35rem', marginBottom: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1
                        style={{
                          margin: 0,
                          fontSize: '17px',
                          fontWeight: 900,
                          letterSpacing: '-0.02em',
                          color: '#000000',
                          textTransform: 'uppercase',
                        }}
                      >
                        {businessName || settings?.business_name || 'Zamzam Foods Wholesale'}
                      </h1>
                      <div style={{ fontSize: '9.5px', color: '#333333', marginTop: '1px', lineHeight: 1.3 }}>
                        {settings?.address || 'Main Road, Pandikkad, Malappuram, Kerala'}
                        {businessPhone && <span> • Ph: {businessPhone}</span>}
                        {gstNumber && <span> • GSTIN: {gstNumber}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#000000',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {sheetMode === 'FILLED' ? 'Route Delivery Sheet' : 'Route Order Sheet'}
                      </div>
                      <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#333333', marginTop: '1px' }}>
                        Date: {formatDate(orderDate) || orderDate}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: sheetTheme === 'BW' ? '#ffffff' : '#f1f5f9',
                      padding: '0.2rem 0.4rem',
                      marginTop: '0.3rem',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      border: '1px solid #000000',
                    }}
                  >
                    <div>
                      <span>ROUTE: </span>
                      <strong style={{ color: '#000000' }}>
                        {selectedRouteNamesString.toUpperCase()}
                      </strong>
                      {assignedDriversString && (
                        <span style={{ marginLeft: '12px' }}>
                          DRIVER: <strong>{assignedDriversString}</strong>
                        </span>
                      )}
                    </div>

                    <div>
                      <span>TOTAL STOPS: </span>
                      <strong style={{ color: '#000000' }}>{printableShops.length} SHOPS</strong>
                      {sheetMode === 'FILLED' && calculatedTotals.totalPieces > 0 && (
                        <span style={{ marginLeft: '10px' }}>
                          • TOTAL: <strong>{calculatedTotals.totalPieces} ps</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Header 2: MINIMAL 1-LINE HEADER */}
              {headerStyle === 'MINIMAL' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.3rem',
                    marginBottom: '0.35rem',
                    borderBottom: '1.5px solid #000000',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#000000',
                  }}
                >
                  <div>
                    ROUTE: <strong>{selectedRouteNamesString.toUpperCase()}</strong>
                    {assignedDriversString && <span style={{ marginLeft: '12px' }}>DRIVER: {assignedDriversString}</span>}
                  </div>
                  <div>
                    DATE: <strong>{formatDate(orderDate) || orderDate}</strong> • STOPS: <strong>{printableShops.length}</strong>
                  </div>
                </div>
              )}

              {/* If headerStyle === 'NONE', NOTHING IS RENDERED ABOVE THE TABLE! Pure Grid Sheet! */}

              {/* Main Data Table */}
              <div style={{ flex: 1, width: '100%' }}>
                {/* Dynamic styling constants */}
                {(() => {
                  const rowHeight = `${effectiveRowHeightPx}px`;

                  const cellBorder =
                    lineThickness === 'THIN'
                      ? '0.5px solid #555555'
                      : lineThickness === 'HAIRLINE'
                      ? '0.4px solid #888888'
                      : sheetTheme === 'BW'
                      ? '1px solid #000000'
                      : '1px solid #334155';

                  const headerBorder =
                    lineThickness === 'THIN'
                      ? '0.75px solid #333333'
                      : lineThickness === 'HAIRLINE'
                      ? '0.5px solid #555555'
                      : sheetTheme === 'BW'
                      ? '1.5px solid #000000'
                      : '1px solid #0f172a';

                  const headerBottom =
                    lineThickness === 'THIN'
                      ? '1.5px solid #111111'
                      : lineThickness === 'HAIRLINE'
                      ? '1px solid #333333'
                      : sheetTheme === 'BW'
                      ? '2.5px solid #000000'
                      : '1.5px solid #0f172a';

                  const totalsBorder =
                    lineThickness === 'THIN'
                      ? '1.5px solid #111111'
                      : lineThickness === 'HAIRLINE'
                      ? '1px solid #333333'
                      : '2.5px solid #000000';

                  return (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        tableLayout: 'fixed',
                        fontSize: 'inherit',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: sheetTheme === 'BW' ? '#ffffff' : '#1e293b',
                            color: sheetTheme === 'BW' ? '#000000' : '#ffffff',
                            borderBottom: headerBottom,
                            height: rowHeight,
                          }}
                        >
                          <th style={{ width: '26px', padding: '0 2px', textAlign: 'center', border: headerBorder, fontWeight: 900, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                            #
                          </th>
                          <th style={{ width: '200px', padding: '0 6px', textAlign: 'left', border: headerBorder, fontWeight: 900, height: rowHeight, verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box' }}>
                            Shop Name
                          </th>
                          {showPhone && (
                            <th style={{ width: '80px', padding: '0 4px', textAlign: 'left', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Phone
                            </th>
                          )}
                          {showPrevDue && (
                            <th style={{ width: '65px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Prev Due
                            </th>
                          )}

                          {/* Dynamic Product Columns */}
                          {allDynamicProducts
                            .filter((p) => selectedProductIds.has(p.id))
                            .map((p) => (
                              <th
                                key={p.id}
                                style={{
                                  width: selectedProductIds.size > 5 ? '48px' : '56px',
                                  padding: '0 2px',
                                  textAlign: 'center',
                                  border: headerBorder,
                                  fontWeight: 900,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {p.name}
                              </th>
                            ))}

                          {showTotalBill && sheetMode === 'FILLED' && (
                            <th style={{ width: '65px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Total Bill
                            </th>
                          )}

                          {showDiscount && (
                            <th style={{ width: '56px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Disc (₹)
                            </th>
                          )}

                          {showCash && (
                            <th style={{ width: '56px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Cash (₹)
                            </th>
                          )}

                          {showGPay && (
                            <th style={{ width: '56px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              GPay (₹)
                            </th>
                          )}

                          {showBalance && (
                            <th style={{ width: '68px', padding: '0 4px', textAlign: 'right', border: headerBorder, fontWeight: 900, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Balance
                            </th>
                          )}

                          {showSignatureCol && (
                            <th style={{ width: '70px', padding: '0 4px', textAlign: 'center', border: headerBorder, fontWeight: 800, height: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }}>
                              Signature
                            </th>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {printableShops.length === 0 ? (
                          <tr>
                            <td
                              colSpan={12}
                              style={{
                                padding: '2rem',
                                textAlign: 'center',
                                color: '#000000',
                                border: cellBorder,
                              }}
                            >
                              No shops selected for printing. Check one or more shops on the left panel.
                            </td>
                          </tr>
                        ) : (
                          printableShops.map((customer, idx) => {
                            const rowData = rowsByCustomerId.get(String(customer.id));
                            const prevDueVal = parseFloat(rowData?.customerBalance || String(customer.current_balance || '0')) || 0;
                            const cashVal = parseFloat(rowData?.cashAmount || '0') || 0;
                            const gpayVal = parseFloat(rowData?.gpayAmount || '0') || 0;
                            const discVal = parseFloat(rowData?.discountAmount || '0') || 0;

                            let rowBill = 0;
                            const productQuantities: Record<string, number> = {};
                            allDynamicProducts.forEach((p) => {
                              if (p.isCustom) return;
                              let qStr = rowData?.productQuantities?.[p.id];
                              if (qStr === undefined) {
                                const pNameLower = p.name.toLowerCase();
                                const pCodeLower = (p.code || '').toLowerCase();
                                if (pNameLower.includes('kubbus') || pCodeLower.includes('kub') || pCodeLower === 'kbs') {
                                  qStr = rowData?.kubbusQty;
                                } else if (pNameLower.includes('romali') || pCodeLower.includes('rom') || pCodeLower === 'pri') {
                                  qStr = rowData?.romaliQty;
                                }
                              }
                              const qty = parseInt(qStr || '0', 10) || 0;
                              productQuantities[p.id] = qty;
                              if (qty > 0) {
                                rowBill += qty * (p.unitPrice || 0);
                              }
                            });

                            const netBill = Math.max(0, rowBill - discVal);
                            const rowBalance = prevDueVal + (sheetMode === 'FILLED' ? netBill - (cashVal + gpayVal) : 0);

                            return (
                              <tr
                                key={customer.id}
                                style={{
                                  height: rowHeight,
                                  maxHeight: rowHeight,
                                  backgroundColor: '#ffffff',
                                  color: '#000000',
                                  boxSizing: 'border-box',
                                }}
                              >
                                <td
                                  style={{
                                    textAlign: 'center',
                                    padding: '0 2px',
                                    border: cellBorder,
                                    fontWeight: 700,
                                    height: rowHeight,
                                    maxHeight: rowHeight,
                                    verticalAlign: 'middle',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {idx + 1}
                                </td>

                                {/* Shop Name - Strictly single line, uniform height, no wrapping */}
                                <td
                                  style={{
                                    width: '200px',
                                    padding: '0 6px',
                                    border: cellBorder,
                                    height: rowHeight,
                                    maxHeight: rowHeight,
                                    verticalAlign: 'middle',
                                    overflow: 'hidden',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div
                                    className="shop-name-cell"
                                    style={{
                                      fontWeight: 800,
                                      color: '#000000',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      lineHeight: '1.15',
                                      fontSize: effectiveFontSize,
                                    }}
                                    title={customer.name}
                                  >
                                    {customer.name}
                                  </div>
                                  {showRouteSubtitle && customer.route_details?.name && (
                                    <div
                                      style={{
                                        fontSize: '7px',
                                        color: '#666666',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        lineHeight: 1,
                                        marginTop: '1px',
                                      }}
                                    >
                                      ({customer.route_details.name})
                                    </div>
                                  )}
                                </td>

                                {showPhone && (
                                  <td
                                    style={{
                                      padding: '0 4px',
                                      border: cellBorder,
                                      color: '#000000',
                                      fontSize: '9px',
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {customer.phone || customer.owner_name || '-'}
                                  </td>
                                )}

                                {showPrevDue && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 700,
                                      color: '#000000',
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {prevDueBlank ? (
                                      <div style={{ height: '100%', width: '100%', minHeight: '14px' }} />
                                    ) : prevDueVal > 0 ? (
                                      `₹${prevDueVal.toFixed(0)}`
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                )}

                                {/* Product cells */}
                                {allDynamicProducts
                                  .filter((p) => selectedProductIds.has(p.id))
                                  .map((p) => {
                                    const qty = productQuantities[p.id] || 0;
                                    return (
                                      <td
                                        key={p.id}
                                        style={{
                                          textAlign: 'center',
                                          padding: '0 2px',
                                          border: cellBorder,
                                          fontWeight: 800,
                                          color: '#000000',
                                          height: rowHeight,
                                          maxHeight: rowHeight,
                                          verticalAlign: 'middle',
                                          boxSizing: 'border-box',
                                        }}
                                      >
                                        {sheetMode === 'FILLED' && !p.isCustom ? (
                                          qty > 0 ? qty : '-'
                                        ) : (
                                          <div style={{ height: '100%', width: '100%', minHeight: '14px' }} />
                                        )}
                                      </td>
                                    );
                                  })}

                                {showTotalBill && sheetMode === 'FILLED' && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 800,
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {netBill > 0 ? `₹${netBill.toFixed(0)}` : '-'}
                                  </td>
                                )}

                                {showDiscount && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 700,
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {sheetMode === 'FILLED' ? (discVal > 0 ? `₹${discVal.toFixed(0)}` : '-') : ''}
                                  </td>
                                )}

                                {showCash && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 700,
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {sheetMode === 'FILLED' ? (cashVal > 0 ? `₹${cashVal.toFixed(0)}` : '-') : ''}
                                  </td>
                                )}

                                {showGPay && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 700,
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {sheetMode === 'FILLED' ? (gpayVal > 0 ? `₹${gpayVal.toFixed(0)}` : '-') : ''}
                                  </td>
                                )}

                                {showBalance && (
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      padding: '0 4px',
                                      border: cellBorder,
                                      fontWeight: 800,
                                      color: '#000000',
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {sheetMode === 'FILLED' ? (rowBalance > 0 ? `₹${rowBalance.toFixed(0)}` : '0') : ''}
                                  </td>
                                )}

                                {showSignatureCol && (
                                  <td
                                    style={{
                                      border: cellBorder,
                                      height: rowHeight,
                                      maxHeight: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div style={{ height: '100%', width: '100%', minHeight: '14px' }} />
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}

                        {/* Extra Blank Rows */}
                        {extraBlankRowsCount > 0 &&
                          Array.from({ length: extraBlankRowsCount }).map((_, extraIdx) => {
                            const rowNum = printableShops.length + extraIdx + 1;

                            return (
                              <tr
                                key={`extra-${extraIdx}`}
                                style={{
                                  height: rowHeight,
                                  maxHeight: rowHeight,
                                  backgroundColor: '#ffffff',
                                  boxSizing: 'border-box',
                                }}
                              >
                                <td
                                  style={{
                                    textAlign: 'center',
                                    padding: '0 2px',
                                    border: cellBorder,
                                    fontWeight: 600,
                                    color: '#666666',
                                    height: rowHeight,
                                    maxHeight: rowHeight,
                                    verticalAlign: 'middle',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {rowNum}
                                </td>
                                <td
                                  style={{
                                    padding: '0 6px',
                                    border: cellBorder,
                                    height: rowHeight,
                                    maxHeight: rowHeight,
                                    verticalAlign: 'middle',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div style={{ height: '1px', borderBottom: '1px dashed #999999', width: '80%' }} />
                                </td>
                                {showPhone && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showPrevDue && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {allDynamicProducts
                                  .filter((p) => selectedProductIds.has(p.id))
                                  .map((p) => (
                                    <td key={p.id} style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />
                                  ))}
                                {showTotalBill && sheetMode === 'FILLED' && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showDiscount && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showCash && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showGPay && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showBalance && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                                {showSignatureCol && <td style={{ border: cellBorder, height: rowHeight, maxHeight: rowHeight, verticalAlign: 'middle', boxSizing: 'border-box' }} />}
                              </tr>
                            );
                          })}
                      </tbody>

                      {/* Totals Summary Row */}
                      {showSummaryTotals && printableShops.length > 0 && (
                        <tfoot>
                          <tr
                            style={{
                              backgroundColor: '#ffffff',
                              fontWeight: 900,
                              borderTop: totalsBorder,
                              borderBottom: totalsBorder,
                              color: '#000000',
                              height: rowHeight,
                              maxHeight: rowHeight,
                              boxSizing: 'border-box',
                            }}
                          >
                            <td
                              colSpan={2 + (showPhone ? 1 : 0)}
                              style={{
                                padding: '0 6px',
                                border: totalsBorder,
                                textAlign: 'right',
                                height: rowHeight,
                                verticalAlign: 'middle',
                                boxSizing: 'border-box',
                              }}
                            >
                              TOTALS:
                            </td>

                            {showPrevDue && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {prevDueBlank ? '-' : `₹${calculatedTotals.totalPrevDue.toFixed(0)}`}
                              </td>
                            )}

                            {/* Product sums */}
                            {allDynamicProducts
                              .filter((p) => selectedProductIds.has(p.id))
                              .map((p) => {
                                const sumQty = calculatedTotals.productSums[p.id] || 0;
                                return (
                                  <td
                                    key={p.id}
                                    style={{
                                      textAlign: 'center',
                                      padding: '0 2px',
                                      border: totalsBorder,
                                      height: rowHeight,
                                      verticalAlign: 'middle',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {sheetMode === 'FILLED' && !p.isCustom ? (sumQty > 0 ? sumQty : '') : ''}
                                  </td>
                                );
                              })}

                            {showTotalBill && sheetMode === 'FILLED' && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                ₹{calculatedTotals.totalNetBill.toFixed(0)}
                              </td>
                            )}

                            {showDiscount && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {sheetMode === 'FILLED' ? (calculatedTotals.totalDiscount > 0 ? `₹${calculatedTotals.totalDiscount.toFixed(0)}` : '-') : ''}
                              </td>
                            )}

                            {showCash && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {sheetMode === 'FILLED' ? `₹${calculatedTotals.totalCash.toFixed(0)}` : ''}
                              </td>
                            )}

                            {showGPay && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {sheetMode === 'FILLED' ? `₹${calculatedTotals.totalGPay.toFixed(0)}` : ''}
                              </td>
                            )}

                            {showBalance && (
                              <td
                                style={{
                                  textAlign: 'right',
                                  padding: '0 4px',
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {sheetMode === 'FILLED' ? `₹${calculatedTotals.totalBalance.toFixed(0)}` : ''}
                              </td>
                            )}

                            {showSignatureCol && (
                              <td
                                style={{
                                  border: totalsBorder,
                                  height: rowHeight,
                                  verticalAlign: 'middle',
                                  boxSizing: 'border-box',
                                }}
                              />
                            )}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}
              </div>

              {/* Sheet Footer & Signatures ("not footer" - disabled by default!) */}
              {showSignatures && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginTop: '1rem',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid #000000',
                    fontSize: '9.5px',
                    color: '#000000',
                  }}
                >
                  <div>
                    <div style={{ marginBottom: '16px', fontWeight: 700 }}>Driver Signature:</div>
                    <div style={{ borderBottom: '1px solid #000000', width: '150px' }} />
                  </div>

                  <div style={{ textAlign: 'center', fontSize: '8px', color: '#444444' }}>
                    {formatDate(orderDate) || orderDate} • Zamzam Foods System
                  </div>

                  <div>
                    <div style={{ marginBottom: '16px', fontWeight: 700, textAlign: 'right' }}>Manager / Verified By:</div>
                    <div style={{ borderBottom: '1px solid #000000', width: '150px' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
