/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStage =
  | 'REGISTERED'          // Newly created/registered order
  | 'PENDING_PICKING'     // Created, waiting for Pick Start scan
  | 'PICKING_STARTED'     // Scanned once for picking
  | 'READY_CHECKING'      // Scanned twice for picking, ready for check
  | 'CHECKING_STARTED'    // Scanned once for checking
  | 'READY_DELIVERY'      // Scanned twice for checking, ready for delivery
  | 'DELIVERY_STARTED'    // Scanned once for delivery
  | 'DELIVERED_SUCCESS'   // Scanned twice and marked as Success
  | 'DELIVERED_INCOMPLETE'// Scanned twice and marked as Incomplete
  | 'DELIVERED_RETURN';   // Scanned twice and marked as Return

export interface Order {
  id: string;             // Barcode or QR code ID (e.g. ORD-1001)
  status: OrderStage;
  pickStart: string;      // ISO Timestamp or empty
  pickEnd: string;        // ISO Timestamp or empty
  checkStart: string;     // ISO Timestamp or empty
  checkEnd: string;       // ISO Timestamp or empty
  deliveryStart: string;  // ISO Timestamp or empty
  deliveryEnd: string;    // ISO Timestamp or empty
  items: string;          // Description of items or details
  lastUpdated: string;    // ISO Timestamp
  
  // Custom sale order registration fields
  customerName?: string;
  packingListNo?: string;
  totalPackage?: string;
  invoiceNumber?: string;
  khanDistrict?: string;
  cityProvince?: string;
  assignedTo?: string;
  bu?: string;
}

export interface ScanResult {
  orderId: string;
  previousStage: OrderStage;
  newStage: OrderStage;
  timestamp: string;
  message: string;
  success: boolean;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
}

export interface CustomerMaster {
  customerName: string;
  defaultKhan: string;
  defaultProvince: string;
}

