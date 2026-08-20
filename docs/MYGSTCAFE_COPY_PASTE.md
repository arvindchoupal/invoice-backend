# MyGSTCafe e-invoice — copy/paste setup

Copy this file into another Node 18+ backend:

`src/services/mygstcafe.client.ts`

Add these environment variables to that backend. Copy the sandbox values from the supplied credentials workbook; never paste them into frontend code.

```env
EINVOICE_ENVIRONMENT=sandbox
EINVOICE_SANDBOX_BASE_URL=https://testapi.mygstcafe.com/eicore/v1.03
EINVOICE_PRODUCTION_BASE_URL=https://api.mygstcafe.com/eicore/v1.03
EINVOICE_GSTIN=
EINVOICE_USERNAME=
EINVOICE_PASSWORD=
EINVOICE_CUSTOMER_ID=
EINVOICE_API_ID=
EINVOICE_API_SECRET=
EINVOICE_SOURCE=API
```

Minimal Express usage:

```ts
import express from "express";
import {
  generateEInvoice,
  cancelEInvoice,
  generateEwayBillByIrn,
  cancelEwayBill,
  MyGstCafeError,
} from "./services/mygstcafe.client";

const app = express();
app.use(express.json());

app.post("/api/einvoice/generate", async (req, res) => {
  try {
    res.json(await generateEInvoice(req.body));
  } catch (error) {
    const e = error as MyGstCafeError;
    res.status(e.statusCode || 500).json({ message: e.message, provider: e.responseData });
  }
});

app.post("/api/einvoice/cancel", async (req, res) => {
  try {
    res.json(await cancelEInvoice(req.body.irn, req.body.reason, req.body.remarks));
  } catch (error) {
    const e = error as MyGstCafeError;
    res.status(e.statusCode || 500).json({ message: e.message, provider: e.responseData });
  }
});

app.post("/api/ewaybill/generate", async (req, res) => {
  try {
    res.json(await generateEwayBillByIrn(req.body));
  } catch (error) {
    const e = error as MyGstCafeError;
    res.status(e.statusCode || 500).json({ message: e.message, provider: e.responseData });
  }
});

app.post("/api/ewaybill/cancel", async (req, res) => {
  try {
    res.json(await cancelEwayBill(req.body.ewayBillNo, req.body.reason, req.body.remarks));
  } catch (error) {
    const e = error as MyGstCafeError;
    res.status(e.statusCode || 500).json({ message: e.message, provider: e.responseData });
  }
});
```
