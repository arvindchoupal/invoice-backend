"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retailxEinvoiceRouter = void 0;
const { Router } = require("express");
const { pool } = require("../config/db");
const { AppError } = require("../middleware/error");
const { accountBuyerDetails, bearerToken, buildInvoicePayload, callProvider, cancellationWindow, getRecord, invoiceEligibility, loadRetailxBill, normalizedProviderResult, parseBillKey, publicRecord, requestHash, } = require("../services/retailx-einvoice.service");
exports.retailxEinvoiceRouter = Router();
const invoiceDateFromPayload = (payload) => {
    const value = String(payload?.DocDtls?.Dt ?? "").trim();
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
const storedPayload = (record) => {
    if (!record?.request_json)
        return {};
    if (typeof record.request_json === "object")
        return record.request_json;
    try {
        return JSON.parse(record.request_json);
    }
    catch {
        return {};
    }
};
const generatedData = (record) => ({
    irn: record?.irn,
    acknowledgementNumber: record?.ack_no,
    acknowledgementDate: record?.ack_date,
    signedInvoice: record?.signed_invoice,
    signedQrCode: record?.signed_qr_code,
    ewayBillNumber: record?.eway_bill_no,
    ewayBillDate: record?.eway_bill_date,
    ewayBillValidTill: record?.eway_bill_valid_till,
});
exports.retailxEinvoiceRouter.post("/payload/generate", async (req, res) => {
    // This endpoint owns its validation, success response and error response so
    // its complete HTTP flow can be understood without reading middleware.
    try {
        const authorization = bearerToken(req.header("authorization"));
        const envelope = req.body ?? {};
        let payload = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : envelope;
        const hasRetailxKey = Boolean(envelope.payload && envelope.tablePrefix && envelope.invoiceNo);
        const key = hasRetailxKey
            ? parseBillKey({
                tablePrefix: envelope.tablePrefix,
                invoiceNo: envelope.invoiceNo,
            })
            : null;
        if (key) {
            const rows = await loadRetailxBill(key, authorization);
            payload = { ...payload, BuyerDtls: accountBuyerDetails(rows) };
        }
        const missing = [];
        if (!payload.Version)
            missing.push("Version");
        if (!payload.DocDtls?.No)
            missing.push("DocDtls.No");
        if (!payload.SellerDtls?.Gstin)
            missing.push("SellerDtls.Gstin");
        if (!payload.BuyerDtls?.Gstin)
            missing.push("BuyerDtls.Gstin");
        if (!Array.isArray(payload.ItemList) || !payload.ItemList.length)
            missing.push("ItemList");
        if (!payload.ValDtls?.TotInvVal)
            missing.push("ValDtls.TotInvVal");
        if (missing.length)
            throw new AppError(422, `Missing e-invoice fields: ${missing.join(", ")}`);
        if (key) {
            const existing = await getRecord(key);
            if (existing?.status === "GENERATED" || existing?.status === "CANCELLED") {
                return res.json({
                    success: true,
                    message: "Existing e-invoice returned.",
                    data: generatedData(existing),
                    record: publicRecord(existing),
                    reused: true,
                });
            }
            await pool.query(`INSERT INTO retailx_einvoice_records
            (table_prefix, invoice_no, bill_performa, invoice_date, seller_gstin, buyer_gstin, status, request_hash, request_json, error_code, error_message)
           VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?, NULL, NULL)
           ON DUPLICATE KEY UPDATE invoice_date = VALUES(invoice_date), seller_gstin = VALUES(seller_gstin),
             buyer_gstin = VALUES(buyer_gstin), status = 'PROCESSING', request_hash = VALUES(request_hash),
             request_json = VALUES(request_json), error_code = NULL, error_message = NULL`, [
                key.tablePrefix,
                key.invoiceNo,
                key.billPerforma,
                invoiceDateFromPayload(payload),
                String(payload.SellerDtls.Gstin),
                String(payload.BuyerDtls.Gstin),
                requestHash(payload),
                JSON.stringify(payload),
            ]);
        }
        console.log(`[E-INVOICE] Frontend payload for invoice ${payload.DocDtls.No}`);
        console.log(JSON.stringify(payload, null, 2));
        try {
            const providerResponse = await callProvider("/Invoice", payload);
            const result = normalizedProviderResult(providerResponse);
            if (!result.irn)
                throw new AppError(502, "Provider accepted the request but did not return an IRN.");
            let record = null;
            if (key) {
                await pool.query(`UPDATE retailx_einvoice_records SET status = 'GENERATED', response_json = ?, irn = ?, ack_no = ?, ack_date = ?,
              signed_invoice = ?, signed_qr_code = ?, eway_bill_no = ?, eway_bill_date = ?, eway_bill_valid_till = ?,
              generated_at = NOW(), eway_bill_generated_at = CASE WHEN ? IS NULL OR ? = '' THEN NULL ELSE NOW() END,
              error_code = NULL, error_message = NULL
             WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [
                    JSON.stringify(providerResponse),
                    result.irn,
                    result.ackNo || null,
                    result.ackDate || null,
                    result.signedInvoice || null,
                    result.signedQrCode || null,
                    result.ewayBillNo || null,
                    result.ewayBillDate || null,
                    result.ewayBillValidTill || null,
                    result.ewayBillNo || null,
                    result.ewayBillNo || null,
                    key.tablePrefix,
                    key.invoiceNo,
                    key.billPerforma,
                ]);
                record = await getRecord(key);
            }
            res.status(201).json({
                success: true,
                message: "E-invoice generated successfully.",
                data: {
                    irn: result.irn,
                    acknowledgementNumber: result.ackNo,
                    acknowledgementDate: result.ackDate,
                    signedInvoice: result.signedInvoice,
                    signedQrCode: result.signedQrCode,
                    ewayBillNumber: result.ewayBillNo,
                    ewayBillDate: result.ewayBillDate,
                    ewayBillValidTill: result.ewayBillValidTill,
                },
                ...(record ? { record: publicRecord(record) } : {}),
                reused: false,
            });
        }
        catch (error) {
            if (key) {
                await pool.query(`UPDATE retailx_einvoice_records SET status = 'FAILED', response_json = ?, error_message = ?
             WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [
                    error.providerResponse ? JSON.stringify(error.providerResponse) : null,
                    error.message,
                    key.tablePrefix,
                    key.invoiceNo,
                    key.billPerforma,
                ]);
            }
            throw error;
        }
    }
    catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        if (statusCode === 500)
            console.error("[E-INVOICE] /payload/generate failed", error);
        return res.status(statusCode).json({
            message: statusCode === 500 ? "Something went wrong" : error.message,
            ...(error.providerResponse ? { provider: error.providerResponse } : {}),
        });
    }
});
exports.retailxEinvoiceRouter.post("/hub/list", async (req, res) => {
    // Keep request validation, data loading and both response paths together.
    try {
        bearerToken(req.header("authorization"));
        const tablePrefix = String(req.body?.tablePrefix ?? "").trim();
        if (!tablePrefix || tablePrefix.length > 100)
            throw new AppError(422, "Company is required.");
        const search = String(req.body?.search ?? "").trim().slice(0, 80);
        const requestedStatus = String(req.body?.status ?? "ALL").toUpperCase();
        const allowedStatuses = ["ALL", "PROCESSING", "GENERATED", "FAILED", "CANCELLED"];
        if (!allowedStatuses.includes(requestedStatus))
            throw new AppError(422, "Select a valid e-invoice status.");
        const page = Math.max(1, Number.parseInt(req.body?.page, 10) || 1);
        const limit = Math.min(100, Math.max(10, Number.parseInt(req.body?.limit, 10) || 25));
        const offset = (page - 1) * limit;
        const where = ["table_prefix = ?"];
        const params = [tablePrefix];
        if (requestedStatus !== "ALL") {
            where.push("status = ?");
            params.push(requestedStatus);
        }
        if (search) {
            const term = `%${search}%`;
            where.push(`(invoice_no LIKE ? OR buyer_gstin LIKE ? OR irn LIKE ? OR eway_bill_no LIKE ?
              OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(request_json, '$.BuyerDtls.LglNm')), '') LIKE ?)`);
            params.push(term, term, term, term, term);
        }
        const whereSql = where.join(" AND ");
        const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM retailx_einvoice_records WHERE ${whereSql}`, params);
        const [rows] = await pool.query(`SELECT * FROM retailx_einvoice_records
          WHERE ${whereSql} ORDER BY COALESCE(generated_at, created_at) DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const [summaryRows] = await pool.query(`SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'GENERATED' THEN 1 ELSE 0 END) AS generated_count,
          SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
          SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) AS processing_count,
          SUM(CASE WHEN status = 'GENERATED' AND eway_bill_no IS NOT NULL THEN 1 ELSE 0 END) AS active_eway_bills
          FROM retailx_einvoice_records WHERE table_prefix = ?`, [tablePrefix]);
        const summaryRow = summaryRows[0] ?? {};
        const records = rows.map((row) => {
            const payload = storedPayload(row);
            return {
                ...publicRecord(row),
                buyerName: payload?.BuyerDtls?.LglNm ?? "",
                invoiceTotal: Number(payload?.ValDtls?.TotInvVal ?? 0),
                documentDate: payload?.DocDtls?.Dt ?? "",
            };
        });
        return res.json({
            records,
            summary: {
                total: Number(summaryRow.total ?? 0),
                generated: Number(summaryRow.generated_count ?? 0),
                cancelled: Number(summaryRow.cancelled_count ?? 0),
                failed: Number(summaryRow.failed_count ?? 0),
                processing: Number(summaryRow.processing_count ?? 0),
                activeEwayBills: Number(summaryRow.active_eway_bills ?? 0),
            },
            pagination: {
                page,
                limit,
                total: Number(countRows[0]?.total ?? 0),
                totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total ?? 0) / limit)),
            },
        });
    }
    catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        if (statusCode === 500)
            console.error("[E-INVOICE] /hub/list failed", error);
        return res.status(statusCode).json({
            message: statusCode === 500 ? "Something went wrong" : error.message,
        });
    }
});
exports.retailxEinvoiceRouter.post("/status", async (req, res) => {
    // Status is intentionally self-contained: input -> work -> success/error.
    try {
        const key = parseBillKey(req.body);
        const authorization = bearerToken(req.header("authorization"));
        const rows = await loadRetailxBill(key, authorization);
        let record = await getRecord(key);
        if (record?.irn) {
            const providerResponse = await callProvider("/Invoice/irn", { irn: record.irn });
            const live = normalizedProviderResult(providerResponse);
            const providerStatus = String(live.providerStatus || "").toUpperCase();
            const isCancelled = record.status === "CANCELLED" || Boolean(live.cancelledAt) || providerStatus.includes("CANCEL") || providerStatus === "CNL";
            await pool.query(`UPDATE retailx_einvoice_records SET
              status = ?, response_json = ?, ack_no = COALESCE(?, ack_no), ack_date = COALESCE(?, ack_date),
              signed_invoice = COALESCE(?, signed_invoice), signed_qr_code = COALESCE(?, signed_qr_code),
              eway_bill_no = CASE WHEN eway_bill_cancelled_at IS NULL THEN COALESCE(?, eway_bill_no) ELSE eway_bill_no END,
              eway_bill_date = CASE WHEN eway_bill_cancelled_at IS NULL THEN COALESCE(?, eway_bill_date) ELSE eway_bill_date END,
              eway_bill_valid_till = CASE WHEN eway_bill_cancelled_at IS NULL THEN COALESCE(?, eway_bill_valid_till) ELSE eway_bill_valid_till END,
              cancelled_at = CASE WHEN ? THEN COALESCE(?, cancelled_at, NOW()) ELSE cancelled_at END,
              error_code = NULL, error_message = NULL
             WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [
                isCancelled ? "CANCELLED" : "GENERATED",
                JSON.stringify(providerResponse),
                live.ackNo || null,
                live.ackDate || null,
                live.signedInvoice || null,
                live.signedQrCode || null,
                live.ewayBillNo || null,
                live.ewayBillDate || null,
                live.ewayBillValidTill || null,
                isCancelled ? 1 : 0,
                live.cancelledAt || null,
                key.tablePrefix,
                key.invoiceNo,
                key.billPerforma,
            ]);
            record = await getRecord(key);
        }
        const eligibility = invoiceEligibility(rows);
        return res.json({
            record: publicRecord(record),
            eligibility,
        });
    }
    catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        if (statusCode === 500)
            console.error("[E-INVOICE] /status failed", error);
        return res.status(statusCode).json({
            message: statusCode === 500 ? "Something went wrong" : error.message,
            ...(error.providerResponse ? { provider: error.providerResponse } : {}),
        });
    }
});
exports.retailxEinvoiceRouter.post("/generate", async (req, res) => {
    // This endpoint keeps the full generation flow and final HTTP responses in
    // one place. Service functions only perform focused business operations.
    try {
        const key = parseBillKey(req.body);
        const authorization = bearerToken(req.header("authorization"));
        const rows = await loadRetailxBill(key, authorization);
        const built = buildInvoicePayload(rows, req.body.seller ?? {});
        const existing = await getRecord(key);
        if (existing?.status === "GENERATED" || existing?.status === "CANCELLED") {
            return res.json({ record: publicRecord(existing), reused: true });
        }
        if (existing?.status === "PROCESSING" && Date.now() - new Date(existing.updated_at).getTime() < 60_000) {
            throw new AppError(409, "This invoice is already being submitted. Refresh its status shortly.");
        }
        await pool.query(`INSERT INTO retailx_einvoice_records
          (table_prefix, invoice_no, bill_performa, invoice_date, seller_gstin, buyer_gstin, status, request_hash, request_json, error_code, error_message)
         VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?, NULL, NULL)
         ON DUPLICATE KEY UPDATE invoice_date = VALUES(invoice_date), seller_gstin = VALUES(seller_gstin),
           buyer_gstin = VALUES(buyer_gstin), status = 'PROCESSING', request_hash = VALUES(request_hash),
           request_json = VALUES(request_json), error_code = NULL, error_message = NULL`, [key.tablePrefix, key.invoiceNo, key.billPerforma, built.invoiceDate, built.seller.gstin,
            built.buyerGstin, requestHash(built.payload), JSON.stringify(built.payload)]);
        try {
            const response = await callProvider("/Invoice", built.payload);
            const result = normalizedProviderResult(response);
            if (!result.irn)
                throw new AppError(502, "Provider accepted the request but did not return an IRN.");
            await pool.query(`UPDATE retailx_einvoice_records SET status = 'GENERATED', response_json = ?, irn = ?, ack_no = ?, ack_date = ?,
           signed_invoice = ?, signed_qr_code = ?, eway_bill_no = ?, eway_bill_date = ?, eway_bill_valid_till = ?,
           generated_at = NOW(), eway_bill_generated_at = CASE WHEN ? IS NULL OR ? = '' THEN NULL ELSE NOW() END,
           error_code = NULL, error_message = NULL WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [JSON.stringify(response), result.irn, result.ackNo || null, result.ackDate || null,
                result.signedInvoice || null, result.signedQrCode || null, result.ewayBillNo || null,
                result.ewayBillDate || null, result.ewayBillValidTill || null, result.ewayBillNo || null, result.ewayBillNo || null,
                key.tablePrefix, key.invoiceNo, key.billPerforma]);
            return res.status(201).json({ record: publicRecord(await getRecord(key)), reused: false });
        }
        catch (error) {
            const providerResponse = error.providerResponse;
            await pool.query(`UPDATE retailx_einvoice_records SET status = 'FAILED', response_json = ?, error_message = ?
           WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [providerResponse ? JSON.stringify(providerResponse) : null, error.message,
                key.tablePrefix, key.invoiceNo, key.billPerforma]);
            throw error;
        }
    }
    catch (error) {
        const statusCode = error instanceof AppError ? error.statusCode : 500;
        if (statusCode === 500)
            console.error("[E-INVOICE] /generate failed", error);
        return res.status(statusCode).json({
            message: statusCode === 500 ? "Something went wrong" : error.message,
            ...(error.providerResponse ? { provider: error.providerResponse } : {}),
        });
    }
});
exports.retailxEinvoiceRouter.post("/ewaybill", async (req, res) => {
    const key = parseBillKey(req.body);
    await loadRetailxBill(key, bearerToken(req.header("authorization")), { enrichParty: false });
    const record = await getRecord(key);
    if (!record?.irn || record.status !== "GENERATED")
        throw new AppError(422, "Generate the IRN before creating an e-way bill.");
    if (record.eway_bill_no)
        return res.json({ record: publicRecord(record), reused: true });
    const transport = req.body.transport ?? {};
    const distance = Number(transport.distance);
    if (!Number.isInteger(distance) || distance < 0 || distance > 4000)
        throw new AppError(422, "Distance must be between 0 and 4000 km.");
    const body = { Irn: record.irn, Distance: distance };
    const optional = {
        TransId: String(transport.transporterGstin ?? "").trim(), TransName: String(transport.transporterName ?? "").trim(),
        TransMode: String(transport.mode ?? "").trim(), TransDocNo: String(transport.documentNo ?? "").trim(),
        TransDocDt: String(transport.documentDate ?? "").trim(), VehNo: String(transport.vehicleNo ?? "").trim().toUpperCase(),
        VehType: String(transport.vehicleType ?? "").trim(),
    };
    Object.entries(optional).forEach(([name, value]) => {
        if (value)
            body[name] = value;
    });
    if (optional.TransMode === "1" && (!optional.VehNo || !optional.VehType)) {
        throw new AppError(422, "Vehicle number and vehicle type are required for road transport.");
    }
    if (["2", "3", "4"].includes(optional.TransMode) && (!optional.TransDocNo || !optional.TransDocDt)) {
        throw new AppError(422, "Transport document number and date are required for rail, air or ship.");
    }
    const response = await callProvider("/einvewb/ewaybill", body);
    const result = normalizedProviderResult(response);
    if (!result.ewayBillNo)
        throw new AppError(502, "Provider did not return an e-way bill number.");
    await pool.query(`UPDATE retailx_einvoice_records SET response_json = ?, eway_bill_no = ?, eway_bill_date = ?, eway_bill_valid_till = ?,
     eway_bill_generated_at = NOW(),
     error_code = NULL, error_message = NULL WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [JSON.stringify(response), result.ewayBillNo, result.ewayBillDate || null, result.ewayBillValidTill || null,
        key.tablePrefix, key.invoiceNo, key.billPerforma]);
    res.status(201).json({ record: publicRecord(await getRecord(key)), reused: false });
});
exports.retailxEinvoiceRouter.post("/cancel", async (req, res) => {
    const key = parseBillKey(req.body);
    await loadRetailxBill(key, bearerToken(req.header("authorization")), { enrichParty: false });
    const record = await getRecord(key);
    if (!record?.irn)
        throw new AppError(422, "This bill has no generated IRN.");
    if (record.status === "CANCELLED")
        return res.json({ record: publicRecord(record), reused: true });
    if (record.eway_bill_no)
        throw new AppError(422, "Cancel the e-way bill before cancelling its IRN.");
    const cancellation = cancellationWindow(record);
    if (!cancellation.irn.allowed)
        throw new AppError(422, "The 24-hour IRN cancellation period has expired.");
    const reason = Number(req.body.reason);
    const remarks = String(req.body.remarks ?? "").trim();
    if (![1, 2, 3, 4].includes(reason))
        throw new AppError(422, "Select a valid cancellation reason.");
    if (remarks.length < 5 || remarks.length > 100)
        throw new AppError(422, "Cancellation remarks must be 5–100 characters.");
    const response = await callProvider("/cancel", { Irn: record.irn, CnlRsn: String(reason), CnlRem: remarks });
    await pool.query(`UPDATE retailx_einvoice_records SET status = 'CANCELLED', response_json = ?, cancelled_at = NOW(),
     error_code = NULL, error_message = NULL WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [JSON.stringify(response), key.tablePrefix, key.invoiceNo, key.billPerforma]);
    res.json({ record: publicRecord(await getRecord(key)), reused: false });
});
exports.retailxEinvoiceRouter.post("/ewaybill/cancel", async (req, res) => {
    const key = parseBillKey(req.body);
    await loadRetailxBill(key, bearerToken(req.header("authorization")), { enrichParty: false });
    const record = await getRecord(key);
    if (!record?.eway_bill_no)
        throw new AppError(422, "This invoice has no active e-way bill.");
    const cancellation = cancellationWindow(record);
    if (!cancellation.ewayBill.allowed)
        throw new AppError(422, "The 24-hour e-way bill cancellation period has expired.");
    const reason = Number(req.body.reason);
    const remarks = String(req.body.remarks ?? "").trim();
    if (![1, 2, 3, 4].includes(reason))
        throw new AppError(422, "Select a valid cancellation reason.");
    if (remarks.length > 100)
        throw new AppError(422, "Cancellation remarks cannot exceed 100 characters.");
    const response = await callProvider("/ewayapi", {
        ewbNo: Number(record.eway_bill_no), cancelRsnCode: reason, cancelRmrk: remarks,
    });
    await pool.query(`UPDATE retailx_einvoice_records SET response_json = ?, eway_bill_cancelled_at = NOW(),
     eway_bill_no = NULL, eway_bill_date = NULL, eway_bill_valid_till = NULL,
     error_code = NULL, error_message = NULL WHERE table_prefix = ? AND invoice_no = ? AND bill_performa = ?`, [JSON.stringify(response), key.tablePrefix, key.invoiceNo, key.billPerforma]);
    res.json({ record: publicRecord(await getRecord(key)), reused: false });
});
