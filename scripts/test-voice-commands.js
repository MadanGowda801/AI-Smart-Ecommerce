import aiChatService from '../src/aiChatService.js';

async function runTests() {
  console.log('--- Testing Voice Commands & Number Recognition ---\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  const testCases = [
    {
      title: '1. "Show wireless headphones"',
      input: 'Show wireless headphones',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'show_products' && res.products.length > 0
    },
    {
      title: '2. "Show laptops under 60000 rupees"',
      input: 'Show laptops under 60000 rupees',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'show_products'
    },
    {
      title: '3. "Open my cart"',
      input: 'Open my cart',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'display_cart'
    },
    {
      title: '4. "Show my orders"',
      input: 'Show my orders',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'navigate'
    },
    {
      title: '5. "Search gaming keyboard"',
      input: 'Search gaming keyboard',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'show_products'
    },
    {
      title: '6. "Show electronics"',
      input: 'Show electronics',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'show_products'
    },
    {
      title: '7a. "Add this product to my cart" (with product in context)',
      input: 'Add this product to my cart',
      context: {
        currentProduct: { id: 'prod-1', name: 'Sony WH-1000XM5', price: 29990 },
        addItem: (p) => { return { success: true, items: [p] }; },
      },
      validate: (res) => res.status === 'success' && res.actionType === 'add_to_cart' && res.product.id === 'prod-1'
    },
    {
      title: '7b. "Add this product to my cart" (without product in context)',
      input: 'Add this product to my cart',
      context: {
        addItem: (p) => { return { success: true, items: [p] }; }
      },
      validate: (res) => res.status === 'success' && res.actionType === 'add_to_cart' && res.product
    },
    {
      title: '8. Number recognition: "one" / "1" selects item #1',
      input: 'one',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'select_product' && res.product
    },
    {
      title: '9. Digit recognition: "1" selects item #1',
      input: '1',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'select_product' && res.product
    },
    {
      title: '10. Ordinal recognition: "first one" selects item #1',
      input: 'first one',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'select_product' && res.product
    },
    {
      title: '11. Contextual ordinal selection: "two" / "2" from displayed list',
      input: '2',
      context: {
        lastProducts: [
          { id: 'p1', name: 'Sony WH-1000XM5', price: 29990 },
          { id: 'p2', name: 'Apple MacBook Air', price: 134900 }
        ]
      },
      validate: (res) => res.status === 'success' && res.actionType === 'select_product' && res.product.id === 'p2'
    },
    {
      title: '12. Add by ordinal: "add one" / "add 1"',
      input: 'add 1',
      context: {
        addItem: (p) => { return { success: true, items: [p] }; }
      },
      validate: (res) => res.status === 'success' && res.actionType === 'add_to_cart' && res.product
    },
    {
      title: '13. Buy by ordinal: "buy 1" adds to cart',
      input: 'buy 1',
      context: {
        addItem: (p) => { return { success: true, items: [p] }; }
      },
      validate: (res) => res.status === 'success' && res.actionType === 'add_to_cart' && res.product
    },
    {
      title: '14. Price query on ordinal: "how much is 1"',
      input: 'how much is 1',
      context: {},
      validate: (res) => res.status === 'success' && res.actionType === 'select_product' && res.voiceText.includes('₹')
    },
    {
      title: '15. Unsupported command: "Book an Uber to airport"',
      input: 'Book an Uber to airport',
      context: {},
      validate: (res) => res.status === 'unsupported'
    },
  ];

  for (const tc of testCases) {
    try {
      const res = await aiChatService.processVoiceCommand(tc.input, tc.context);
      const isOk = tc.validate(res);
      assert(isOk, tc.title);
    } catch (err) {
      assert(false, `${tc.title} (Exception: ${err.message})`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Voice Command Test Summary: ${passed}/${total} Passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
