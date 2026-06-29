/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import type { Order, OrderStage } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { safeSessionStorage } from './storage';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google API access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Firebase Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCachedToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

// --- Google Sheets REST API Wrappers ---

const DEFAULT_SHEET_NAME = 'Orders';

const HEADERS = [
  'Order ID',
  'Status',
  'Pick Start',
  'Pick End',
  'Check Start',
  'Check End',
  'Delivery Start',
  'Delivery End',
  'Items / Notes',
  'Last Updated',
  'Customer Name',
  'Packing List #',
  'Total Package',
  'Invoice Number',
  'Khan / District',
  'City / Province',
  'Assigned To',
  'BU'
];

/**
 * Creates a brand new Google Sheet with headers initialized.
 */
export async function createOrderSpreadsheet(accessToken: string): Promise<{ id: string; url: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  const body = {
    properties: {
      title: 'Order Fulfillment & Barcode Tracker'
    },
    sheets: [
      {
        properties: {
          title: DEFAULT_SHEET_NAME,
          gridProperties: {
            frozenRowCount: 1
          }
        }
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create Google Spreadsheet');
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write the headers to the new sheet
  await writeHeaders(accessToken, spreadsheetId);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Helper to write headers to Row 1
 */
async function writeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const range = `${DEFAULT_SHEET_NAME}!A1:R1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  
  const body = {
    values: [HEADERS]
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error('Failed to initialize headers in the created spreadsheet');
  }
}

/**
 * Fetches the spreadsheet tabs to check if the 'Orders' sheet exists, creating it if needed.
 */
export async function ensureOrdersSheetExists(accessToken: string, spreadsheetId: string): Promise<string> {
  // Try to fetch spreadsheet metadata to see tab names
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(metaUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Could not access spreadsheet. Please check your Spreadsheet ID.');
  }

  const data = await res.json();
  const sheets = data.sheets || [];
  const exists = sheets.some((s: any) => s.properties?.title === DEFAULT_SHEET_NAME);

  if (!exists) {
    // Add sheet tab named 'Orders'
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const batchBody = {
      requests: [
        {
          addSheet: {
            properties: {
              title: DEFAULT_SHEET_NAME,
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }
        }
      ]
    };

    const addRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batchBody)
    });

    if (!addRes.ok) {
      throw new Error('Failed to create the "Orders" sheet tab in your spreadsheet.');
    }

    await writeHeaders(accessToken, spreadsheetId);
  }

  return DEFAULT_SHEET_NAME;
}

/**
 * Reads all rows from the spreadsheet and parses them into Order objects.
 */
export async function fetchOrdersFromSheet(accessToken: string, spreadsheetId: string): Promise<Order[]> {
  // Ensure the tab exists
  await ensureOrdersSheetExists(accessToken, spreadsheetId);

  const range = `${DEFAULT_SHEET_NAME}!A2:R`; // Fetch all orders to avoid missing rows below 1000
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch values from Google Sheet.');
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows.map((row) => ({
    id: String(row[0] || '').trim(),
    status: (row[1] || 'PENDING_PICKING') as OrderStage,
    pickStart: String(row[2] || ''),
    pickEnd: String(row[3] || ''),
    checkStart: String(row[4] || ''),
    checkEnd: String(row[5] || ''),
    deliveryStart: String(row[6] || ''),
    deliveryEnd: String(row[7] || ''),
    items: String(row[8] || ''),
    lastUpdated: String(row[9] || ''),
    
    // New Sale Order fields
    customerName: String(row[10] || ''),
    packingListNo: String(row[11] || ''),
    totalPackage: String(row[12] || ''),
    invoiceNumber: String(row[13] || ''),
    khanDistrict: String(row[14] || ''),
    cityProvince: String(row[15] || ''),
    assignedTo: String(row[16] || ''),
    bu: String(row[17] || '')
  })).filter(order => order.id !== ''); // Filter active IDs
}

/**
 * Formats ISO date-time strings to "MMM DD, YYYY, HH:mm:ss" format for Google Sheets.
 */
function formatDateTimeForSheets(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  
  return `${month} ${day}, ${year}, ${hh}:${mm}:${ss}`;
}

/**
 * Appends a new order row to the spreadsheet.
 */
export async function addOrderToSheet(
  accessToken: string,
  spreadsheetId: string,
  order: Order,
  targetRowNum?: number
): Promise<void> {
  const range = targetRowNum 
    ? `${DEFAULT_SHEET_NAME}!A${targetRowNum}:R${targetRowNum}`
    : `${DEFAULT_SHEET_NAME}!A:R`;
  
  const url = targetRowNum
    ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
    : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const rowValues = [
    order.id,
    order.status,
    formatDateTimeForSheets(order.pickStart),
    formatDateTimeForSheets(order.pickEnd),
    formatDateTimeForSheets(order.checkStart),
    formatDateTimeForSheets(order.checkEnd),
    formatDateTimeForSheets(order.deliveryStart),
    formatDateTimeForSheets(order.deliveryEnd),
    order.items,
    formatDateTimeForSheets(order.lastUpdated),
    order.customerName || '',
    order.packingListNo || '',
    order.totalPackage || '',
    order.invoiceNumber || '',
    order.khanDistrict || '',
    order.cityProvince || '',
    order.assignedTo || '',
    order.bu || ''
  ];

  const res = await fetch(url, {
    method: targetRowNum ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowValues]
    })
  });

  if (!res.ok) {
    throw new Error('Failed to add a new order to the spreadsheet.');
  }
}

/**
 * Updates an existing order row in the spreadsheet.
 * Calculates sheet index by looking up the order ID.
 */
export async function updateOrderInSheet(
  accessToken: string,
  spreadsheetId: string,
  originalOrders: Order[],
  order: Order,
  originalId?: string
): Promise<void> {
  const targetId = originalId || order.id;
  const rowIndex = originalOrders.findIndex(o => o.id === targetId);
  if (rowIndex === -1) {
    throw new Error(`Order ${targetId} was not found in the spreadsheet to update.`);
  }

  // Row number is rowIndex + 2 (headers at Row 1, indices are 0-based)
  const rowNum = rowIndex + 2;
  const range = `${DEFAULT_SHEET_NAME}!A${rowNum}:R${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const rowValues = [
    order.id,
    order.status,
    formatDateTimeForSheets(order.pickStart),
    formatDateTimeForSheets(order.pickEnd),
    formatDateTimeForSheets(order.checkStart),
    formatDateTimeForSheets(order.checkEnd),
    formatDateTimeForSheets(order.deliveryStart),
    formatDateTimeForSheets(order.deliveryEnd),
    order.items,
    formatDateTimeForSheets(order.lastUpdated),
    order.customerName || '',
    order.packingListNo || '',
    order.totalPackage || '',
    order.invoiceNumber || '',
    order.khanDistrict || '',
    order.cityProvince || '',
    order.assignedTo || '',
    order.bu || ''
  ];

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [rowValues]
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to update order ${order.id} in sheet.`);
  }
}
