#!/bin/bash

# Test script for deployed MX Lambda API
BASE_URL="https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev"

echo "🚀 Testing MX Lambda API deployed on AWS"
echo "=========================================="
echo ""

# Test 1: Create Payment Link
echo "📝 Test 1: Creating Payment Link..."
echo ""

RESPONSE=$(curl -s -X POST ${BASE_URL}/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 487.50,
    "currency": "USD",
    "invoice": {
      "number": "RO-TEST-001",
      "description": "Test Brake Service - 2019 Silverado 1500"
    },
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+15551234567"
    },
    "lineItems": [
      {
        "description": "Brake Pad Replacement",
        "quantity": 1,
        "unitPrice": 150.00,
        "totalPrice": 150.00
      },
      {
        "description": "Labor",
        "quantity": 2,
        "unitPrice": 168.75,
        "totalPrice": 337.50
      }
    ],
    "sendSMS": false
  }')

echo "$RESPONSE" | jq .
echo ""

# Extract payment link ID for next test
PAYMENT_LINK_ID=$(echo "$RESPONSE" | jq -r '.data.paymentLinkId // empty')

if [ -n "$PAYMENT_LINK_ID" ]; then
  echo "✅ Payment Link Created: $PAYMENT_LINK_ID"
  echo ""
  
  # Test 2: Get Payment Status
  echo "📊 Test 2: Getting Payment Status..."
  echo ""
  
  curl -s ${BASE_URL}/payment-links/${PAYMENT_LINK_ID} | jq .
  echo ""
  echo "✅ Payment Status Retrieved"
else
  echo "❌ Failed to create payment link"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ All tests completed!"
echo ""
echo "Your API is live at: $BASE_URL"
echo ""
echo "Available endpoints:"
echo "  POST   ${BASE_URL}/payment-links"
echo "  GET    ${BASE_URL}/payment-links/{id}"
echo "  POST   ${BASE_URL}/webhook"
