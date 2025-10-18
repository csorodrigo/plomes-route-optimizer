#!/usr/bin/env node

/**
 * Dashboard Module Test Setup Validator
 * Validates that all test files and configurations are properly set up
 */

const fs = require('fs');
const path = require('path');

class TestSetupValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
    this.basePath = __dirname;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  checkFileExists(filePath, description, required = true) {
    const fullPath = path.join(this.basePath, filePath);
    if (fs.existsSync(fullPath)) {
      this.success.push(`${description}: ${filePath}`);
      this.log(`Found: ${description}`, 'success');
      return true;
    } else {
      const message = `Missing: ${description} - ${filePath}`;
      if (required) {
        this.errors.push(message);
        this.log(message, 'error');
      } else {
        this.warnings.push(message);
        this.log(message, 'warning');
      }
      return false;
    }
  }

  checkDirectoryStructure() {
    this.log('🔍 Checking directory structure...');

    const requiredDirs = [
      '__tests__',
      '__tests__/components',
      '__tests__/hooks',
      '__tests__/utils',
      '__tests__/integration',
      '__e2e__',
    ];

    requiredDirs.forEach(dir => {
      this.checkFileExists(dir, `Directory: ${dir}`, true);
    });
  }

  checkTestFiles() {
    this.log('🧪 Checking test files...');

    const testFiles = [
      // Unit tests
      '__tests__/components/MetricCard.test.tsx',
      '__tests__/components/charts/BarChart.test.tsx',
      '__tests__/hooks/useDashboardData.test.ts',

      // Utilities
      '__tests__/utils/test-utils.tsx',
      '__tests__/utils/mock-data.ts',

      // Integration tests
      '__tests__/integration/dashboard-api.test.ts',

      // E2E tests
      '__e2e__/dashboard-workflows.spec.ts',
      '__e2e__/visual-regression.spec.ts',
    ];

    testFiles.forEach(file => {
      this.checkFileExists(file, `Test file: ${file}`, true);
    });
  }

  checkConfigFiles() {
    this.log('⚙️ Checking configuration files...');

    const configFiles = [
      'package.json',
      'test-runner.config.js',
      'testing-strategy.md',
      'TESTING_REPORT.md',
    ];

    configFiles.forEach(file => {
      this.checkFileExists(file, `Config file: ${file}`, true);
    });
  }

  checkSourceFiles() {
    this.log('📁 Checking source files...');

    const sourceFiles = [
      'components/MetricCard.tsx',
      'components/charts/BarChart.tsx',
      'hooks/useDashboardData.ts',
      'types/dashboard.ts',
    ];

    sourceFiles.forEach(file => {
      this.checkFileExists(file, `Source file: ${file}`, true);
    });
  }

  validatePackageJson() {
    this.log('📦 Validating package.json...');

    try {
      const packagePath = path.join(this.basePath, 'package.json');
      if (!fs.existsSync(packagePath)) {
        this.errors.push('package.json not found');
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      // Check required scripts
      const requiredScripts = [
        'test',
        'test:unit',
        'test:integration',
        'test:e2e',
        'test:visual',
        'test:coverage',
      ];

      requiredScripts.forEach(script => {
        if (packageJson.scripts && packageJson.scripts[script]) {
          this.success.push(`Script: ${script}`);
          this.log(`Found script: ${script}`, 'success');
        } else {
          this.errors.push(`Missing script: ${script}`);
          this.log(`Missing script: ${script}`, 'error');
        }
      });

      // Check Jest configuration
      if (packageJson.jest) {
        this.success.push('Jest configuration found');
        this.log('Jest configuration found', 'success');
      } else {
        this.warnings.push('Jest configuration not found in package.json');
        this.log('Jest configuration not found', 'warning');
      }

    } catch (error) {
      this.errors.push(`Error parsing package.json: ${error.message}`);
      this.log(`Error parsing package.json: ${error.message}`, 'error');
    }
  }

  checkGitHubWorkflow() {
    this.log('🔄 Checking GitHub workflow...');

    const workflowPath = '../../.github/workflows/dashboard-tests.yml';
    this.checkFileExists(workflowPath, 'GitHub Actions workflow', false);
  }

  validateTestContent() {
    this.log('🔬 Validating test content...');

    try {
      // Check if MetricCard test has proper structure
      const metricCardTestPath = path.join(this.basePath, '__tests__/components/MetricCard.test.tsx');
      if (fs.existsSync(metricCardTestPath)) {
        const content = fs.readFileSync(metricCardTestPath, 'utf8');

        const requiredPatterns = [
          /describe\s*\(/,
          /test\s*\(/,
          /expect\s*\(/,
          /render\s*\(/,
          /MetricCard/,
        ];

        requiredPatterns.forEach((pattern, index) => {
          if (pattern.test(content)) {
            this.success.push(`MetricCard test pattern ${index + 1} found`);
          } else {
            this.warnings.push(`MetricCard test pattern ${index + 1} missing`);
          }
        });
      }

      // Check if API test uses MSW
      const apiTestPath = path.join(this.basePath, '__tests__/integration/dashboard-api.test.ts');
      if (fs.existsSync(apiTestPath)) {
        const content = fs.readFileSync(apiTestPath, 'utf8');

        if (content.includes('msw')) {
          this.success.push('API tests use MSW for mocking');
          this.log('API tests use MSW for mocking', 'success');
        } else {
          this.warnings.push('API tests may not use MSW for mocking');
          this.log('API tests may not use MSW for mocking', 'warning');
        }
      }

    } catch (error) {
      this.warnings.push(`Error validating test content: ${error.message}`);
      this.log(`Error validating test content: ${error.message}`, 'warning');
    }
  }

  generateReport() {
    this.log('\n📊 VALIDATION SUMMARY');
    this.log('=' * 50);

    this.log(`✅ Successful checks: ${this.success.length}`);
    this.log(`⚠️ Warnings: ${this.warnings.length}`);
    this.log(`❌ Errors: ${this.errors.length}`);

    if (this.errors.length > 0) {
      this.log('\n❌ ERRORS:');
      this.errors.forEach(error => this.log(`  - ${error}`, 'error'));
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️ WARNINGS:');
      this.warnings.forEach(warning => this.log(`  - ${warning}`, 'warning'));
    }

    if (this.success.length > 0) {
      this.log('\n✅ SUCCESSFUL CHECKS:');
      this.success.slice(0, 10).forEach(success => this.log(`  - ${success}`, 'success'));
      if (this.success.length > 10) {
        this.log(`  ... and ${this.success.length - 10} more`, 'success');
      }
    }

    const overallStatus = this.errors.length === 0 ? 'PASSED' : 'FAILED';
    const statusColor = this.errors.length === 0 ? 'success' : 'error';

    this.log(`\n🎯 OVERALL STATUS: ${overallStatus}`, statusColor);

    if (this.errors.length === 0) {
      this.log('\n🚀 Test setup is ready for execution!', 'success');
      this.log('Next steps:');
      this.log('  1. Run: npm run test:unit');
      this.log('  2. Run: npm run test:integration');
      this.log('  3. Run: npm run test:coverage');
    } else {
      this.log('\n🔧 Please fix the errors above before proceeding.', 'error');
    }

    return {
      success: this.errors.length === 0,
      errors: this.errors.length,
      warnings: this.warnings.length,
      successCount: this.success.length,
    };
  }

  run() {
    this.log('🚀 Starting Dashboard Module Test Setup Validation');

    this.checkDirectoryStructure();
    this.checkTestFiles();
    this.checkConfigFiles();
    this.checkSourceFiles();
    this.validatePackageJson();
    this.checkGitHubWorkflow();
    this.validateTestContent();

    return this.generateReport();
  }
}

// CLI execution
if (require.main === module) {
  const validator = new TestSetupValidator();
  const result = validator.run();
  process.exit(result.success ? 0 : 1);
}

module.exports = TestSetupValidator;