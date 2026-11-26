#!/usr/bin/env node
/**
 * run_all_e2e.js - Progressive Master E2E Test Runner
 * ATTA DocStudio Pro (PWA & APK v1.0.0)
 * 
 * Supports:
 *   --tier=<1|2|3|4|all>      (-t)
 *   --feature=<F01..F20|1..20>(-f)
 *   --milestone=<M1..M5>      (-m)
 *   --grep="<pattern>"        (-g)
 *   --bail                    (-b)
 *   --json
 *   --quiet                   (-q)
 *   --list                    (-l)
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { createDOMSandbox } = require('../harness/dom_sandbox');

// Milestone to Feature Map
const MILESTONE_FEATURE_MAP = {
  M1: ['F01', 'F02', 'F03', 'F04', 'F05'],
  M2: ['F06', 'F07', 'F08', 'F09'],
  M3: ['F10', 'F11', 'F12', 'F13'],
  M4: ['F14', 'F15', 'F16', 'F17'],
  M5: ['F18', 'F19', 'F20']
};

class E2ETestRunner {
  constructor(options = {}) {
    this.options = options;
    this.suites = [];
    this.currentSuite = null;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      startTime: 0
    };
    this.failures = [];
    this.resultsByTier = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.resultsByMilestone = { M1: 0, M2: 0, M3: 0, M4: 0, M5: 0 };
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: [],
      afterAllHooks: []
    };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;

    const bdd = {
      it: (title, testFn) => {
        suite.tests.push({ title, testFn, skip: false, suiteName: name });
      },
      beforeAll: (hook) => suite.beforeAllHooks.push(hook),
      beforeEach: (hook) => suite.beforeEachHooks.push(hook),
      afterEach: (hook) => suite.afterEachHooks.push(hook),
      afterAll: (hook) => suite.afterAllHooks.push(hook)
    };
    bdd.it.skip = (title, testFn) => {
      suite.tests.push({ title, testFn, skip: true, suiteName: name });
    };

    global.it = bdd.it;
    global.beforeAll = bdd.beforeAll;
    global.beforeEach = bdd.beforeEach;
    global.afterEach = bdd.afterEach;
    global.afterAll = bdd.afterAll;

    fn();
    this.currentSuite = prevSuite;
  }

  isTestMatchingFilters(test) {
    const { tier, feature, milestone, grep } = this.options;
    const title = test.title;
    const suiteName = test.suiteName || '';
    const combined = `${suiteName} ${title}`;

    // Grep filter
    if (grep && !new RegExp(grep, 'i').test(combined)) {
      return false;
    }

    // Tier filter (T1, T2, T3, T4)
    if (tier && tier !== 'all') {
      const targetTier = String(tier).replace(/^T/i, '');
      const tierMatch = title.match(/T([1-4])[-_]/i) || suiteName.match(/Tier\s*([1-4])/i);
      if (tierMatch) {
        if (tierMatch[1] !== targetTier) return false;
      }
    }

    // Feature filter (F01..F20)
    if (feature) {
      let targetFeature = String(feature).toUpperCase();
      if (!targetFeature.startsWith('F')) {
        targetFeature = 'F' + targetFeature.padStart(2, '0');
      }
      const featMatch = combined.match(/F(0[1-9]|1[0-9]|20)/i);
      if (featMatch) {
        if (featMatch[0].toUpperCase() !== targetFeature) return false;
      } else {
        // If test doesn't mention feature explicitly and feature filter is active, check if in pairwise/scenario
        if (!combined.includes(targetFeature)) return false;
      }
    }

    // Milestone filter (M1..M5)
    if (milestone) {
      const ms = String(milestone).toUpperCase();
      const validFeatures = MILESTONE_FEATURE_MAP[ms] || [];
      const hasDirectMs = combined.includes(ms);
      const hasMappedFeat = validFeatures.some((f) => combined.includes(f));
      if (!hasDirectMs && !hasMappedFeat) {
        return false;
      }
    }

    return true;
  }

  async run() {
    this.stats.startTime = Date.now();

    if (!this.options.json) {
      console.log('======================================================================');
      console.log('ATTA DocStudio Pro E2E Test Suite (Tiers 1-4)');
      console.log('Execution Mode: VM Opaque-Box Sandbox | Node.js ' + process.version);
      console.log('Target: pwa-docstudio-pro (v1.0.0)');
      if (this.options.tier) console.log(`Filter [Tier]: ${this.options.tier}`);
      if (this.options.feature) console.log(`Filter [Feature]: ${this.options.feature}`);
      if (this.options.milestone) console.log(`Filter [Milestone]: ${this.options.milestone}`);
      if (this.options.grep) console.log(`Filter [Grep]: ${this.options.grep}`);
      console.log('======================================================================');
    }

    // If --list flag is given, simply list matching tests
    if (this.options.list) {
      let count = 0;
      for (const suite of this.suites) {
        console.log(`\nSuite: ${suite.name}`);
        for (const test of suite.tests) {
          if (this.isTestMatchingFilters(test)) {
            count++;
            console.log(`  [${test.skip ? 'SKIP' : 'TEST'}] ${test.title}`);
          }
        }
      }
      console.log(`\nTotal Discovered Matching Tests: ${count}`);
      return 0;
    }

    // Global reusable test environment for performance, with per-test DOM reset
    let sharedEnv = createDOMSandbox();

    for (const suite of this.suites) {
      const matchingTests = suite.tests.filter((t) => this.isTestMatchingFilters(t));
      if (matchingTests.length === 0) continue;

      if (!this.options.json && !this.options.quiet) {
        console.log(`\n  Suite: ${suite.name}`);
      }

      for (const hook of suite.beforeAllHooks) {
        await hook({ ...sharedEnv, assert });
      }

      for (const test of matchingTests) {
        this.stats.total++;

        // Track by tier
        const tMatch = test.title.match(/T([1-4])[-_]/i) || suite.name.match(/Tier\s*([1-4])/i);
        const tierNum = tMatch ? parseInt(tMatch[1], 10) : 1;

        if (test.skip) {
          this.stats.skipped++;
          if (!this.options.json && !this.options.quiet) {
            console.log(`    [SKIP] ${test.title}`);
          }
          continue;
        }

        const t0 = Date.now();
        try {
          for (const hook of suite.beforeEachHooks) {
            await hook({ ...sharedEnv, assert });
          }

          // Execute test
          await test.testFn({ ...sharedEnv, assert });

          for (const hook of suite.afterEachHooks) {
            await hook({ ...sharedEnv, assert });
          }

          const dt = Date.now() - t0;
          this.stats.passed++;
          if (this.resultsByTier[tierNum] !== undefined) {
            this.resultsByTier[tierNum]++;
          }

          if (!this.options.json && !this.options.quiet) {
            console.log(`    [PASS] ${test.title} (${dt}ms)`);
          }
        } catch (err) {
          const dt = Date.now() - t0;
          this.stats.failed++;
          this.failures.push({
            suite: suite.name,
            title: test.title,
            error: err.message,
            stack: err.stack
          });

          if (!this.options.json) {
            console.error(`    [FAIL] ${test.title} (${dt}ms)`);
            console.error(`           Error: ${err.message}`);
          }

          // Refresh sandbox if state was corrupted by failure
          sharedEnv = createDOMSandbox();

          if (this.options.bail) {
            return this.finalize();
          }
        }
      }

      for (const hook of suite.afterAllHooks) {
        await hook({ ...sharedEnv, assert });
      }
    }

    return this.finalize();
  }

  finalize() {
    this.stats.duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(2);

    if (this.options.json) {
      console.log(JSON.stringify({
        stats: this.stats,
        resultsByTier: this.resultsByTier,
        failures: this.failures
      }, null, 2));
      return this.stats.failed === 0 ? 0 : 1;
    }

    console.log('\n======================================================================');
    console.log('E2E TEST SUMMARY');
    console.log('======================================================================');
    console.log(`Total Tests Executed: ${this.stats.total}`);
    console.log(`Passed:               ${this.stats.passed}`);
    console.log(`Failed:               ${this.stats.failed}`);
    console.log(`Skipped:              ${this.stats.skipped}`);
    console.log(`Duration:             ${this.stats.duration}s`);
    console.log('----------------------------------------------------------------------');
    console.log(`Tier 1 (Features):    ${this.resultsByTier[1] || 0} passed`);
    console.log(`Tier 2 (Boundaries):  ${this.resultsByTier[2] || 0} passed`);
    console.log(`Tier 3 (Pairwise):    ${this.resultsByTier[3] || 0} passed`);
    console.log(`Tier 4 (Scenarios):   ${this.resultsByTier[4] || 0} passed`);
    console.log('----------------------------------------------------------------------');

    if (this.failures.length > 0) {
      console.log('\nFAILURES:');
      for (const f of this.failures) {
        console.log(`- [${f.suite}] ${f.title}`);
        console.log(`  ${f.error}`);
      }
      console.log('======================================================================');
      console.log('Exit Code:            1 (TESTS FAILED)');
      console.log('======================================================================');
      return 1;
    } else {
      console.log('Exit Code:            0 (ALL TESTS PASSED)');
      console.log('======================================================================');
      return 0;
    }
  }
}

// Parse Command Line Arguments
function parseCLIArgs() {
  const args = process.argv.slice(2);
  const options = {
    tier: null,
    feature: null,
    milestone: null,
    grep: null,
    bail: false,
    json: false,
    quiet: false,
    list: false
  };

  for (const arg of args) {
    if (arg.startsWith('--tier=')) options.tier = arg.split('=')[1];
    else if (arg.startsWith('-t=')) options.tier = arg.split('=')[1];
    else if (arg.startsWith('--feature=')) options.feature = arg.split('=')[1];
    else if (arg.startsWith('-f=')) options.feature = arg.split('=')[1];
    else if (arg.startsWith('--milestone=')) options.milestone = arg.split('=')[1];
    else if (arg.startsWith('-m=')) options.milestone = arg.split('=')[1];
    else if (arg.startsWith('--grep=')) options.grep = arg.split('=')[1];
    else if (arg.startsWith('-g=')) options.grep = arg.split('=')[1];
    else if (arg === '--bail' || arg === '-b') options.bail = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else if (arg === '--list' || arg === '-l') options.list = true;
  }

  return options;
}

// Main Execution
async function main() {
  const options = parseCLIArgs();
  const runner = new E2ETestRunner(options);

  // Expose describe on global
  global.describe = runner.describe.bind(runner);

  // Discover and load tier test suites in test/suites
  const suitesDir = path.resolve(__dirname, '../suites');
  if (fs.existsSync(suitesDir)) {
    const files = fs.readdirSync(suitesDir)
      .filter((f) => f.startsWith('tier') && f.endsWith('.test.js'))
      .sort();

    for (const f of files) {
      const fullPath = path.join(suitesDir, f);
      require(fullPath);
    }
  }

  const exitCode = await runner.run();
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { E2ETestRunner, parseCLIArgs };
