"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestHash = void 0;
exports.invoiceEligibility = invoiceEligibility;
exports.bearerToken = bearerToken;
exports.parseBillKey = parseBillKey;
exports.loadRetailxBill = loadRetailxBill;
exports.accountBuyerDetails = accountBuyerDetails;
exports.buildInvoicePayload = buildInvoicePayload;
exports.callProvider = callProvider;
exports.normalizedProviderResult = normalizedProviderResult;
exports.getRecord = getRecord;
exports.publicRecord = publicRecord;
exports.cancellationWindow = cancellationWindow;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../config/db");
const env_1 = require("../config/env");
const error_1 = require("../middleware/error");
const mygstcafe_client_1 = require("./mygstcafe.client");
const text = (value) => String(value ?? "").trim();
const number = (value) => Number(value || 0);
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const first = (row, fields) => {
    for (const field of fields) {
        const value = row[field];
        if (value !== undefined && value !== null && text(value) !== "")
            return value;
    }
    return "";
};
function required(value, label) {
    const result = text(value);
    if (!result)
        throw new error_1.AppError(422, `${label} is required for e-invoice.`);
    return result;
}
function validGstin(value, label) {
    const gstin = required(value, label).toUpperCase();
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
        throw new error_1.AppError(422, `${label} is invalid.`);
    }
    return gstin;
}
function invoiceEligibility(rows) {
    const bill = rows[0] ?? {};
    const accountNo = text(bill.ACCOUNT_NO);
    const buyerGstin = text(bill.TAX_NUMBER).toUpperCase();
    const partySource = text(bill._EINVOICE_PARTY_SOURCE) || "BILL_ACCOUNT";
    if (!accountNo || Number(accountNo) === 0) {
        return {
            eligible: false,
            invoiceType: "B2C",
            partySource,
            reason: "An Account Master party is not selected on this bill.",
        };
    }
    if (!buyerGstin) {
        return {
            eligible: false,
            invoiceType: "B2C",
            partySource,
            reason: "Buyer GSTIN is not available on the bill or its matching Account Master record.",
        };
    }
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(buyerGstin)) {
        return {
            eligible: false,
            invoiceType: "B2B",
            partySource,
            reason: "Buyer GSTIN is invalid. Correct the GSTIN in Account Master before generating an IRN.",
        };
    }
    return { eligible: true, invoiceType: "B2B", buyerGstin, partySource };
}
function validPin(value, label) {
    const pin = Number(value);
    if (!Number.isInteger(pin) || pin < 100000 || pin > 999999) {
        throw new error_1.AppError(422, `${label} must be a valid 6-digit PIN code.`);
    }
    return pin;
}
function asDate(value) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        throw new error_1.AppError(422, "Invoice date is invalid.");
    return date;
}
function irpDate(value) {
    const date = asDate(value);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}
function mysqlDate(value) {
    const date = asDate(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function bearerToken(authorization) {
    if (!authorization?.startsWith("Bearer ")) {
        throw new error_1.AppError(401, "RetailX session is required.");
    }
    return authorization;
}
function parseBillKey(body) {
    const tablePrefix = required(body.tablePrefix, "Company");
    const invoiceNo = required(body.invoiceNo, "Invoice number");
    if (tablePrefix.length > 100 || invoiceNo.length > 50) {
        throw new error_1.AppError(422, "Company or invoice number is too long.");
    }
    return { tablePrefix, invoiceNo, billPerforma: "bills" };
}
async function loadRetailxBill(key, authorization, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
        response = await fetch(`${env_1.env.retailx.apiBaseUrl.replace(/\/$/, "")}/api/listBillsRoute/loadBill`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authorization },
            body: JSON.stringify({
                table_prefix: key.tablePrefix,
                INVNO: key.invoiceNo,
                BILL_PERFORMA: key.billPerforma,
            }),
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error.name === "AbortError")
            throw new error_1.AppError(504, "RetailX took too long to load the bill.");
        throw new error_1.AppError(502, "Could not connect to RetailX to verify the bill.");
    }
    finally {
        clearTimeout(timeout);
    }
    if (response.status === 401 || response.status === 403)
        throw new error_1.AppError(401, "RetailX session has expired.");
    if (!response.ok)
        throw new error_1.AppError(502, "RetailX could not load this bill.");
    const result = (await response.json());
    const rows = result?.response;
    if (result?.error || !Array.isArray(rows) || !rows.length) {
        throw new error_1.AppError(404, "RetailX bill was not found.");
    }
    if (text(rows[0].BILL_STATUS).toLowerCase() === "void") {
        throw new error_1.AppError(422, "A void bill cannot be reported as an e-invoice.");
    }
    if (options.enrichParty === false)
        return rows;
    return enrichBillFromAccountMaster(rows, key.tablePrefix, authorization);
}
async function enrichBillFromAccountMaster(rows, tablePrefix, authorization) {
    const bill = rows[0];
    const accountNo = text(bill.ACCOUNT_NO);
    if (!accountNo || Number(accountNo) === 0)
        return rows;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
        const response = await fetch(`${env_1.env.retailx.apiBaseUrl.replace(/\/$/, "")}/api/accountMaster/listAccountMaster`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authorization },
            body: JSON.stringify({
                table_prefix: tablePrefix,
                SECTION_NAME: "",
                mobile: "",
                name: "",
                account_no: accountNo,
                page: 1,
                limit: 100,
            }),
            signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403)
            throw new error_1.AppError(401, "RetailX session has expired.");
        if (!response.ok)
            return rows;
        const result = (await response.json());
        const accounts = Array.isArray(result?.response?.data) ? result.response.data : [];
        if (!accounts.length)
            return rows;
        const account = accounts.find((item) => text(item.ACCOUNT_NO) === accountNo);
        if (!account)
            return rows;
        const fillFields = [
            "ACCOUNT_NO", "NAME", "ADDRESS", "MOBILE", "EMAIL", "TAX_NUMBER",
            "PIN_CODE", "CITY", "STATE", "COUNTRY",
        ];
        return rows.map((row) => {
            const enriched = { ...row, _EINVOICE_PARTY_SOURCE: "ACCOUNT_MASTER" };
            for (const field of fillFields) {
                if (!text(enriched[field]) && text(account[field]))
                    enriched[field] = account[field];
            }
            return enriched;
        });
    }
    catch (error) {
        if (error instanceof error_1.AppError)
            throw error;
        return rows;
    }
    finally {
        clearTimeout(timeout);
    }
}
function normalizedSeller(input) {
    const configured = text(env_1.env.einvoice.gstin).toUpperCase();
    const sellerGstin = text(first(input, ["gstin", "regdNo", "GSTIN"])).toUpperCase();
    const sandbox = env_1.env.einvoice.environment.toLowerCase() !== "production";
    const gstin = sandbox && configured ? configured : validGstin(sellerGstin, "Seller GSTIN");
    if (!sandbox && configured && configured !== gstin) {
        throw new error_1.AppError(422, "This company GSTIN does not match the GSTIN configured in the e-invoice backend.");
    }
    return {
        gstin,
        legalName: required(first(input, ["legalName", "companyName", "company_name"]), "Seller legal name"),
        tradeName: text(first(input, ["tradeName", "companyName", "company_name"])) || undefined,
        address1: required(first(input, ["address1", "address"]), "Seller address"),
        address2: text(first(input, ["address2"])).slice(0, 100) || undefined,
        location: required(first(input, ["location", "city"]), "Seller city/location"),
        pin: validPin(first(input, ["pin", "pincode", "pinCode"]), "Seller PIN code"),
        stateCode: gstin.slice(0, 2),
        phone: text(first(input, ["phone", "mobile"])).replace(/\D/g, "").slice(-10) || undefined,
        email: text(first(input, ["email", "companyEmail", "company_email"])) || undefined,
    };
}
function accountBuyerDetails(rows) {
    const bill = rows[0] ?? {};
    const eligibility = invoiceEligibility(rows);
    if (!eligibility.eligible) {
        throw new error_1.AppError(422, eligibility.reason ?? "This Account Master party is not eligible for e-invoice generation.");
    }
    const buyerGstin = validGstin(bill.TAX_NUMBER, "Buyer GSTIN");
    return {
        Gstin: buyerGstin,
        LglNm: required(bill.NAME, "Buyer legal name").slice(0, 100),
        Pos: buyerGstin.slice(0, 2),
        Addr1: required(bill.ADDRESS, "Buyer address").slice(0, 100),
        Loc: required(bill.CITY, "Buyer city/location").slice(0, 50),
        Pin: validPin(bill.PIN_CODE, "Buyer PIN code"),
        Stcd: buyerGstin.slice(0, 2),
        Ph: text(bill.MOBILE).replace(/\D/g, "").slice(-10) || undefined,
        Em: text(bill.EMAIL) || undefined,
    };
}
function buildInvoicePayload(rows, sellerInput) {
    const bill = rows[0];
    const seller = normalizedSeller(sellerInput);
    const buyer = accountBuyerDetails(rows);
    const buyerGstin = buyer.Gstin;
    const docNo = required(bill.INVNO ?? rows[0].INVNO, "Invoice number");
    if (docNo.length > 16 || !/^[A-Za-z0-9/-]+$/.test(docNo)) {
        throw new error_1.AppError(422, "Invoice number must be 1–16 characters and use only letters, numbers, / or -.");
    }
    let assessable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const items = rows.map((item, index) => {
        const qty = number(first(item, ["QNTY", "QTY", "QUANTITY"]));
        const unitPrice = number(first(item, ["SALE_PRICE", "RATE", "PRICE"]));
        const totalAmount = number(first(item, ["TOTAL", "AMOUNT"])) || round2(qty * unitPrice);
        const discount = number(first(item, ["DISQ_AMT", "DISCOUNT_AMOUNT"]));
        const assAmt = number(first(item, ["AMOUNT", "TAXABLE_AMOUNT"])) || round2(totalAmount - discount);
        const cgstAmt = number(item.TAX1_AMT);
        const sgstAmt = number(item.TAX2_AMT);
        const igstAmt = number(item.TAX3_AMT);
        const gstRate = round2(number(item.TAX1_RATE) + number(item.TAX2_RATE) + number(item.TAX3_RATE));
        const hsn = text(first(item, ["HSN_CODE", "HSN"])).replace(/\D/g, "");
        if (!hsn || hsn.length < 4 || hsn.length > 8)
            throw new error_1.AppError(422, `Item ${index + 1} has an invalid HSN code.`);
        if (qty <= 0)
            throw new error_1.AppError(422, `Item ${index + 1} quantity must be greater than zero.`);
        if (assAmt < 0)
            throw new error_1.AppError(422, `Item ${index + 1} taxable value is invalid.`);
        assessable += assAmt;
        cgst += cgstAmt;
        sgst += sgstAmt;
        igst += igstAmt;
        return {
            SlNo: String(index + 1),
            PrdDesc: text(first(item, ["DESCRIPTION", "ITEM_NAME", "PRODUCT_NAME", "PNAME"])).slice(0, 300) || `Item ${index + 1}`,
            IsServc: text(first(item, ["IS_SERVICE", "IsServc"])).toUpperCase() === "Y" ? "Y" : "N",
            HsnCd: hsn,
            Qty: round2(qty),
            Unit: text(first(item, ["UNIT", "UQC"])).toUpperCase().slice(0, 8) || "NOS",
            UnitPrice: round2(unitPrice),
            TotAmt: round2(totalAmount),
            Discount: round2(discount),
            AssAmt: round2(assAmt),
            GstRt: gstRate,
            CgstAmt: round2(cgstAmt),
            SgstAmt: round2(sgstAmt),
            IgstAmt: round2(igstAmt),
            TotItemVal: round2(number(item.NET_AMOUNT) || assAmt + cgstAmt + sgstAmt + igstAmt),
        };
    });
    const otherCharges = round2(number(bill.HANDLING_CHARGES) + number(bill.DELIVERY_CHARGES));
    const discount = round2(number(bill.DISQ_AMT) + number(bill.LOYALTY_DISCOUNT));
    const roundOff = round2(number(bill.ROUND_OFF));
    const computedTotal = round2(assessable + cgst + sgst + igst + otherCharges - discount + roundOff);
    const invoiceTotal = round2(number(bill.GTOTAL) || computedTotal);
    const payload = {
        Version: "1.1",
        TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
        DocDtls: { Typ: "INV", No: docNo, Dt: irpDate(bill.DATE) },
        SellerDtls: {
            Gstin: seller.gstin, LglNm: seller.legalName.slice(0, 100), TrdNm: seller.tradeName?.slice(0, 100),
            Addr1: seller.address1.slice(0, 100), Addr2: seller.address2, Loc: seller.location.slice(0, 50),
            Pin: seller.pin, Stcd: seller.stateCode, Ph: seller.phone, Em: seller.email,
        },
        BuyerDtls: buyer,
        ItemList: items,
        ValDtls: {
            AssVal: round2(assessable), CgstVal: round2(cgst), SgstVal: round2(sgst), IgstVal: round2(igst),
            CesVal: 0, StCesVal: 0, Discount: discount, OthChrg: otherCharges, RndOffAmt: roundOff, TotInvVal: invoiceTotal,
        },
    };
    return { payload: JSON.parse(JSON.stringify(payload)), seller, buyerGstin, invoiceDate: mysqlDate(bill.DATE) };
}
async function callProvider(path, body) {
    try {
        if (path === "/Invoice")
            return await (0, mygstcafe_client_1.generateEInvoice)(body);
        if (path === "/Invoice/irn")
            return await (0, mygstcafe_client_1.getEInvoiceByIrn)(body.irn);
        if (path === "/cancel")
            return await (0, mygstcafe_client_1.cancelEInvoice)(body.Irn, Number(body.CnlRsn), body.CnlRem);
        if (path === "/einvewb/ewaybill")
            return await (0, mygstcafe_client_1.generateEwayBillByIrn)(body);
        if (path === "/ewayapi")
            return await (0, mygstcafe_client_1.cancelEwayBill)(body.ewbNo, Number(body.cancelRsnCode), body.cancelRmrk);
        throw new error_1.AppError(500, `Unsupported MyGSTCafe path: ${path}`);
    }
    catch (error) {
        if (error instanceof mygstcafe_client_1.MyGstCafeError) {
            const appError = new error_1.AppError(error.statusCode, error.message);
            appError.providerResponse = error.responseData;
            throw appError;
        }
        throw error;
    }
}
function providerData(result) {
    let data = result?.data ?? result?.Data ?? result?.response_data ?? result;
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        }
        catch {
            return result;
        }
    }
    return data;
}
function normalizedProviderResult(result) {
    const data = providerData(result);
    return {
        irn: data.Irn ?? data.irn, ackNo: data.AckNo ?? data.ackNo, ackDate: data.AckDt ?? data.ackDate,
        signedInvoice: text(data.SignedInvoice ?? data.signedInvoice), signedQrCode: data.SignedQrCode ?? data.signedQrCode,
        ewayBillNo: text(data.EwbNo ?? data.ewbNo ?? data.ewayBillNo),
        ewayBillDate: text(data.EwbDt ?? data.ewbDate ?? data.ewayBillDate),
        ewayBillValidTill: text(data.EwbValidTill ?? data.validUpto ?? data.ewayBillValidTill),
        providerStatus: text(data.Status ?? data.status ?? data.IrnStatus ?? data.irnStatus),
        cancelledAt: text(data.CancelDate ?? data.CnlDt ?? data.cancelledAt),
    };
}
async function getRecord(key) {
    const [rows] = await db_1.pool.query("SELECT * FROM retailx_einvoice_records WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ? LIMIT 1", [key.tablePrefix, key.invoiceNo, key.billPerforma]);
    return rows[0] ?? null;
}
function providerTimestamp(value) {
    if (!value)
        return null;
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value;
    const raw = text(value);
    const indianDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
    if (indianDate) {
        let hour = Number(indianDate[4] || 0);
        const meridiem = text(indianDate[7]).toUpperCase();
        if (meridiem === "PM" && hour < 12)
            hour += 12;
        if (meridiem === "AM" && hour === 12)
            hour = 0;
        const parsed = new Date(Number(indianDate[3]), Number(indianDate[2]) - 1, Number(indianDate[1]), hour, Number(indianDate[5] || 0), Number(indianDate[6] || 0));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function actionWindow(reference) {
    const created = providerTimestamp(reference);
    if (!created)
        return { allowed: false, deadline: null, remainingMs: 0 };
    const deadline = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const remainingMs = Math.max(0, deadline.getTime() - Date.now());
    return { allowed: remainingMs > 0, deadline: deadline.toISOString(), remainingMs };
}
function cancellationWindow(record) {
    if (!record)
        return {
            irn: { allowed: false, deadline: null, remainingMs: 0 },
            ewayBill: { allowed: false, deadline: null, remainingMs: 0 },
        };
    const irn = actionWindow(record.generated_at ?? record.ack_date ?? record.created_at);
    const ewayBill = actionWindow(record.eway_bill_generated_at ?? record.eway_bill_date);
    return {
        irn: {
            ...irn,
            allowed: Boolean(record.irn) && record.status === "GENERATED" && !record.cancelled_at && irn.allowed,
        },
        ewayBill: {
            ...ewayBill,
            allowed: Boolean(record.eway_bill_no) && !record.eway_bill_cancelled_at && ewayBill.allowed,
        },
    };
}
function publicRecord(record) {
    if (!record)
        return { status: "NOT_GENERATED" };
    return {
        id: record.id, invoiceNo: record.invoice_no, invoiceDate: record.invoice_date, status: record.status,
        sellerGstin: record.seller_gstin, buyerGstin: record.buyer_gstin, irn: record.irn,
        ackNo: record.ack_no, ackDate: record.ack_date, signedQrCode: record.signed_qr_code,
        ewayBillNo: record.eway_bill_no, ewayBillDate: record.eway_bill_date,
        ewayBillValidTill: record.eway_bill_valid_till, ewayBillCancelledAt: record.eway_bill_cancelled_at,
        errorCode: record.error_code,
        errorMessage: record.error_message, cancelledAt: record.cancelled_at, updatedAt: record.updated_at,
        createdAt: record.created_at, generatedAt: record.generated_at,
        ewayBillGeneratedAt: record.eway_bill_generated_at,
        cancellation: cancellationWindow(record),
        environment: env_1.env.einvoice.environment,
    };
}
const requestHash = (payload) => crypto_1.default.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
exports.requestHash = requestHash;
