Perfect—let’s wire the whole sandbox stack end-to-end with **API Gateway → Lambda → MX Merchant (Invoice w/ line items) → Twilio SMS → SES Email → DynamoDB**, then you can flip the base URL to go live.

Below is a **complete, working blueprint** (Node.js Lambdas, DynamoDB schema, API routes, IAM, env, and sequence). I’ve kept the code production-lean (idempotent keys, retries, safe timeouts) but readable.

---

# 0) What you need from MX Merchant (Sandbox)

* **Base URL (sandbox):** `https://sandbox.api.mxmerchant.com/checkout/v3/...` (switch to `https://api.mxmerchant.com/...` for prod). ([developer.mxmerchant.com][1])
* **Auth:** Checkout API credentials (Basic or OAuth 1.0a). For speed, use **Basic** in sandbox. ([developer.mxmerchant.com][2])
* **Your merchantId** (visible in responses like `GET /merchant/{id}` and in the portal). ([developer.mxmerchant.com][3])
* **Notification (webhook) subscription** of type **Payment** → point to your API Gateway webhook URL. (In docs this is “Create Notification”; for Link2Pay there’s a naming note; for invoices you’ll watch **Payment** events.) ([developer.mxmerchant.com][4])
* (Optional) **Send Invoice / Payment Receipts** endpoints if you want MX to email/SMS receipts directly. ([developer.mxmerchant.com][5])

**Note:** You’re choosing **B) Per-client invoice with line items** → you will call **Create Invoice**; MX hosts the invoice payment page; your webhook receives **Payment** events. ([developer.mxmerchant.com][2])

---

# 1) High-level flow (Sandbox)

1. **POST `/invoices/create`** (Admin or your app)
   → Lambda creates **Customer (if missing)** and **Invoice (with items)** via MX → stores record in **DynamoDB** with `status="pending"` → sends **Twilio SMS** (and/or **SES email**) with the invoice pay link.

2. **Customer pays** on MX hosted invoice page.

3. **MX → Webhook** (Payment event) calls **POST `/mx/webhook`**
   → Lambda verifies payload → updates DynamoDB (`status="paid"` / `failed"`, `transactionId`, `paidAt`) → triggers SES/Twilio receipts/alerts.

---

# 2) API surface (API Gateway)

* `POST /invoices/create` → **createInvoiceHandler**
* `POST /mx/webhook` → **mxWebhookHandler** (MX Payment notifications)

---

# 3) Environment & secrets (suggested)

**AWS Secrets Manager** (recommended)

* `MX_BASIC_AUTH` → base64 of `username:password` for Checkout API (or store separately as `MX_USER`, `MX_PASS`)
* `TWILIO_AUTH_TOKEN`
* `SES_FROM_EMAIL`

**Lambda environment variables**

```
MX_BASE_URL=https://sandbox.api.mxmerchant.com/checkout/v3
MX_MERCHANT_ID=xxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+1xxxxxxxxxx           # your Twilio number
SES_REGION=us-east-1
DDB_TABLE=Invoices
PUBLIC_SUCCESS_URL=https://yourapp.example/success
PUBLIC_FAILURE_URL=https://yourapp.example/failure
```

> When going live: only flip `MX_BASE_URL` to `https://api.mxmerchant.com/checkout/v3` and use prod creds. ([developer.mxmerchant.com][1])

---

# 4) DynamoDB table (one table, simple PK/SK)

```json
{
  "Resources": {
    "InvoicesTable": {
      "Type": "AWS::DynamoDB::Table",
      "Properties": {
        "TableName": "Invoices",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
          { "AttributeName": "pk", "AttributeType": "S" },
          { "AttributeName": "sk", "AttributeType": "S" }
        ],
        "KeySchema": [
          { "AttributeName": "pk", "KeyType": "HASH" },
          { "AttributeName": "sk", "KeyType": "RANGE" }
        ],
        "TimeToLiveSpecification": { "AttributeName": "ttl", "Enabled": false }
      }
    }
  }
}
```

* `pk = INVOICE#<invoiceId>`
* `sk = META#<invoiceId>`
* Store: customer snapshot, items snapshot, `status` (`pending|paid|failed|void`), `amount`, `currency`, `mxPaymentId?`, timestamps.

---

# 5) IAM (minimal policies)

* **DynamoDB**: `GetItem/PutItem/UpdateItem` on `Invoices`
* **SES**: `ses:SendEmail` (or `SendTemplatedEmail`) in your region
* **Secrets Manager**: `GetSecretValue` for your secret ARNs
* **CloudWatch Logs**: standard logging
* (Webhook handler has the same plus DDB Update)

---

# 6) Lambda: create invoice + notify (Node.js 18+)

```js
// file: createInvoiceHandler.js
import https from 'node:https';
import crypto from 'node:crypto';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'; // optional if using SSM
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import fetch from 'node-fetch';

const ddb = new DynamoDBClient({});
const ses = new SESClient({ region: process.env.SES_REGION });
const secrets = new SecretsManagerClient({});

const {
  MX_BASE_URL,
  MX_MERCHANT_ID,
  DDB_TABLE,
  PUBLIC_SUCCESS_URL,
  PUBLIC_FAILURE_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_FROM
} = process.env;

// Helper: get secret and return plain value
async function getSecret(name) {
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: name }));
  return res.SecretString || Buffer.from(res.SecretBinary).toString('utf8');
}

// Helper: POST to MX
async function mxPost(path, body, basicAuth) {
  const res = await fetch(`${MX_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body),
    // tighter timeouts via agent if needed:
    agent: new https.Agent({ keepAlive: true, timeout: 10000 })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MX POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Helper: send Twilio SMS
async function sendSms(to, message, twilioAuthToken) {
  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', TWILIO_FROM);
  params.append('Body', message);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${twilioAuthToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Twilio SMS failed: ${res.status} ${errTxt}`);
  }
  return res.json();
}

// Helper: send SES (simple)
async function sendEmail(to, subject, html) {
  return ses.send(new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } }
    },
    Source: process.env.SES_FROM_EMAIL
  }));
}

export const handler = async (event) => {
  // Expect JSON body with:
  // { customer: { name, email, phone }, currency, items: [{name, quantity, unitPrice, taxRate? , discount?}], memo?, poNumber?, dueDate? }
  // For sandbox simplicity: currency assumed "USD".
  const body = JSON.parse(event.body || '{}');

  // Basic validation
  if (!body?.customer?.email || !Array.isArray(body.items) || body.items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payload' }) };
  }

  const basicAuth = await getSecret('MX_BASIC_AUTH');      // store base64(username:password)
  const twilioAuthToken = await getSecret('TWILIO_AUTH_TOKEN');

  // 1) Ensure MX customer exists (create-or-use pattern)
  // Minimal payload; you can enrich with address, etc.
  const customerReq = {
    merchantId: MX_MERCHANT_ID,
    firstName: body.customer.firstName || body.customer.name || 'Customer',
    lastName: body.customer.lastName || 'Unknown',
    email: body.customer.email,
    phone: body.customer.phone
  };
  // In sandbox, simply POST; in prod you might search first to dedupe.
  const customer = await mxPost('/customer', customerReq, basicAuth); // :contentReference[oaicite:7]{index=7}

  // 2) Build invoice line items
  // MX expects amounts as decimals; if they accept integer cents, adjust accordingly.
  const items = body.items.map((it) => ({
    name: it.name,
    quantity: it.quantity || 1,
    unitPrice: it.unitPrice, // decimal
    // Optional: tax/discount fields vary by account config; keep basic for sandbox.
    // taxAmount, discountAmount could be computed and passed on totals section as well.
  }));

  // Compute totals (simple)
  const subtotal = items.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity || 1), 0);
  const tax = body.taxAmount ? Number(body.taxAmount) : 0;
  const discount = body.discountAmount ? Number(body.discountAmount) : 0;
  const total = Math.max(0, subtotal + tax - discount);

  // 3) Create the invoice (MX Invoice with items)
  const invoiceReq = {
    merchantId: MX_MERCHANT_ID,
    customerId: customer.id,
    memo: body.memo,
    poNumber: body.poNumber,
    dueDate: body.dueDate, // e.g., "2025-10-15"
    currency: body.currency || 'USD',
    items,
    subtotal,
    taxAmount: tax,
    discountAmount: discount,
    total,
    // Some MX accounts allow specifying return URLs or you can rely on hosted defaults
    successUrl: PUBLIC_SUCCESS_URL,
    failureUrl: PUBLIC_FAILURE_URL
  };

  const invoice = await mxPost('/invoice', invoiceReq, basicAuth); // Create Invoice; hosted payment UI from MX. :contentReference[oaicite:8]{index=8}

  // 4) Persist to DynamoDB (status=pending)
  const now = new Date().toISOString();
  const pk = `INVOICE#${invoice.id}`;
  const putCmd = new PutItemCommand({
    TableName: DDB_TABLE,
    Item: {
      pk: { S: pk },
      sk: { S: `META#${invoice.id}` },
      status: { S: 'pending' },
      amount: { N: total.toFixed(2) },
      currency: { S: invoiceReq.currency },
      customerEmail: { S: body.customer.email },
      customerPhone: { S: body.customer.phone || '' },
      memo: { S: body.memo || '' },
      createdAt: { S: now },
      raw: { S: JSON.stringify({ customer, invoice, items }) }
    }
  });
  await ddb.send(putCmd);

  // 5) Build a link for the payer
  // Many MX accounts can "Send Invoice" or "Send Invoice Receipt" via API (email/SMS), or you keep your own link.
  // We'll send our own SMS with a link to MX’s hosted invoice page if available,
  // otherwise send a link to your app that deep-links to MX. (Docs show send endpoints.) :contentReference[oaicite:9]{index=9}
  const payUrl = invoice.payLink || invoice.url || `${PUBLIC_SUCCESS_URL}?invoiceId=${invoice.id}`;

  // 6) Notify the payer (SMS first; then optional email)
  if (body.customer.phone) {
    await sendSms(body.customer.phone, `Invoice #${invoice.invoiceNumber || invoice.id} for $${total.toFixed(2)}. Pay: ${payUrl}\nReply STOP to opt out.`, twilioAuthToken);
    // A2P 10DLC registration is required for US long code messaging; ensure brand/campaign compliance. :contentReference[oaicite:10]{index=10}
  }
  if (body.customer.email) {
    await sendEmail(body.customer.email,
      `Invoice #${invoice.invoiceNumber || invoice.id} from Your Company`,
      `<p>Hello ${body.customer.firstName || ''},</p>
       <p>Please review and pay your invoice totaling <strong>$${total.toFixed(2)}</strong>.</p>
       <p><a href="${payUrl}">Pay Now</a></p>
       <p>Memo: ${invoiceReq.memo || '-'}</p>`
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      invoiceId: invoice.id,
      total,
      status: 'pending',
      payUrl
    })
  };
};
```

> **Why SMS copy mentions “STOP”:** US carriers require opt-out language under **A2P 10DLC** policies. Register your brand/campaign before production SMS to US numbers. ([Twilio][6])

---

# 7) Lambda: webhook → update status

```js
// file: mxWebhookHandler.js
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const { DDB_TABLE } = process.env;

export const handler = async (event) => {
  // MX posts Payment notifications to this endpoint.
  // You should also verify source (e.g., via allowlist/signature if provided).
  // Example notification doc refs: "Notifications" + examples. :contentReference[oaicite:12]{index=12}

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  // Example shape to adapt:
  // {
  //   "eventType": "Payment",
  //   "status": "Success" | "Decline" | "Refund",
  //   "payment": { "id": "...", "amount": 123.45, "invoiceId": "...", "dateTime": "..." }
  //   ...
  // }

  const type = payload.eventType;
  if (type !== 'Payment') {
    // Ignore other types or handle separately (Deposit, Refund, etc.). :contentReference[oaicite:13]{index=13}
    return { statusCode: 200, body: 'Ignored' };
  }

  const p = payload.payment || {};
  const invoiceId = p.invoiceId;
  if (!invoiceId) {
    return { statusCode: 400, body: 'Missing invoiceId' };
  }

  const status = payload.status?.toLowerCase() === 'success' ? 'paid'
               : payload.status?.toLowerCase() === 'decline' ? 'failed'
               : payload.status?.toLowerCase() === 'refund' ? 'refunded'
               : 'unknown';

  const update = new UpdateItemCommand({
    TableName: DDB_TABLE,
    Key: { pk: { S: `INVOICE#${invoiceId}` }, sk: { S: `META#${invoiceId}` } },
    UpdateExpression:
      'SET #st = :st, mxPaymentId = :pid, paidAt = if_not_exists(paidAt, :ts), lastEvent = :evt',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: {
      ':st': { S: status },
      ':pid': { S: p.id || '' },
      ':ts': { S: new Date().toISOString() },
      ':evt': { S: JSON.stringify(payload) }
    }
  });

  await ddb.send(update);

  // Optionally: trigger SES/Twilio confirmations here (decouple via SNS/SQS if high volume).

  return { statusCode: 200, body: 'OK' };
};
```

**Webhook subscription:** In MX, create a **Payment** notification pointing to your `POST /mx/webhook` URL so you get paid/declined/refund updates. ([developer.mxmerchant.com][4])

---

# 8) Example request to create invoice (via API Gateway)

```http
POST /invoices/create
Content-Type: application/json

{
  "customer": { "name": "Acme Co", "email": "billing@acme.com", "phone": "+15551234567" },
  "currency": "USD",
  "items": [
    { "name": "Design Package", "quantity": 1, "unitPrice": 500.00 },
    { "name": "Maintenance (Monthly)", "quantity": 1, "unitPrice": 99.00 }
  ],
  "taxAmount": 0,
  "discountAmount": 0,
  "memo": "Project Phoenix - Phase 1",
  "poNumber": "INV-2025-1007",
  "dueDate": "2025-10-20"
}
```

**Response** (from Lambda):

```json
{
  "invoiceId": "abc123",
  "total": 599,
  "status": "pending",
  "payUrl": "https://.../hosted/invoice/abc123"
}
```

---

# 9) API Gateway notes

* Use **Lambda proxy integration** for both routes.
* Enable **access logs** + **WAF** (recommended).
* Set a **400/500** gateway mapping to pass through JSON errors.
* For **webhook**, do not require auth (restrict by IP or secret header if MX supports; otherwise WAF CIDR allowlist).

---

# 10) Twilio & SES production readiness

* **Twilio A2P 10DLC (US)**: Register brand & campaign before sending production SMS to US long codes; include opt-out (“STOP”). ([Twilio][6])
* **SES**: verify domain or sender & move out of sandbox to email arbitrary recipients. ([developer.mxmerchant.com][5])

---

# 11) Going live

* Flip `MX_BASE_URL` to `https://api.mxmerchant.com/checkout/v3` and use production credentials. ([developer.mxmerchant.com][1])
* Update MX **Payment** notification to point to your **prod** webhook URL. ([support.mxmerchant.com][7])

---

## Why this matches MX’s model

* **Create Invoice** via Checkout API (line items, taxes, discounts, memo, PO). Hosted payment experience is provided; you may also use MX endpoints to **send invoice/receipt**. ([developer.mxmerchant.com][2])
* **Notifications / Webhooks** deliver **Payment** events (success/decline/refund) that you consume to update your ledger. ([developer.mxmerchant.com][8])

If you want, I can also drop a **SAM template** that wires the table, two Lambdas, and API routes so you can `sam deploy` this sandbox in one go.

[1]: https://developer.mxmerchant.com/docs/transitioning-to-production?utm_source=chatgpt.com "Transitioning to Production"
[2]: https://developer.mxmerchant.com/docs/welcome?utm_source=chatgpt.com "Welcome to the Checkout API"
[3]: https://developer.mxmerchant.com/docs/mx-retail-1?utm_source=chatgpt.com "MX Retail"
[4]: https://developer.mxmerchant.com/reference/create-notification?utm_source=chatgpt.com "Create Notification"
[5]: https://developer.mxmerchant.com/docs/sending-receipts?utm_source=chatgpt.com "Sending Receipts"
[6]: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc?utm_source=chatgpt.com "Programmable Messaging and A2P 10DLC"
[7]: https://support.mxmerchant.com/docs/notifications?utm_source=chatgpt.com "Notifications"
[8]: https://developer.mxmerchant.com/docs/notifications-1?utm_source=chatgpt.com "Notifications"
