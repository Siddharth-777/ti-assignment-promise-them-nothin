function printReport(results) {
  const nameWidth = Math.max(4, ...results.map(r => r.name.length));

  console.log('');
  console.log(`${'NAME'.padEnd(nameWidth)}  RESULT  DETAIL`);
  console.log(`${'-'.repeat(nameWidth)}  ------  ------`);

  for (const r of results) {
    const verdict = r.pass ? 'PASS' : 'FAIL';
    const detail = r.detail || '';
    console.log(`${r.name.padEnd(nameWidth)}  ${verdict.padEnd(6)}  ${detail}`);
  }

  const passed = results.filter(r => r.pass).length;
  console.log('');
  console.log(`${passed}/${results.length} passed`);

  return results.length - passed;
}

module.exports = { printReport };
