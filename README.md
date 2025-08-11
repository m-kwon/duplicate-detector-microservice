# Duplicate Detector Microservice

A microservice for detecting duplicate receipts in the RxReceipts healthcare expense tracking application.

## Detection Criteria

A receipt is considered a duplicate when **ALL** of these criteria match:

1. **Exact Amount Match**: `$25.99 = 25.99` (currency symbols ignored)
2. **Exact Date Match**: `2024-03-15 = 2024-03-15` (same calendar day)
3. **Store Name Subset Match**: `CVS` matches `CVS Pharmacy` (one is substring of other)

### Store Name Matching Examples
- `CVS` ↔ `CVS Pharmacy`
- `Walgreens` ↔ `WALGREENS STORE #1234`
- `Target` ↔ `Target Pharmacy`
x `CVS` ↔ `Walgreens` (completely different)

## Installation

```bash
# Install dependencies
npm install

# Start the service
npm start

# Run in development mode
npm run dev

# Run tests
npm test
```

## Dependencies

- **Express**: Web framework
- **CORS**: Cross-origin resource sharing

## API Endpoints

### Health Check
```http
GET /health
```

Returns service status and configuration.

### Batch Duplicate Detection
```http
POST /duplicates/check
Content-Type: application/json

{
  "receipts": [
    {
      "id": 1,
      "store_name": "CVS Pharmacy",
      "amount": 25.99,
      "receipt_date": "2024-03-15",
      "category": "Pharmacy",
      "description": "Monthly prescription"
    },
    {
      "id": 2,
      "store_name": "CVS",
      "amount": 25.99,
      "receipt_date": "2024-03-15",
      "category": "Pharmacy",
      "description": "Prescription meds"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Duplicate check completed for 2 receipts",
  "duplicate_groups": [
    {
      "group_id": 1,
      "duplicate_count": 2,
      "receipts": [
        { "id": 1, "store_name": "CVS Pharmacy", "amount": 25.99, "receipt_date": "2024-03-15" },
        { "id": 2, "store_name": "CVS", "amount": 25.99, "receipt_date": "2024-03-15" }
      ],
      "criteria_matched": ["price", "date", "store_name"],
      "confidence": "high"
    }
  ],
  "total_duplicates": 2,
  "total_receipts": 2,
  "processing_time_ms": 15
}
```

### Single Receipt Duplicate Check
```http
POST /duplicates/check-single
Content-Type: application/json

{
  "new_receipt": {
    "store_name": "CVS PHARMACY DOWNTOWN",
    "amount": 25.99,
    "receipt_date": "2024-03-15",
    "category": "Pharmacy"
  },
  "existing_receipts":
}