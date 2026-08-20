"use strict";
// Copy this one file to another Node.js backend.
// Node 18+ is required because this uses the built-in fetch API.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyGstCafeError = void 0;
exports.myGstCafeCredentialsFromEnv = myGstCafeCredentialsFromEnv;
exports.generateEInvoice = generateEInvoice;
exports.getEInvoiceByIrn = getEInvoiceByIrn;
exports.cancelEInvoice = cancelEInvoice;
exports.generateEwayBillByIrn = generateEwayBillByIrn;
exports.cancelEwayBill = cancelEwayBill;
class MyGstCafeError extends Error {
    statusCode;
    responseData;
    constructor(message, statusCode = 422, responseData) {
        super(message);
        this.statusCode = statusCode;
        this.responseData = responseData;
    }
}
exports.MyGstCafeError = MyGstCafeError;
function myGstCafeCredentialsFromEnv() {
    const credentials = {
        gstin: process.env.EINVOICE_GSTIN ?? "",
        username: process.env.EINVOICE_USERNAME ?? "",
        password: process.env.EINVOICE_PASSWORD ?? "",
        customerId: process.env.EINVOICE_CUSTOMER_ID ?? "",
        apiId: process.env.EINVOICE_API_ID ?? "",
        apiSecret: process.env.EINVOICE_API_SECRET ?? "",
        source: process.env.EINVOICE_SOURCE ?? "API",
        customerName: 'speaktosatishmh',
        branch: 'Maharashtra',
        environment: process.env.EINVOICE_ENVIRONMENT === "production" ? "production" : "sandbox",
    };
    const missing = Object.entries(credentials)
        .filter(([key, value]) => ["gstin", "username", "password", "customerId", "apiId", "apiSecret"].includes(key) && !value)
        .map(([key]) => key);
    if (missing.length) {
        throw new MyGstCafeError(`Missing MyGSTCafe settings: ${missing.join(", ")}`, 503);
    }
    return credentials;
}
function baseUrl(credentials) {
    if (credentials.environment === "production") {
        return process.env.EINVOICE_PRODUCTION_BASE_URL ?? "https://api.mygstcafe.com/eicore/v1.03";
    }
    return process.env.EINVOICE_SANDBOX_BASE_URL ?? "https://testapi.mygstcafe.com/eicore/v1.03";
}
function headers(credentials) {
    return {
        "Content-Type": "application/json",
        GSTIN: credentials.gstin,
        Username: credentials.username,
        Password: credentials.password,
        CustomerId: credentials.customerId,
        APIId: credentials.apiId,
        APISecret: credentials.apiSecret,
        Source: credentials.source ?? "API",
        ...(credentials.customerName ? { CustomerName: credentials.customerName } : {}),
        ...(credentials.branch ? { Branch: credentials.branch } : {}),
    };
}
function providerMessage(data) {
    let nestedData = data?.data;
    if (typeof nestedData === "string") {
        try {
            nestedData = JSON.parse(nestedData);
        }
        catch {
            nestedData = undefined;
        }
    }
    const details = data?.Error ?? data?.ErrorDetails ?? data?.errorDetails ?? data?.errors ?? data?.error ??
        nestedData?.Error ?? nestedData?.ErrorDetails ?? nestedData?.errorDetails ?? nestedData?.errors ?? nestedData?.error;
    if (Array.isArray(details)) {
        return details
            .map((item) => String(item.ErrorMessage ?? item.message ?? item.ErrorCode ?? "").trim())
            .filter(Boolean)
            .join("; ");
    }
    if (details && typeof details === "object") {
        return String(details.ErrorMessage ?? details.message ?? details.ErrorCode ?? JSON.stringify(details));
    }
    return String(data?.message ?? data?.Message ?? nestedData?.message ?? nestedData?.Message ?? details ??
        "MyGSTCafe rejected the request.");
}
async function request(path, method, body, credentials = myGstCafeCredentialsFromEnv()) {
    console.log(`[E-INVOICE] ${method} ${baseUrl(credentials).replace(/\/$/, "")}${path}`);
    if (body)
        console.log("[E-INVOICE] Request payload", JSON.stringify(body, null, 2));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const response = await fetch(`${baseUrl(credentials).replace(/\/$/, "")}${path}`, {
            method,
            headers: headers(credentials),
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
        });
        const raw = await response.text();
        console.log(`[E-INVOICE] Provider HTTP ${response.status}`);
        console.log("[E-INVOICE] Provider response", raw);
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            throw new MyGstCafeError("MyGSTCafe returned an unreadable response.", 502);
        }
        if (!response.ok || String(data.status_cd ?? data.Status ?? "1") === "0" || data.error) {
            throw new MyGstCafeError(providerMessage(data), 422, data);
        }
        return data;
    }
    catch (error) {
        if (error.name === "AbortError") {
            throw new MyGstCafeError("MyGSTCafe request timed out.", 504);
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}
function generateEInvoice(invoiceJson, credentials) {
    return request("/Invoice", "POST", invoiceJson, credentials);
}
function getEInvoiceByIrn(irn, credentials) {
    return request(`/Invoice/irn/${encodeURIComponent(irn)}`, "GET", undefined, credentials);
}
function cancelEInvoice(irn, reason, remarks, credentials) {
    return request("/cancel", "POST", { Irn: irn, CnlRsn: String(reason), CnlRem: remarks }, credentials);
}
function generateEwayBillByIrn(details, credentials) {
    return request("/einvewb/ewaybill", "POST", details, credentials);
}
function cancelEwayBill(ewayBillNo, reason, remarks, credentials) {
    return request("/ewayapi", "POST", {
        ewbNo: Number(ewayBillNo),
        cancelRsnCode: reason,
        cancelRmrk: remarks,
    }, credentials);
}
