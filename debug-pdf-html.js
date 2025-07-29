// Debug script to test HTML generation
import { generatePrintHTML } from './src/components/dashboard/utils/printUtils.js';

// Mock data for testing
const mockConstitution = {
  id: 'test-constitution',
  title: 'Test Constitution',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockSections = [
  {
    id: 'preamble-1',
    type: 'preamble',
    title: 'Preamble',
    content: 'This is the preamble content.',
    order: 0
  },
  {
    id: 'article-1',
    type: 'article',
    title: 'General Provisions',
    content: 'This is article content.',
    order: 1
  },
  {
    id: 'section-1',
    type: 'section',
    title: 'Name of Organization',
    content: 'This is section content.',
    parentId: 'article-1',
    order: 1
  },
  {
    id: 'section-2',
    type: 'section',
    title: 'Purpose',
    content: 'This is another section content.',
    parentId: 'article-1',
    order: 2
  },
  {
    id: 'article-2',
    type: 'article',
    title: 'Membership',
    content: 'This is the second article content.',
    order: 2
  },
  {
    id: 'section-3',
    type: 'section',
    title: 'Eligibility',
    content: 'This is section content under article 2.',
    parentId: 'article-2',
    order: 1
  }
];

// Generate HTML
const htmlContent = generatePrintHTML(mockConstitution, mockSections);

// Write to file for inspection
import fs from 'fs';
fs.writeFileSync('debug-output.html', htmlContent);

console.log('HTML generated and saved to debug-output.html');
console.log('Key elements to check:');
console.log('- Article titles should use <h2 class="article-title">');
console.log('- Section titles should use <h3 class="section-title">');
console.log('- CSS should force 18pt for articles, 12pt for sections');
