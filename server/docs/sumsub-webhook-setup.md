# Sumsub Webhook Configuration

## Webhook Endpoint Setup

### 1. Webhook URL
Configure the following webhook URL in your Sumsub Dashboard:

**Production:**
```
https://sklgmsapi.koltech.dev/api/sumsub/webhook
```

**Development:**
```
http://localhost:5001/api/sumsub/webhook
```

### 2. Webhook Events
Enable the following events in Sumsub Dashboard:

- `applicantReviewed` - When verification is completed
- `applicantPending` - When verification is in progress
- `applicantOnHold` - When verification is on hold
- `applicantActionPending` - When user action is required

### 3. Webhook Security
The webhook endpoint validates signatures using the `SUMSUB_WEBHOOK_SECRET` environment variable.

Make sure this matches the secret key configured in your Sumsub Dashboard.

### 4. Webhook Processing
The webhook handler:

1. **Verifies signature** using HMAC-SHA256
2. **Processes events** and updates user KYC status
3. **Sends notifications** to users about status changes
4. **Emits WebSocket events** for real-time updates

### 5. Event Processing Flow

```
Sumsub Event → Webhook → Signature Verification → User Update → Notification → WebSocket Emit
```

### 6. Supported Status Mapping

| Sumsub Status | Our Status | Description |
|---------------|------------|-------------|
| GREEN | APPROVED | Verification approved |
| RED | REJECTED | Verification rejected |
| YELLOW | PENDING | Additional review needed |
| (other) | PENDING | In progress |

### 7. Webhook Payload Example

```json
{
  "type": "applicantReviewed",
  "applicantId": "abc123",
  "externalUserId": "user_id_in_our_system",
  "reviewResult": {
    "reviewAnswer": "GREEN"
  },
  "reviewStatus": "completed"
}
```

### 8. Testing Webhook

To test the webhook locally, you can use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 5001

# Use the ngrok URL in Sumsub Dashboard
https://xxxxx.ngrok.io/api/sumsub/webhook
```

### 9. Monitoring

Check the server logs for webhook processing:

```bash
# Look for these log entries
- "Webhook received:"
- "Webhook processed successfully:"
- "Invalid webhook signature"
```

### 10. Troubleshooting

**Common Issues:**

1. **Invalid Signature Error**
   - Check that `SUMSUB_WEBHOOK_SECRET` matches Sumsub Dashboard
   - Verify the signature header name (`x-payload-digest`)

2. **User Not Found Error**
   - Ensure `externalUserId` in webhook matches user ID in database
   - Check that user exists before processing

3. **Webhook Not Received**
   - Verify webhook URL is accessible from internet
   - Check firewall settings
   - Verify SSL certificate for HTTPS endpoints

**Debug Steps:**

1. Enable detailed logging in webhook handler
2. Test webhook endpoint manually with curl
3. Check Sumsub Dashboard for webhook delivery status
4. Monitor server logs during test verifications