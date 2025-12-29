#!/usr/bin/env node

/**
 * Performance Analysis Script
 * 
 * Analyzes the codebase for performance issues and provides detailed reports
 * Usage: node analyze-performance.js --output-format detailed
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceAnalyzer {
  constructor() {
    this.issues = [];
    this.metrics = {
      fileCount: 0,
      totalLines: 0,
      complexFunctions: [],
      largeFiles: [],
      duplicateCode: [],
      memoryIntensivePatterns: [],
      blockingOperations: []
    };
  }

  async analyze(rootDir = '.') {
    console.log('🔍 Starting Performance Analysis...\n');
    const startTime = performance.now();

    // Analyze all JavaScript/TypeScript files
    const files = await this.getAllJsFiles(rootDir);
    this.metrics.fileCount = files.length;

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n').length;
        this.metrics.totalLines += lines;

        // Check for large files
        if (lines > 500) {
          this.metrics.largeFiles.push({ file, lines });
        }

        // Analyze code patterns
        this.analyzeCodePatterns(file, content);
      } catch (error) {
        console.warn(`Warning: Could not analyze ${file}: ${error.message}`);
      }
    }
    
    // Check for common performance issues
    this.checkForPerformanceIssues();
    
    const endTime = performance.now();
    this.generateReport(endTime - startTime);
  }



  async getAllJsFiles(dir, fileList = []) {
    const files = await fs.promises.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'coverage') {
        await this.getAllJsFiles(filePath, fileList);
      } else if (file.match(/\.(js|ts|jsx|tsx)$/)) {
        // Exclude dist files from analysis
        if (!filePath.includes('/dist/') && !filePath.includes('/coverage/')) {
          fileList.push(filePath);
        }
      }
    }
    
    return fileList;
  }

  analyzeCodePatterns(file, content) {
    // Check for blocking operations
    const blockingPatterns = [
      /while\s*\(\s*true\s*\)/g,
      /for\s*\(\s*;\s*;\s*\)/g,
      /sync\s*\(.*\)/g,
      /fs\.readFileSync/g,
      /fs\.writeFileSync/g,
      /child_process\.spawnSync/g
    ];

    blockingPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.metrics.blockingOperations.push({
          file,
          pattern: pattern.source,
          count: matches.length
        });
      }
    });

    // Check for memory-intensive patterns
    const memoryPatterns = [
      /new Array\s*\(\s*\d{4,}\s*\)/g,
      /\.slice\(0\)/g,
      /JSON\.parse\(JSON\.stringify/g,
      /console\.log\s*\(\s*.*\.\*\)/g
    ];

    memoryPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.metrics.memoryIntensivePatterns.push({
          file,
          pattern: pattern.source,
          count: matches.length
        });
      }
    });

    // Check for complex functions (simplified)
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
    const arrowFunctionMatches = content.match(/\w+\s*=\s*\([^)]*\)\s*=>\s*{[^}]*}/g) || [];
    
    [...functionMatches, ...arrowFunctionMatches].forEach(func => {
      const lines = func.split('\n').length;
      if (lines > 20) {
        this.metrics.complexFunctions.push({
          file,
          function: func.split('{')[0].trim(),
          lines
        });
      }
    });
  }

  checkForPerformanceIssues() {
    // Large files issue
    if (this.metrics.largeFiles.length > 0) {
      this.issues.push({
        type: 'Large Files',
        severity: 'medium',
        count: this.metrics.largeFiles.length,
        description: 'Files with more than 500 lines may impact load performance',
        recommendation: 'Consider splitting large files into smaller modules'
      });
    }

    // Blocking operations
    if (this.metrics.blockingOperations.length > 0) {
      this.issues.push({
        type: 'Blocking Operations',
        severity: 'high',
        count: this.metrics.blockingOperations.reduce((sum, op) => sum + op.count, 0),
        description: 'Synchronous operations that can block the event loop',
        recommendation: 'Replace with async alternatives where possible'
      });
    }

    // Memory-intensive patterns
    if (this.metrics.memoryIntensivePatterns.length > 0) {
      this.issues.push({
        type: 'Memory-Intensive Patterns',
        severity: 'medium',
        count: this.metrics.memoryIntensivePatterns.reduce((sum, pat) => sum + pat.count, 0),
        description: 'Patterns that may cause high memory usage',
        recommendation: 'Optimize memory usage and avoid unnecessary cloning'
      });
    }

    // Complex functions
    if (this.metrics.complexFunctions.length > 5) {
      this.issues.push({
        type: 'Complex Functions',
        severity: 'medium',
        count: this.metrics.complexFunctions.length,
        description: 'Functions with more than 20 lines may be hard to optimize',
        recommendation: 'Break down complex functions into smaller, testable units'
      });
    }
  }

  generateReport(analysisTime) {
    console.log('📊 Performance Analysis Report');
    console.log('===============================\n');
    
    console.log(`🔢 Analysis Metrics:`);
    console.log(`   Files analyzed: ${this.metrics.fileCount}`);
    console.log(`   Total lines: ${this.metrics.totalLines}`);
    console.log(`   Analysis time: ${analysisTime.toFixed(2)}ms\n`);

    if (this.issues.length === 0) {
      console.log('✅ No significant performance issues found!');
      return;
    }

    console.log(`⚠️  Found ${this.issues.length} performance issue(s):\n`);

    this.issues.forEach((issue, index) => {
      const icon = issue.severity === 'high' ? '🔴' : '🟡';
      console.log(`${icon} ${index + 1}. ${issue.type} (${issue.severity} severity)`);
      console.log(`   Count: ${issue.count}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Recommendation: ${issue.recommendation}\n`);
    });

    // Detailed breakdown
    console.log('📋 Detailed Breakdown:');
    console.log('====================\n');

    if (this.metrics.largeFiles.length > 0) {
      console.log('📁 Large Files (>500 lines):');
      this.metrics.largeFiles.slice(0, 10).forEach(file => {
        console.log(`   ${file.file}: ${file.lines} lines`);
      });
      if (this.metrics.largeFiles.length > 10) {
        console.log(`   ... and ${this.metrics.largeFiles.length - 10} more`);
      }
      console.log('');
    }

    if (this.metrics.blockingOperations.length > 0) {
      console.log('🚫 Blocking Operations:');
      this.metrics.blockingOperations.forEach(op => {
        console.log(`   ${op.file}: ${op.pattern} (${op.count} occurrences)`);
      });
      console.log('');
    }

    if (this.metrics.memoryIntensivePatterns.length > 0) {
      console.log('💾 Memory-Intensive Patterns:');
      this.metrics.memoryIntensivePatterns.forEach(pat => {
        console.log(`   ${pat.file}: ${pat.pattern} (${pat.count} occurrences)`);
      });
      console.log('');
    }

    if (this.metrics.complexFunctions.length > 0) {
      console.log('🔧 Complex Functions (>20 lines):');
      this.metrics.complexFunctions.slice(0, 10).forEach(func => {
        console.log(`   ${func.file}: ${func.function} (${func.lines} lines)`);
      });
      if (this.metrics.complexFunctions.length > 10) {
        console.log(`   ... and ${this.metrics.complexFunctions.length - 10} more`);
      }
      console.log('');
    }

    // Summary and recommendations
    console.log('💡 Overall Recommendations:');
    
    if (this.issues.some(issue => issue.severity === 'high')) {
      console.log('   🔴 URGENT: Address high-severity issues immediately');
    }
    
    console.log('   📈 Consider implementing performance monitoring in production');
    console.log('   🧪 Add performance tests to your CI/CD pipeline');
    console.log('   📊 Set up alerts for memory usage and response times');
    console.log('   🔄 Regularly profile your application with realistic loads');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const outputFormat = args.includes('--output-format=detailed') ? 'detailed' : 'simple';
  
  const analyzer = new PerformanceAnalyzer();
  await analyzer.analyze('.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceAnalyzer;