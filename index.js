const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'Duplicate Detector Microservice',
    status: 'healthy',
    version: '1.0.0',
    features: ['Exact Price Match', 'Exact Date Match', 'Store Name Subset Match'],
    timestamp: new Date().toISOString()
  });
});

function normalizeStoreName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function isStoreNameMatch(name1, name2) {
  const normalized1 = normalizeStoreName(name1);
  const normalized2 = normalizeStoreName(name2);

  if (normalized1 === normalized2) {
    return true; // Exact match
  }

  return normalized1.includes(normalized2) || normalized2.includes(normalized1);
}

function isSameDate(date1, date2) {
  if (!date1 || !date2) return false;

  const normalizeDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return normalizeDate(date1) === normalizeDate(date2);
}

function isSameAmount(amount1, amount2) {
  if (!amount1 || !amount2) return false;

  const parseAmount = (amount) => {
    return parseFloat(amount.toString().replace(/[$,]/g, ''));
  };

  return parseAmount(amount1) === parseAmount(amount2);
}

function findDuplicates(receipts) {
  const duplicateGroups = [];
  const processed = new Set();

  for (let i = 0; i < receipts.length; i++) {
    if (processed.has(i)) continue;

    const currentReceipt = receipts[i];
    const duplicateGroup = [currentReceipt];
    processed.add(i);

    for (let j = i + 1; j < receipts.length; j++) {
      if (processed.has(j)) continue;

      const compareReceipt = receipts[j];

      const priceMatch = isSameAmount(currentReceipt.amount, compareReceipt.amount);
      const dateMatch = isSameDate(currentReceipt.receipt_date, compareReceipt.receipt_date);
      const storeMatch = isStoreNameMatch(currentReceipt.store_name, compareReceipt.store_name);

      if (priceMatch && dateMatch && storeMatch) {
        duplicateGroup.push(compareReceipt);
        processed.add(j);
      }
    }

    if (duplicateGroup.length > 1) {
      duplicateGroups.push({
        group_id: duplicateGroups.length + 1,
        duplicate_count: duplicateGroup.length,
        receipts: duplicateGroup,
        criteria_matched: ['price', 'date', 'store_name'],
        confidence: 'high'
      });
    }
  }

  return duplicateGroups;
}

// Check for duplicates in a list of receipts
app.post('/duplicates/check', (req, res) => {
  try {
    const { receipts } = req.body;

    // Validation
    if (!receipts || !Array.isArray(receipts)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'receipts array is required'
      });
    }

    if (receipts.length === 0) {
      return res.json({
        success: true,
        message: 'No receipts to check',
        duplicate_groups: [],
        total_duplicates: 0,
        total_receipts: 0
      });
    }

    if (receipts.length > 1000) {
      return res.status(400).json({
        error: 'Too many receipts',
        details: 'Maximum 1000 receipts can be checked at once'
      });
    }

    console.log(`Checking ${receipts.length} receipts for duplicates...`);

    const startTime = Date.now();
    const duplicateGroups = findDuplicates(receipts);
    const processingTime = Date.now() - startTime;

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicate_count, 0);

    console.log(`Found ${duplicateGroups.length} duplicate groups with ${totalDuplicates} total duplicates in ${processingTime}ms`);

    res.json({
      success: true,
      message: `Duplicate check completed for ${receipts.length} receipts`,
      duplicate_groups: duplicateGroups,
      total_duplicates: totalDuplicates,
      total_receipts: receipts.length,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      success: false,
      error: 'Duplicate check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check if a single receipt is a duplicate of existing receipts
app.post('/duplicates/check-single', (req, res) => {
  try {
    const { new_receipt, existing_receipts } = req.body;

    // Validation
    if (!new_receipt) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'new_receipt object is required'
      });
    }

    if (!existing_receipts || !Array.isArray(existing_receipts)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'existing_receipts array is required'
      });
    }

    console.log(`Checking if new receipt is duplicate of ${existing_receipts.length} existing receipts...`);

    const startTime = Date.now();
    const matches = [];

    for (const existingReceipt of existing_receipts) {
      const priceMatch = isSameAmount(new_receipt.amount, existingReceipt.amount);
      const dateMatch = isSameDate(new_receipt.receipt_date, existingReceipt.receipt_date);
      const storeMatch = isStoreNameMatch(new_receipt.store_name, existingReceipt.store_name);

      if (priceMatch && dateMatch && storeMatch) {
        matches.push({
          existing_receipt: existingReceipt,
          criteria_matched: ['price', 'date', 'store_name'],
          confidence: 'high'
        });
      }
    }

    const processingTime = Date.now() - startTime;
    const isDuplicate = matches.length > 0;

    console.log(`${isDuplicate ? 'Found' : 'No'} duplicates for new receipt in ${processingTime}ms`);

    res.json({
      success: true,
      is_duplicate: isDuplicate,
      message: isDuplicate
        ? `Found ${matches.length} potential duplicate${matches.length > 1 ? 's' : ''}`
        : 'No duplicates found',
      matches: matches,
      new_receipt: new_receipt,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Single duplicate check error:', error);
    res.status(500).json({
      success: false,
      error: 'Single duplicate check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/duplicates/criteria', (req, res) => {
  res.json({
    criteria: [
      {
        name: 'store_name',
        description: 'Store/provider name comparison (exact match or substring)',
        examples: ['CVS matches CVS Pharmacy', 'Walgreens matches WALGREENS STORE']
      },
      {
        name: 'amount',
        description: 'Exact amount match (ignoring currency symbols)',
        examples: ['$25.99 matches 25.99', '$100.00 matches 100']
      },
      {
        name: 'receipt_date',
        description: 'Exact date match (same calendar day)',
        examples: ['2024-03-15 matches 2024-03-15', 'Different formats normalized']
      }
    ],
    rules: [
      'All three criteria must match for a duplicate detection',
      'Store names are normalized (case-insensitive, punctuation removed)',
      'One store name can be a substring of another',
      'Amounts are compared as numbers (currency symbols ignored)',
      'Dates are normalized to YYYY-MM-DD format for comparison'
    ],
    confidence_levels: {
      high: 'All criteria match exactly'
    }
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'POST /duplicates/check',
      'POST /duplicates/check-single',
      'GET /duplicates/criteria',
      'GET /duplicates/metrics'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Receipt Duplicate Detector running on port ${PORT}`);
  console.log('Detection criteria: Exact price + Exact date + Store name subset match');
});

module.exports = app;