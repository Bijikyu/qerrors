#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let totalLines = 0;
    let commentLines = 0;
    let codeLines = 0;
    let emptyLines = 0;
    let hasFileHeader = false;
    let hasJSDoc = false;
    let functions = [];
    let currentFunction = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      totalLines++;
      
      // Check for empty lines
      if (trimmed === '') {
        emptyLines++;
        continue;
      }
      
      // Check for file header comment
      if (i < 10 && (trimmed.startsWith('/**') || trimmed.startsWith('/*') || trimmed.startsWith('//'))) {
        hasFileHeader = true;
      }
      
      // Check for comments
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        commentLines++;
        
        // Check for JSDoc
        if (trimmed.startsWith('/**') || (trimmed.startsWith('*') && hasFileHeader)) {
          hasJSDoc = true;
        }
        continue;
      }
      
      // It's code
      codeLines++;
      
      // Simple function detection
      const functionMatch = trimmed.match(/^(?:function\s+\w+|const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>)|\w+\s*:\s*function|\w+\s*\([^)]*\)\s*[{=])/);
      if (functionMatch) {
        if (currentFunction) {
          functions.push(currentFunction);
        }
        currentFunction = {
          name: functionMatch[1] || 'anonymous',
          line: i + 1,
          hasComment: false,
          commentLines: 0
        };
      }
      
      // Track if current function has comments
      if (currentFunction && (trimmed.startsWith('//') || trimmed.startsWith('/*'))) {
        currentFunction.hasComment = true;
        currentFunction.commentLines++;
      }
      
      // End function detection
      if (currentFunction && (trimmed.includes('}') || (trimmed.includes(';') && !trimmed.includes('{')))) {
        if (currentFunction) {
          functions.push(currentFunction);
          currentFunction = null;
        }
      }
    }
    
    const commentRatio = totalLines > 0 ? (commentLines / totalLines) * 100 : 0;
    const uncommentedFunctions = functions.filter(f => !f.hasComment);
    
    return {
      filePath,
      totalLines,
      commentLines,
      codeLines,
      emptyLines,
      commentRatio,
      hasFileHeader,
      hasJSDoc,
      functions,
      uncommentedFunctions,
      needsComments: commentRatio < 10 || uncommentedFunctions.length > 0
    };
  } catch (error) {
    return {
      filePath,
      error: error.message,
      needsComments: false
    };
  }
}

function main() {
  console.log(`${colors.cyan}🔍 Analyzing uncommented files...${colors.reset}\n`);
  
  // Find all JS files in lib directory
  const files = glob.sync('lib/**/*.js');
  
  if (files.length === 0) {
    console.log(`${colors.yellow}No JavaScript files found in lib directory.${colors.reset}`);
    return;
  }
  
  const results = files.map(analyzeFile);
  const problematicFiles = results.filter(r => r.needsComments && !r.error);
  
  // Summary
  console.log(`${colors.blue}📊 Summary:${colors.reset}`);
  console.log(`Total files analyzed: ${files.length}`);
  console.log(`Files needing comments: ${problematicFiles.length}`);
  console.log(`Overall comment coverage: ${(results.reduce((sum, r) => sum + (r.commentRatio || 0), 0) / results.length).toFixed(1)}%\n`);
  
  if (problematicFiles.length === 0) {
    console.log(`${colors.green}✅ All files have adequate comments!${colors.reset}`);
    return;
  }
  
  // Detailed analysis
  console.log(`${colors.yellow}⚠️  Files that need attention:${colors.reset}\n`);
  
  problematicFiles.forEach(file => {
    console.log(`${colors.red}📄 ${file.filePath}${colors.reset}`);
    console.log(`  Lines: ${file.totalLines} | Comments: ${file.commentLines} (${file.commentRatio.toFixed(1)}%)`);
    console.log(`  File header: ${file.hasFileHeader ? '✅' : '❌'} | JSDoc: ${file.hasJSDoc ? '✅' : '❌'}`);
    
    if (file.uncommentedFunctions.length > 0) {
      console.log(`  Uncommented functions: ${file.uncommentedFunctions.length}`);
      file.uncommentedFunctions.slice(0, 3).forEach(fn => {
        console.log(`    - ${fn.name} (line ${fn.line})`);
      });
      if (file.uncommentedFunctions.length > 3) {
        console.log(`    ... and ${file.uncommentedFunctions.length - 3} more`);
      }
    }
    console.log();
  });
  
  // Recommendations
  console.log(`${colors.magenta}💡 Recommendations:${colors.reset}`);
  console.log(`1. Add file header comments explaining the purpose of each module`);
  console.log(`2. Add JSDoc comments for all public functions and methods`);
  console.log(`3. Target a minimum of 10% comment ratio for better maintainability`);
  console.log(`4. Focus on complex logic and business rule explanations\n`);
  
  // Exit with error code if files need attention
  process.exit(problematicFiles.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFile };