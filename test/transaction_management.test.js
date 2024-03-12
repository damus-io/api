"use strict";
// @ts-check
/**
* @typedef {import('../src/transaction_management').Transaction} Transaction
*/
const { calculate_expiry_date_from_history } = require('../src/transaction_management');
const { v4: uuidv4 } = require('uuid');

const test = require('tap').test;

test('Calculate expiry date from transaction history - Simple IAP', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '2',
      start_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      duration: null
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-04-01T00:00:00Z');

  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});


test('Calculate expiry date from transaction history - IAPs with gap', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '2',
      start_date: generate_unix_timestamp('2024-03-05T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-05T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-03-05T00:00:00Z'),
      duration: null
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-04-05T00:00:00Z');

  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});


test('Calculate expiry date from transaction history - Simple LN with no gaps', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z') + 60 * 60 * 24 * 30,
      duration: 60 * 60 * 24 * 30
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-02-01T00:00:00Z') + 60 * 60 * 24 * 30 * 2;

  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});


test('Calculate expiry date from transaction history - Simple LN with gaps', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z') + (60 * 60 * 24 * 30) + (60 * 60 * 24), // One day gap
      duration: 60 * 60 * 24 * 30
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-02-01T00:00:00Z') + (60 * 60 * 24 * 30 * 2) + (60 * 60 * 24);

  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});


test('Calculate expiry date from transaction history - Simple LN with overlap', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z') + (60 * 60 * 24 * 30) - (60 * 60 * 24), // One before expiry
      duration: 60 * 60 * 24 * 30
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-02-01T00:00:00Z') + (60 * 60 * 24 * 30 * 2);

  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});


test('Calculate expiry date from transaction history - Simple LN with overlap and gap', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-01-01T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-01-01T00:00:00Z') + (60 * 60 * 24 * 35),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-01-01T00:00:00Z') + (60 * 60 * 24 * 35) + (60 * 60 * 24 * 25),
      duration: 60 * 60 * 24 * 30
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-01-01T00:00:00Z') + (60 * 60 * 24 * 95);
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


test('Calculate expiry date from transaction history - Legacy', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'legacy',
      id: '0',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    }
  ];
  const expected_expiry_date_1 = generate_unix_timestamp('2024-03-01T00:00:00Z');
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


test('Calculate expiry date from transaction history - Legacy with overlapping IAP', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'legacy',
      id: '0',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      duration: null
    }
  ];
  const expected_expiry_date_1 = generate_unix_timestamp('2024-04-01T00:00:00Z');
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


test('Calculate expiry date from transaction history - Legacy with overlapping LN', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'legacy',
      id: '0',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    }
  ];
  const expected_expiry_date_1 = generate_unix_timestamp('2024-04-01T00:00:00Z') + 60 * 60 * 24 * 30;
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


test('Calculate expiry date from transaction history - Empty history', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [];
  t.same(calculate_expiry_date_from_history(tx_history_1), null);
  t.end();
});


test('Calculate expiry date from transaction history - Overlapping IAPs, legacy and LN', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '2',
      start_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-04-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'legacy',
      id: '0',
      start_date: generate_unix_timestamp('2024-01-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-28T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-01-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-03-15T00:00:00Z'),
      duration: 60 * 60 * 24 * 30
    }
  ];

  const expected_expiry_date_1 = generate_unix_timestamp('2024-04-01T00:00:00Z') + 60 * 60 * 24 * 30;
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


test('Calculate expiry date from transaction history - Complex overlapping IAPs with gaps, legacy and LN with gaps', async (t) => {
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'legacy',
      id: '0',
      start_date: generate_unix_timestamp('2024-01-01T05:55:00Z'),
      end_date: generate_unix_timestamp('2024-03-05T02:40:00Z'),
      purchased_date: generate_unix_timestamp('2024-01-01T05:55:00Z'),
      duration: null
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-05T23:58:00Z'),
      duration: 60 * 60 * 24 * 30,
    },
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-26T04:44:00Z'),
      end_date: generate_unix_timestamp('2024-03-26T04:44:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-26T04:44:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '2',
      start_date: generate_unix_timestamp('2024-03-26T04:44:00Z'),
      end_date: generate_unix_timestamp('2024-04-26T04:44:00Z'),
      purchased_date: generate_unix_timestamp('2024-03-26T04:44:00Z'),
      duration: null
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-04-15T04:59:51Z'),
      duration: 60 * 60 * 24 * 30
    },
    {
      type: 'iap',
      id: '3',
      start_date: generate_unix_timestamp('2024-05-10T04:59:51Z'),
      end_date: generate_unix_timestamp('2024-06-10T04:59:51Z'),
    },
    {
      type: 'iap',
      id: '4',
      start_date: generate_unix_timestamp('2024-07-02T04:59:51Z'),
      end_date: generate_unix_timestamp('2024-07-20T04:59:51Z'),
    },
    {
      type: 'ln',
      id: uuidv4(),
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-07-25T04:20:00Z'),
      duration: 60 * 60 * 24 * 30 * 12
    }
  ];
  // 1. Gap between end of IAP 2 and start of IAP 3 is 1,210,551 seconds
  // 2. LN 1 will be used to fill up gap and at the start of IAP 3 there will be 1,381,449 seconds remaining
  // 3. Gap between end of IAP 3 and start of IAP 4 is 1,900,800 seconds
  // 4. Remaining time from LN 1 will be used completely to fill up the gap between 3 and 4, but there will still be 519,351 seconds remaining
  // 5. LN 2 will be used to fill up the remaining time
  // 6. In the beginning of IAP 4, LN 2 will still have 2,072,649 seconds remaining
  // 7. At the end of IAP 4, we will use all remaining seconds from LN 2 and then LN 3. LN 2 + LN 3 together have 33,176,649 seconds
  // 8. The expiry will then be IAP 4 end date + 33,176,649 seconds = August 8, 2025 at 04:44:00
  const expected_expiry_date_1 = generate_unix_timestamp('2025-08-08T04:44:00Z');
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);

  t.end();
});



test('Calculate expiry date from transaction history - Broken tx history with repeated transactions', async (t) => {
  const ln_id = uuidv4();
  // @type {Transaction[]}
  const tx_history_1 = [
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'iap',
      id: '1',
      start_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      end_date: generate_unix_timestamp('2024-03-01T00:00:00Z'),
      purchased_date: generate_unix_timestamp('2024-02-01T00:00:00Z'),
      duration: null
    },
    {
      type: 'ln',
      id: ln_id,
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-05T00:00:00Z'),
      duration: 60 * 60 * 24 * 30,
    },
    {
      type: 'ln',
      id: ln_id,
      start_date: null,
      end_date: null,
      purchased_date: generate_unix_timestamp('2024-02-05T00:00:00Z'),
      duration: 60 * 60 * 24 * 30,
    },
  ];
  const expected_expiry_date_1 = generate_unix_timestamp('2024-03-31T00:00:00Z');
  t.same(calculate_expiry_date_from_history(tx_history_1), expected_expiry_date_1);
  t.end();
});


function generate_unix_timestamp(date_string) {
  return new Date(date_string) / 1000;
}
