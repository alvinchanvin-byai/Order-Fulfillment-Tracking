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
import type { Order, OrderStage, UserCredentials, CustomerMaster } from '../types';
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
  'BU',
  'Invoice Amount',
  'SO Date'
];

/**
 * Creates a brand new Google Sheet with headers initialized.
 */
export async function createOrderSpreadsheet(accessToken: string, customTitle?: string): Promise<{ id: string; url: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  const body = {
    properties: {
      title: customTitle || 'Order Fulfillment & Barcode Tracker'
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
  const range = `${DEFAULT_SHEET_NAME}!A1:S1`;
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

  const range = `${DEFAULT_SHEET_NAME}!A2:S`; // Fetch all orders to avoid missing rows below 1000
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

  return rows.map((row) => {
    const rawItems = String(row[8] || '');
    let items = rawItems;
    let deliveryAttempts: any[] = [];
    if (rawItems.includes('||DELIVERY_ATTEMPTS||')) {
      const parts = rawItems.split('||DELIVERY_ATTEMPTS||');
      items = parts[0];
      try {
        deliveryAttempts = JSON.parse(parts[1]);
      } catch (e) {
        console.error('Failed to parse delivery attempts JSON from sheets', e);
      }
    }

    return {
      id: String(row[0] || '').trim(),
      status: (row[1] || 'PENDING_PICKING') as OrderStage,
      pickStart: String(row[2] || ''),
      pickEnd: String(row[3] || ''),
      checkStart: String(row[4] || ''),
      checkEnd: String(row[5] || ''),
      deliveryStart: String(row[6] || ''),
      deliveryEnd: String(row[7] || ''),
      items,
      deliveryAttempts,
      lastUpdated: String(row[9] || ''),
      
      // New Sale Order fields
      customerName: String(row[10] || ''),
      packingListNo: String(row[11] || ''),
      totalPackage: String(row[12] || ''),
      invoiceNumber: String(row[13] || ''),
      khanDistrict: String(row[14] || ''),
      cityProvince: String(row[15] || ''),
      assignedTo: String(row[16] || ''),
      bu: String(row[17] || ''),
      invoiceAmount: String(row[18] || ''),
      soDate: String(row[19] || row[9] || '')
    };
  }).filter(order => order.id !== ''); // Filter active IDs
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
    ? `${DEFAULT_SHEET_NAME}!A${targetRowNum}:T${targetRowNum}`
    : `${DEFAULT_SHEET_NAME}!A:T`;
  
  const url = targetRowNum
    ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`
    : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const serializedItems = order.deliveryAttempts && order.deliveryAttempts.length > 0
    ? `${order.items}||DELIVERY_ATTEMPTS||${JSON.stringify(order.deliveryAttempts)}`
    : order.items;

  const rowValues = [
    order.id,
    order.status,
    formatDateTimeForSheets(order.pickStart),
    formatDateTimeForSheets(order.pickEnd),
    formatDateTimeForSheets(order.checkStart),
    formatDateTimeForSheets(order.checkEnd),
    formatDateTimeForSheets(order.deliveryStart),
    formatDateTimeForSheets(order.deliveryEnd),
    serializedItems,
    formatDateTimeForSheets(order.lastUpdated),
    order.customerName || '',
    order.packingListNo || '',
    order.totalPackage || '',
    order.invoiceNumber || '',
    order.khanDistrict || '',
    order.cityProvince || '',
    order.assignedTo || '',
    order.bu || '',
    order.invoiceAmount || '',
    formatDateTimeForSheets(order.soDate || order.lastUpdated || new Date().toISOString())
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
  const range = `${DEFAULT_SHEET_NAME}!A${rowNum}:T${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const serializedItems = order.deliveryAttempts && order.deliveryAttempts.length > 0
    ? `${order.items}||DELIVERY_ATTEMPTS||${JSON.stringify(order.deliveryAttempts)}`
    : order.items;

  const rowValues = [
    order.id,
    order.status,
    formatDateTimeForSheets(order.pickStart),
    formatDateTimeForSheets(order.pickEnd),
    formatDateTimeForSheets(order.checkStart),
    formatDateTimeForSheets(order.checkEnd),
    formatDateTimeForSheets(order.deliveryStart),
    formatDateTimeForSheets(order.deliveryEnd),
    serializedItems,
    formatDateTimeForSheets(order.lastUpdated),
    order.customerName || '',
    order.packingListNo || '',
    order.totalPackage || '',
    order.invoiceNumber || '',
    order.khanDistrict || '',
    order.cityProvince || '',
    order.assignedTo || '',
    order.bu || '',
    order.invoiceAmount || '',
    formatDateTimeForSheets(order.soDate || order.lastUpdated || new Date().toISOString())
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

// --- Users Synchronization in Google Sheets ---

const USERS_SHEET_NAME = 'Users';

const USERS_HEADERS = [
  'User ID',
  'Username',
  'Password',
  'Role',
  'Status',
  'Created At',
  'Allowed Processes'
];

/**
 * Fetches the spreadsheet tabs to check if the 'Users' sheet exists, creating it if needed.
 */
export async function ensureUsersSheetExists(accessToken: string, spreadsheetId: string): Promise<string> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(metaUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Could not access spreadsheet for users initialization.');
  }

  const data = await res.json();
  const sheets = data.sheets || [];
  const exists = sheets.some((s: any) => s.properties?.title === USERS_SHEET_NAME);

  if (!exists) {
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const batchBody = {
      requests: [
        {
          addSheet: {
            properties: {
              title: USERS_SHEET_NAME,
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
      throw new Error('Failed to create the "Users" sheet tab in your spreadsheet.');
    }

    // Write the headers
    const range = `${USERS_SHEET_NAME}!A1:G1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [USERS_HEADERS] })
    });
  }

  return USERS_SHEET_NAME;
}

/**
 * Reads all rows from the "Users" sheet and parses them into UserCredentials.
 */
export async function fetchUsersFromSheet(accessToken: string, spreadsheetId: string): Promise<UserCredentials[]> {
  await ensureUsersSheetExists(accessToken, spreadsheetId);

  const range = `${USERS_SHEET_NAME}!A2:G`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch user credentials from Google Sheet.');
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows.map((row) => {
    let allowed: ('picking' | 'checking' | 'delivery')[] | undefined = undefined;
    if (row[6]) {
      try {
        allowed = String(row[6]).split(',').map(s => s.trim()).filter(Boolean) as any[];
      } catch (e) {
        allowed = undefined;
      }
    }
    return {
      id: String(row[0] || '').trim(),
      username: String(row[1] || '').trim(),
      password: String(row[2] || '').trim(),
      role: (row[3] || 'limited') as 'admin' | 'limited' | 'view',
      status: (row[4] || 'active') as 'active' | 'inactive',
      createdAt: String(row[5] || ''),
      allowedProcesses: allowed
    };
  }).filter(user => user.id !== '' && user.username !== '');
}

/**
 * Overwrites all users in the "Users" sheet.
 */
export async function saveUsersToSheet(accessToken: string, spreadsheetId: string, users: UserCredentials[]): Promise<void> {
  await ensureUsersSheetExists(accessToken, spreadsheetId);

  // 1. Clear the existing users rows A2:G
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(USERS_SHEET_NAME + '!A2:G')}:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (users.length === 0) return;

  // 2. Write the new user rows
  const range = `${USERS_SHEET_NAME}!A2:G${users.length + 1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const values = users.map(user => [
    user.id,
    user.username,
    user.password || '',
    user.role,
    user.status,
    user.createdAt,
    user.allowedProcesses ? user.allowedProcesses.join(',') : ''
  ]);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to sync users to Google Sheet.');
  }
}

/**
 * Searches the user's Google Drive for existing spreadsheets containing "Order Fulfillment & Barcode Tracker" in the title.
 */
export async function searchOrderSpreadsheets(accessToken: string): Promise<{ id: string; name: string }[]> {
  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and (name contains 'Order' or name contains 'Inventory' or name contains 'Fulfillment' or name contains 'Barcode' or name contains 'ScanFlow' or name contains 'Tracker' or name contains 'Products' or name contains 'Database' or name contains 'Sheet') and trashed = false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=15`;
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!res.ok) {
      console.warn('Drive search failed or returned status:', res.status);
      return [];
    }
    
    const data = await res.json();
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name
    }));
  } catch (err) {
    console.error('Failed to search spreadsheets:', err);
    return [];
  }
}

// --- Setup & Configuration registries in Google Sheets ---

const SETUP_SHEETS = {
  Customer_Registry: { title: 'Customer_Registry', header: ['Customer Name'] },
  Districts_Khan: { title: 'Districts_Khan', header: ['District (Khan)'] },
  Cities_Province: { title: 'Cities_Province', header: ['City / Province'] },
  Business_Units: { title: 'Business_Units', header: ['Business Unit'] },
  Packing_Units: { title: 'Packing_Units', header: ['Packing Unit'] },
  Customer_Master: { title: 'Customer_Master', header: ['Customer Name', 'Default Khan/District', 'Default City/Province'] }
};

// Global in-memory cache map to deduplicate concurrent setup creation calls
const activeSetupPromises = new Map<string, Promise<void>>();

/**
 * Ensures all 6 registry and master list sheet tabs exist in the connected Google Sheet.
 */
export async function ensureSetupSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  const existingPromise = activeSetupPromises.get(spreadsheetId);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const res = await fetch(metaUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Could not access spreadsheet for setup sheets initialization.');
      }

      const data = await res.json();
      const sheets = data.sheets || [];
      const existingTitles = new Set(sheets.map((s: any) => s.properties?.title));

      const missingSheets = Object.values(SETUP_SHEETS).filter(s => !existingTitles.has(s.title));

      if (missingSheets.length > 0) {
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        const batchBody = {
          requests: missingSheets.map(s => ({
            addSheet: {
              properties: {
                title: s.title,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          }))
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
          const errorData = await addRes.json().catch(() => ({}));
          const reason = errorData.error?.message || 'Unknown error response';
          if (reason.includes('already exists')) {
            console.warn('One or more sheets already exists, ignoring:', reason);
          } else {
            throw new Error(`Failed to create setup sheets in your spreadsheet. Reason: ${reason}`);
          }
        }

        // Write headers to newly created sheets
        for (const sheet of missingSheets) {
          const range = `${sheet.title}!A1:${String.fromCharCode(65 + sheet.header.length - 1)}1`;
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
          await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [sheet.header] })
          });
        }
      }
    } finally {
      activeSetupPromises.delete(spreadsheetId);
    }
  })();

  activeSetupPromises.set(spreadsheetId, promise);
  return promise;
}

/**
 * Fetches all setup registries and customer master from the connected Google Sheet.
 */
export async function fetchSetupDataFromSheet(accessToken: string, spreadsheetId: string) {
  await ensureSetupSheetsExist(accessToken, spreadsheetId);

  const ranges = [
    'Customer_Registry!A2:A',
    'Districts_Khan!A2:A',
    'Cities_Province!A2:A',
    'Business_Units!A2:A',
    'Packing_Units!A2:A',
    'Customer_Master!A2:C'
  ];

  const queryRanges = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryRanges}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch setup data from Google Sheet.');
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  const parseStringList = (valRange: any): string[] => {
    const rows = valRange?.values || [];
    return rows.map((r: any) => String(r[0] || '').trim()).filter(Boolean);
  };

  const parseCustomerMasterList = (valRange: any): CustomerMaster[] => {
    const rows = valRange?.values || [];
    return rows.map((r: any) => ({
      customerName: String(r[0] || '').trim(),
      defaultKhan: String(r[1] || '').trim(),
      defaultProvince: String(r[2] || '').trim()
    })).filter((m: CustomerMaster) => m.customerName !== '');
  };

  return {
    customers: parseStringList(valueRanges[0]),
    khans: parseStringList(valueRanges[1]),
    provinces: parseStringList(valueRanges[2]),
    bus: parseStringList(valueRanges[3]),
    packageUnits: parseStringList(valueRanges[4]),
    customerMasters: parseCustomerMasterList(valueRanges[5])
  };
}

/**
 * Overwrites a single registry list in Google Sheets.
 */
export async function saveSetupRegistryToSheet(
  accessToken: string,
  spreadsheetId: string,
  type: 'Customer_Registry' | 'Districts_Khan' | 'Cities_Province' | 'Business_Units' | 'Packing_Units',
  items: string[]
): Promise<void> {
  await ensureSetupSheetsExist(accessToken, spreadsheetId);

  // 1. Clear the existing items A2:A
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(type + '!A2:A')}:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (items.length === 0) return;

  // 2. Write the new items
  const range = `${type}!A2:A${items.length + 1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const values = items.map(item => [item]);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to sync ${type} to Google Sheet.`);
  }
}

/**
 * Overwrites the Customer Master list in Google Sheets.
 */
export async function saveSetupCustomerMastersToSheet(
  accessToken: string,
  spreadsheetId: string,
  masters: CustomerMaster[]
): Promise<void> {
  const type = 'Customer_Master';
  await ensureSetupSheetsExist(accessToken, spreadsheetId);

  // 1. Clear existing items
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(type + '!A2:C')}:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (masters.length === 0) return;

  // 2. Write new items
  const range = `${type}!A2:C${masters.length + 1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const values = masters.map(m => [m.customerName, m.defaultKhan, m.defaultProvince]);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to sync Customer Master list to Google Sheet.');
  }
}

/**
 * Overwrites all setup and config sheets in a batch/concurrent style.
 */
export async function saveAllSetupToSheets(
  accessToken: string,
  spreadsheetId: string,
  data: {
    customers: string[];
    khans: string[];
    provinces: string[];
    bus: string[];
    packageUnits: string[];
    customerMasters: CustomerMaster[];
  }
): Promise<void> {
  await ensureSetupSheetsExist(accessToken, spreadsheetId);
  await Promise.all([
    saveSetupRegistryToSheet(accessToken, spreadsheetId, 'Customer_Registry', data.customers),
    saveSetupRegistryToSheet(accessToken, spreadsheetId, 'Districts_Khan', data.khans),
    saveSetupRegistryToSheet(accessToken, spreadsheetId, 'Cities_Province', data.provinces),
    saveSetupRegistryToSheet(accessToken, spreadsheetId, 'Business_Units', data.bus),
    saveSetupRegistryToSheet(accessToken, spreadsheetId, 'Packing_Units', data.packageUnits),
    saveSetupCustomerMastersToSheet(accessToken, spreadsheetId, data.customerMasters)
  ]);
}



